import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCacheKey, VISIBILITY_CACHE_VERSION } from "@/lib/engine";
import { getProviders } from "@/lib/providers";
import { MIN_ANSWERS_PER_PROVIDER, MIN_ANSWERS_TO_FINISH, MIN_PROVIDERS_TO_FINISH, scanIsComplete } from "@/lib/scan-complete";

describe("three-model Perplexity Agent API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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

  it("POSTs to /v1/agent with the three default models, max_steps, web_search, and user_location", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "test-perplexity-key");
    const bodies: Array<{ url: string; auth: string | null; payload: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        bodies.push({
          url: String(url),
          auth: (init?.headers as Record<string, string> | undefined)?.Authorization ?? null,
          payload: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        });
        return new Response(JSON.stringify({ output: [], output_text: "1. A shop." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

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
      expect(row.payload.tools).toEqual([{ type: "web_search" }]);
      expect(row.payload.tool_choice).toEqual({ type: "web_search" });
      expect(row.payload.user_location).toEqual({
        country: "US",
        region: "TN",
        city: "Clarksville",
      });
      expect(JSON.stringify(row.payload)).not.toContain("test-perplexity-key");
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
