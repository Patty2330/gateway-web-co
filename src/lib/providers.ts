import { fetchWithTimeout, shortError } from "@/lib/http";
import type { ProviderId, Source } from "@/lib/types";

export type ProviderAnswer = {
  text: string;
  sources: Source[];
};

export type AnswerProvider = {
  id: ProviderId;
  name: string;
  configured: () => boolean;
  answer: (prompt: string) => Promise<ProviderAnswer>;
};

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

function textFromResponses(data: Json): ProviderAnswer {
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

function perplexity(): AnswerProvider {
  return {
    id: "perplexity",
    name: "Perplexity",
    configured: () => Boolean(process.env.PERPLEXITY_API_KEY),
    async answer(prompt: string) {
      const model = process.env.PERPLEXITY_MODEL || "perplexity/sonar";
      const response = await fetchWithTimeout(
        "https://api.perplexity.ai/v1/agent",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            input: prompt,
            tools: [{ type: "web_search" }],
            instructions:
              "Search the web once for this local question, then answer. Recommend real businesses. Use a numbered list when you name more than one, best first. Include the source URLs.",
            max_output_tokens: 700,
          }),
        },
        28_000,
      );
      if (!response.ok) {
        throw new Error(shortError("Perplexity", response.status, await readError(response)));
      }
      return textFromResponses((await response.json()) as Json);
    },
  };
}

export function getProviders(): AnswerProvider[] {
  return [perplexity()];
}

export function providerSignature(providers: AnswerProvider[] = getProviders()): string {
  return providers.map((provider) => `${provider.id}:${provider.configured() ? "live" : "demo"}`).join(",");
}

export function anyProviderConfigured(providers: AnswerProvider[] = getProviders()): boolean {
  return providers.some((provider) => provider.configured());
}
