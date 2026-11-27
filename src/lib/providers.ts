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

const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

const US_STATE_BY_NAME = new Map(
  Object.values(US_STATE_NAMES).map((name) => [name.toLowerCase(), name] as const),
);

const SECRET_SNIPPET_PATTERN =
  /Bearer\s+\S+|\b(?:sk_live_|sk_test_|rk_live_|rk_test_|rk_|whsec_|pplx-)[A-Za-z0-9]+|\bsk-[a-zA-Z0-9_-]+|AIza[\w-]+/gi;

export function mapUsRegion(state: string): string {
  const trimmed = state.trim();
  if (!trimmed) return "";
  return US_STATE_NAMES[trimmed.toUpperCase()] ?? US_STATE_BY_NAME.get(trimmed.toLowerCase()) ?? trimmed;
}

export function sanitizeErrorSnippet(text: string, maxLength = 200): string {
  return text.replace(SECRET_SNIPPET_PATTERN, "[redacted]").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export type AgentErrorDetails = {
  status: number;
  errorType?: string;
  errorParam?: string;
  errorMessage?: string;
};

export function parseAgentErrorBody(status: number, body: string): AgentErrorDetails {
  const details: AgentErrorDetails = { status };
  const trimmed = body.trim();
  if (!trimmed) return details;
  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    const err =
      json.error && typeof json.error === "object" && !Array.isArray(json.error)
        ? (json.error as Record<string, unknown>)
        : json;
    if (typeof err.type === "string") details.errorType = err.type;
    if (typeof err.param === "string") details.errorParam = err.param;
    const message =
      typeof err.message === "string" ? err.message : typeof json.message === "string" ? json.message : trimmed;
    details.errorMessage = sanitizeErrorSnippet(message);
  } catch {
    details.errorMessage = sanitizeErrorSnippet(trimmed);
  }
  return details;
}

function userLocation(
  options: ProviderAskOptions,
): { country: "US"; region?: string; city?: string } | undefined {
  const city = options.city?.trim() ?? "";
  const region = options.state ? mapUsRegion(options.state) : "";
  if (!city && !region) return undefined;
  return {
    country: "US",
    ...(region ? { region } : {}),
    ...(city ? { city } : {}),
  };
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
        tools: [{ type: "web_search", ...(location ? { user_location: location } : {}) }],
        tool_choice: { type: "web_search" },
        instructions:
          "Search the web once for this local question, then answer. Recommend real businesses. Use a numbered list when you name more than one, best first. Include the source URLs.",
        max_output_tokens: 700,
      };
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
        const details = parseAgentErrorBody(response.status, await readError(response));
        const error = new Error(shortError(name, details.status, details.errorMessage ?? "")) as Error & {
          httpStatus?: number;
          errorClass?: string;
          errorType?: string;
          errorParam?: string;
          errorMessage?: string;
        };
        error.httpStatus = details.status;
        error.errorClass = `http_${details.status}`;
        error.errorType = details.errorType;
        error.errorParam = details.errorParam;
        error.errorMessage = details.errorMessage;
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
