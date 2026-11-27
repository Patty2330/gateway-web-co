import { afterEach, describe, expect, it, vi } from "vitest";

import { executeScan } from "@/lib/engine";

const answerBody = {
  output: [
    {
      type: "message",
      content: [
        {
          type: "output_text",
          text: "1. The Catfish House — a local favorite.\nSources: https://www.catfishhouseclarksville.com/",
          annotations: [{ url: "https://www.catfishhouseclarksville.com/", title: "The Catfish House" }],
        },
      ],
    },
  ],
};

describe("live Perplexity provider path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("retries a 429 through fetchWithRetry and completes the check", async () => {
    vi.stubEnv("PERPLEXITY_API_KEY", "test-perplexity-key");
    const calls: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls.push(Date.now());
        if (calls.length === 1) {
          return new Response("rate limited", { status: 429, headers: { "Retry-After": "0" } });
        }
        return new Response(JSON.stringify(answerBody), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const payload = await executeScan(
      {
        businessName: "The Catfish House",
        category: "restaurant",
        city: "Clarksville",
        state: "TN",
        websiteUrl: null,
      },
      undefined,
      { deadlineMs: 20_000, minStartGapMs: 0 },
    );

    expect(payload.complete).toBe(true);
    expect(payload.answerCount).toBe(24);
    expect(payload.score).toBeGreaterThan(0);
    expect(payload.providers).toHaveLength(3);
    expect(payload.providers.every((provider) => provider.demo === false)).toBe(true);
    expect(calls.length).toBeGreaterThan(24);
  });
});
