import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCacheKey, executeScan, VISIBILITY_CACHE_VERSION } from "@/lib/engine";
import { getProviders } from "@/lib/providers";
import { MIN_ANSWERS_PER_PROVIDER, MIN_ANSWERS_TO_FINISH, MIN_PROVIDERS_TO_FINISH, scanIsComplete } from "@/lib/scan-complete";

type CapturedRequest = { url: string; auth: string | null; payload: Record<string, unknown> };

function stubAgentFetch(
  impl?: (url: string, init?: RequestInit) => Promise<Response> | Response,
): { bodies: CapturedRequest[] } {
  const bodies: CapturedRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      bodies.push({
        url: String(url),
        auth: (init?.headers as Record<string, string> | undefined)?.Authorization ?? null,
        payload: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      });
      if (impl) return impl(url, init);
      return new Response(JSON.stringify({ output: [], output_text: "1. A shop." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return { bodies };
}

describe("three-model Perplexity Agent API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("exposes Perplexity, ChatGPT, and Gemini on one PERPLEXITY_API_KEY", () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "test-perplexity-key");
    const providers = getProviders();
    expect(providers.map((provider) => provider.id)).toEqual(["perplexity", "openai", "gemini"]);
    expect(providers.map((provider) => provider.name)).toEqual(["Perplexity", "ChatGPT", "Gemini"]);
    expect(providers.every((provider) => provider.configured())).toBe(true);
    vi.stubEnv("PERPLEXITY_API_KEY", "");
    expect(getProviders().every((provider) => !provider.configured())).toBe(true);
  });

  it("POSTs to /v1/agent with the three default models, max_steps, web_search, and user_location inside tools[0]", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "test-perplexity-key");
    const { bodies } = stubAgentFetch();

    const providers = getProviders();
    await Promise.all(
      providers.map((provider) =>
        provider.answer("A customer in Clarksville, TN asks: who sells Harleys?", {
          city: "Clarksville",
          state: "TN",
        }),
      ),
    );

    expect(bodies).toHaveLength(3);
    expect(bodies.map((row) => row.url)).toEqual([
      "https://api.perplexity.ai/v1/agent",
      "https://api.perplexity.ai/v1/agent",
      "https://api.perplexity.ai/v1/agent",
    ]);
    expect(bodies.every((row) => row.auth === "Bearer test-perplexity-key")).toBe(true);
    expect(bodies.map((row) => row.payload.model)).toEqual([
      "perplexity/sonar",
      "openai/gpt-6-luna",
      "google/gemini-3.8-flash",
    ]);
    for (const row of bodies) {
      expect(row.payload.max_steps).toBe(1);
      expect(row.payload.tool_choice).toEqual({ type: "web_search" });
      expect(row.payload).not.toHaveProperty("user_location");
      expect(row.payload.tools).toEqual([
        {
          type: "web_search",
          user_location: {
            country: "US",
            region: "Tennessee",
            city: "Clarksville",
          },
        },
      ]);
      expect(JSON.stringify(row.payload)).not.toContain("test-perplexity-key");
    }
  });

  it("maps 2-letter US state codes to full names and leaves already-full names intact", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "test-perplexity-key");
    const { bodies } = stubAgentFetch();
    const [provider] = getProviders();

    await provider.answer("who sells Harleys?", { city: "Clarksville", state: "TN" });
    await provider.answer("who sells Harleys?", { city: "Nashville", state: "tn" });
    await provider.answer("who sells burritos?", { city: "Los Angeles", state: "CA" });
    await provider.answer("who sells burritos?", { city: "San Diego", state: "California" });
    await provider.answer("who sells burritos?", { city: "Sacramento", state: "california" });
    await provider.answer("who sells crabs?", { city: "Washington", state: "DC" });
    await provider.answer("who sells crabs?", { city: "Washington", state: "District of Columbia" });

    const regions = bodies.map((row) => {
      expect(row.payload).not.toHaveProperty("user_location");
      const tools = row.payload.tools as Array<{ type: string; user_location?: { region?: string; city?: string; country?: string } }>;
      return tools[0]?.user_location?.region;
    });
    expect(regions).toEqual([
      "Tennessee",
      "Tennessee",
      "California",
      "California",
      "California",
      "District of Columbia",
      "District of Columbia",
    ]);
  });

  it("logs secret-free error details on non-2xx Agent API responses", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "test-perplexity-key");
    const longMessage =
      "user_location must be set on the web_search tool, not the request root. " +
      "x".repeat(180) +
      " Authorization: Bearer pplx-SUPERSECRET999 sk_live_abcdef123456";
    stubAgentFetch(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              type: "invalid_request_error",
              param: "user_location",
              message: longMessage,
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
    );

    const lines: string[] = [];
    vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
      lines.push(String(args[0] ?? ""));
    });

    const questions = Array.from({ length: 8 }, (_, index) => ({
      id: `q${index + 1}`,
      text: `Who sells Harleys nearby ${index + 1}?`,
      index,
    }));
    await executeScan(
      {
        businessName: "Appleton's Harley-Davidson",
        category: "motorcycle dealer",
        city: "Clarksville",
        state: "TN",
        websiteUrl: null,
      },
      questions,
      {
        providers: getProviders(),
        concurrency: 3,
        minStartGapMs: 0,
        deadlineMs: 10_000,
      },
    );

    const questionLogs = lines
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((row): row is Record<string, unknown> => row?.event === "visibility.question");

    expect(questionLogs.length).toBeGreaterThan(0);
    for (const log of questionLogs) {
      expect(log.status).toBe(400);
      expect(log.errorType).toBe("invalid_request_error");
      expect(log.errorParam).toBe("user_location");
      expect(typeof log.errorMessage).toBe("string");
      expect(String(log.errorMessage).length).toBeGreaterThan(0);
      expect(String(log.errorMessage).length).toBeLessThanOrEqual(200);
      const serialized = JSON.stringify(log);
      expect(serialized).not.toMatch(/pplx-SUPERSECRET999/i);
      expect(serialized).not.toMatch(/sk_live_abcdef123456/i);
      expect(serialized).not.toMatch(/Bearer\s+\S+/i);
      expect(serialized).not.toContain("test-perplexity-key");
      expect(log).not.toHaveProperty("authorization");
      expect(log).not.toHaveProperty("Authorization");
    }
  });

  it("uses a completeness bar well above 6/24, with a per-model floor", () => {
    expect(MIN_ANSWERS_TO_FINISH).toBeGreaterThan(6);
    expect(MIN_ANSWERS_TO_FINISH).toBeGreaterThanOrEqual(16);
    expect(MIN_ANSWERS_PER_PROVIDER).toBe(6);
    expect(MIN_PROVIDERS_TO_FINISH).toBe(2);

    const twelveSparse = Array.from({ length: 24 }, (_, index) => ({
      error: index < 6 ? undefined : "failed",
    }));
    expect(scanIsComplete({ answers: twelveSparse })).toBe(false);

    const twoModelsReady = [
      ...Array.from({ length: 8 }, () => ({ error: undefined, providerId: "perplexity" as const })),
      ...Array.from({ length: 8 }, () => ({ error: undefined, providerId: "openai" as const })),
      ...Array.from({ length: 8 }, () => ({ error: "failed", providerId: "gemini" as const })),
    ];
    expect(scanIsComplete({ answers: twoModelsReady })).toBe(true);
  });

  it("bumps the visibility cache version so old 0-score rows are not reused", () => {
    expect(VISIBILITY_CACHE_VERSION).toMatch(/v2|3model|match/i);
    const input = {
      businessName: "Appleton's Harley-Davidson",
      category: "motorcycle dealer",
      city: "Clarksville",
      state: "TN",
      websiteUrl: "https://appletonharley.com",
    };
    const key = buildCacheKey(input, "perplexity:live,openai:live,gemini:live");
    expect(key).toContain(VISIBILITY_CACHE_VERSION);
    expect(key).toContain("appleton");
    expect(key.startsWith("appleton")).toBe(false);
  });
});
