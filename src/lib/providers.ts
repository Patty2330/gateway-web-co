import { shortError } from "@/lib/http";
import { fetchWithRetry } from "@/lib/retry";
import type { ProviderId, Source } from "@/lib/types";

export type ProviderAnswer = {
  text: string;
  sources: Source[];
  model?: string;
  httpStatus?: number;
  latencyMs?: number;
};

export type ProviderAskOptions = {
  signal?: AbortSignal;
  deadlineAt?: number;
  now?: () => number;
  city?: string;
  state?: string;
};

export type AnswerProvider = {
  id: ProviderId;
  name: string;
  model?: () => string;
  configured: () => boolean;
  answer: (prompt: string, options?: ProviderAskOptions) => Promise<ProviderAnswer>;
};

export const PERPLEXITY_AGENT_URL = "https://api.perplexity.ai/v1/agent";

export const DEFAULT_PROVIDER_MODELS = {
  perplexity: "perplexity/sonar",
  openai: "openai/gpt-6-luna",
  gemini: "google/gemini-3.8-flash",
} as const;

function mergeTitle(sources: Source[]): Source[] {
  const seen = new Set<string>();
  const merged: Source[] = [];
  for (const source of sources) {
    if (!source.url || seen.has(source.url)) continue;
    seen.add(source.url);
    merged.push(source);
  }
  return merged;
}

type Json = Record<string, unknown>;

async function readError(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export function textFromResponses(data: Json): ProviderAnswer {
  const sources: Source[] = [];
  const texts: string[] = [];
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as Json;
    if (record.type === "search_results" && Array.isArray(record.results)) {
      for (const result of record.results) {
        if (!result || typeof result !== "object") continue;
        const row = result as Json;
        if (typeof row.url === "string") {
          sources.push({
            url: row.url,
            title: typeof row.title === "string" ? row.title : undefined,
          });
        }
      }
    }
    const content = Array.isArray(record.content) ? record.content : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const chunk = part as Json;
      if (chunk.type === "output_text" && typeof chunk.text === "string") {
        texts.push(chunk.text);
      }
      const annotations = Array.isArray(chunk.annotations) ? chunk.annotations : [];
      for (const annotation of annotations) {
        if (!annotation || typeof annotation !== "object") continue;
        const note = annotation as Json;
        if (typeof note.url === "string") {
          sources.push({
            url: note.url,
            title: typeof note.title === "string" ? note.title : undefined,
          });
        }
      }
    }
  }
  if (texts.length === 0 && typeof data.output_text === "string") {
    texts.push(data.output_text);
  }
  return { text: texts.join("\n\n").trim(), sources: mergeTitle(sources) };
}

function userLocation(options: ProviderAskOptions): { country: "US"; region: string; city: string } | undefined {
  const city = options.city?.trim() ?? "";
  const region = options.state?.trim() ?? "";
  if (!city || !region) return undefined;
  return { country: "US", region, city };
}

function agentProvider(
  id: ProviderId,
  name: string,
  modelEnv: "PERPLEXITY_MODEL" | "OPENAI_MODEL" | "GEMINI_MODEL",
  defaultModel: string,
): AnswerProvider {
  const modelOf = () => process.env[modelEnv]?.trim() || defaultModel;
  return {
    id,
    name,
    model: modelOf,
    configured: () => Boolean(process.env.PERPLEXITY_API_KEY),
    async answer(prompt: string, options: ProviderAskOptions = {}) {
      const model = modelOf();
      const now = options.now ?? Date.now;
      const started = now();
      const remaining = options.deadlineAt == null ? 28_000 : Math.max(0, options.deadlineAt - now());
      const location = userLocation(options);
      const body: Record<string, unknown> = {
        model,
        input: prompt,
        max_steps: 1,
        tools: [{ type: "web_search" }],
        tool_choice: { type: "web_search" },
        instructions:
          "Search the web once for this local question, then answer. Recommend real businesses. Use a numbered list when you name more than one, best first. Include the source URLs.",
        max_output_tokens: 700,
      };
      if (location) body.user_location = location;
      const response = await fetchWithRetry(
        PERPLEXITY_AGENT_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        {
          timeoutMs: Math.min(28_000, remaining),
          maxTotalMs: remaining,
          signal: options.signal,
          deadlineAt: options.deadlineAt,
          now,
        },
      );
      const latencyMs = Math.max(0, now() - started);
      if (!response.ok) {
        const error = new Error(shortError(name, response.status, await readError(response))) as Error & {
          httpStatus?: number;
          errorClass?: string;
        };
        error.httpStatus = response.status;
        error.errorClass = `http_${response.status}`;
        throw error;
      }
      const parsed = textFromResponses((await response.json()) as Json);
      return { ...parsed, model, httpStatus: response.status, latencyMs };
    },
  };
}

export function getProviders(): AnswerProvider[] {
  return [
    agentProvider("perplexity", "Perplexity", "PERPLEXITY_MODEL", DEFAULT_PROVIDER_MODELS.perplexity),
    agentProvider("openai", "ChatGPT", "OPENAI_MODEL", DEFAULT_PROVIDER_MODELS.openai),
    agentProvider("gemini", "Gemini", "GEMINI_MODEL", DEFAULT_PROVIDER_MODELS.gemini),
  ];
}

export function providerSignature(providers: AnswerProvider[] = getProviders()): string {
  return providers.map((provider) => `${provider.id}:${provider.configured() ? "live" : "demo"}`).join(",");
}

export function anyProviderConfigured(providers: AnswerProvider[] = getProviders()): boolean {
  return providers.some((provider) => provider.configured());
}
