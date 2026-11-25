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

function openAI(): AnswerProvider {
  return {
    id: "openai",
    name: "ChatGPT",
    configured: () => Boolean(process.env.OPENAI_API_KEY),
    async answer(prompt: string) {
      const key = process.env.OPENAI_API_KEY || "";
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const headers = {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      };
      if (process.env.OPENAI_WEB_SEARCH !== "false") {
        const response = await fetchWithTimeout(
          "https://api.openai.com/v1/responses",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              model,
              input: prompt,
              tools: [{ type: process.env.OPENAI_SEARCH_TOOL || "web_search" }],
            }),
          },
          28_000,
        );
        if (response.ok) {
          return textFromResponses((await response.json()) as Json);
        }
        const body = await readError(response);
        if (response.status !== 400 && response.status !== 404) {
          throw new Error(shortError("ChatGPT", response.status, body));
        }
      }

      const response = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [{ role: "user", content: prompt }],
          }),
        },
        28_000,
      );
      if (!response.ok) {
        throw new Error(shortError("ChatGPT", response.status, await readError(response)));
      }
      const data = (await response.json()) as Json;
      const choices = Array.isArray(data.choices) ? data.choices : [];
      const first = choices[0] as Json | undefined;
      const message = first?.message as Json | undefined;
      const text = typeof message?.content === "string" ? message.content : "";
      return { text: text.trim(), sources: [] };
    },
  };
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

function gemini(): AnswerProvider {
  return {
    id: "gemini",
    name: "Gemini",
    configured: () => Boolean(process.env.GEMINI_API_KEY),
    async answer(prompt: string) {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const grounding = process.env.GEMINI_GROUNDING !== "false";
      const ask = async (withSearch: boolean) => {
        const body: Json = {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 700, temperature: 0.2 },
        };
        if (withSearch) body.tools = [{ google_search: {} }];
        return fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
          28_000,
        );
      };

      let response = await ask(grounding);
      if (!response.ok && grounding && (response.status === 400 || response.status === 404)) {
        response = await ask(false);
      }
      if (!response.ok) {
        throw new Error(shortError("Gemini", response.status, await readError(response)));
      }
      const data = (await response.json()) as Json;
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      const candidate = candidates[0] as Json | undefined;
      const content = candidate?.content as Json | undefined;
      const parts = Array.isArray(content?.parts) ? content.parts : [];
      const text = parts
        .map((part) => (part && typeof part === "object" ? (part as Json).text : ""))
        .filter((part): part is string => typeof part === "string")
        .join("\n")
        .trim();
      const groundingMeta = candidate?.groundingMetadata as Json | undefined;
      const chunks = Array.isArray(groundingMeta?.groundingChunks)
        ? groundingMeta.groundingChunks
        : [];
      const sources: Source[] = [];
      for (const chunk of chunks) {
        if (!chunk || typeof chunk !== "object") continue;
        const web = (chunk as Json).web as Json | undefined;
        if (web && typeof web.uri === "string") {
          sources.push({
            url: web.uri,
            title: typeof web.title === "string" ? web.title : undefined,
          });
        }
      }
      return { text, sources: mergeTitle(sources) };
    },
  };
}

export function getProviders(): AnswerProvider[] {
  return [openAI(), perplexity(), gemini()];
}

export function providerSignature(providers: AnswerProvider[] = getProviders()): string {
  return providers.map((provider) => `${provider.id}:${provider.configured() ? "live" : "demo"}`).join(",");
}

export function anyProviderConfigured(providers: AnswerProvider[] = getProviders()): boolean {
  return providers.some((provider) => provider.configured());
}
