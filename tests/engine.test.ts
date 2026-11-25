import { describe, expect, it } from "vitest";

import { executeScan, PERPLEXITY_CONCURRENCY, SCAN_DEADLINE_MS } from "@/lib/engine";
import { MIN_ANSWERS_TO_FINISH } from "@/lib/scan-complete";
import type { AnswerProvider } from "@/lib/providers";

const input = {
  businessName: "The Catfish House",
  category: "restaurant",
  city: "Clarksville",
  state: "TN",
  websiteUrl: null,
};

function provider(
  answer: AnswerProvider["answer"],
): AnswerProvider {
  return {
    id: "perplexity",
    name: "Perplexity",
    configured: () => true,
    answer,
  };
}

describe("executeScan", () => {
  it("caps the Perplexity concurrency at 2", async () => {
    expect(PERPLEXITY_CONCURRENCY).toBe(2);
    let current = 0;
    let max = 0;
    const live = provider(async () => {
      current += 1;
      max = Math.max(max, current);
      await new Promise((resolve) => setTimeout(resolve, 25));
      current -= 1;
      return { text: "1. The Catfish House — a local favorite.\nSources: https://www.catfishhouseclarksville.com/", sources: [] };
    });

    const payload = await executeScan(input, undefined, { providers: [live] });
    expect(max).toBeLessThanOrEqual(2);
    expect(max).toBe(2);
    expect(payload.answerCount).toBe(8);
    expect(payload.complete).toBe(true);
    expect(payload.score).toBeGreaterThan(0);
  });

  it("treats fewer than 6 of 8 answers as unfinished and does not score the run", async () => {
    let index = 0;
    const live = provider(async () => {
      const current = index;
      index += 1;
      if (current < 5) {
        return { text: "1. Another Grill — often named.\nSources: https://example.com/list", sources: [] };
      }
      throw new Error('Perplexity returned 429. {"error":{"message":"Request rate limit exceeded"}}');
    });

    const payload = await executeScan(input, undefined, { providers: [live] });
    expect(payload.answerCount).toBe(5);
    expect(payload.answerCount).toBeLessThan(MIN_ANSWERS_TO_FINISH);
    expect(payload.complete).toBe(false);
    expect(payload.score).toBeNull();
    expect(payload.findings).toEqual([]);
  });

  it("scores a run once 6 of 8 answers come back", async () => {
    let index = 0;
    const live = provider(async () => {
      const current = index;
      index += 1;
      if (current < 6) {
        return { text: "1. The Catfish House — a local favorite.\nSources: https://www.catfishhouseclarksville.com/", sources: [] };
      }
      throw new Error("Perplexity returned 503. busy");
    });

    const payload = await executeScan(input, undefined, { providers: [live] });
    expect(payload.answerCount).toBe(6);
    expect(payload.complete).toBe(true);
    expect(payload.score).toBeGreaterThan(0);
  });

  it("stops early once 6 of 8 answers is impossible", async () => {
    let calls = 0;
    const live = provider(async () => {
      calls += 1;
      throw new Error("Perplexity returned 400. bad");
    });
    const payload = await executeScan(input, undefined, { providers: [live] });
    expect(payload.complete).toBe(false);
    expect(payload.score).toBeNull();
    expect(calls).toBeLessThan(8);
  });

  it("returns within the hard 40-second cap when Perplexity hangs or 429s", async () => {
    expect(SCAN_DEADLINE_MS).toBe(40_000);
    const live = provider((_prompt, options) => {
      return new Promise((_, reject) => {
        const fail = () => {
          const error = new Error("This operation was aborted");
          error.name = "AbortError";
          reject(error);
        };
        if (options?.signal?.aborted) {
          fail();
          return;
        }
        options?.signal?.addEventListener("abort", fail, { once: true });
      });
    });
    const started = Date.now();
    const payload = await executeScan(input, undefined, { providers: [live] });
    const elapsed = Date.now() - started;
    expect(payload.complete).toBe(false);
    expect(payload.score).toBeNull();
    expect(elapsed).toBeLessThan(45_000);
    expect(elapsed).toBeGreaterThan(1_000);
  }, 50_000);
});
