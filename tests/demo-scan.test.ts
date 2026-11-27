import { describe, expect, it } from "vitest";

import { runDemoScan } from "@/lib/demo-scan";

describe("pages demo scan", () => {
  it("scores sample answers from Perplexity, ChatGPT, and Gemini without calling an API", () => {
    const payload = runDemoScan({
      businessName: "Harper's Plumbing",
      category: "plumber",
      city: "Clarksville",
      state: "TN",
      websiteUrl: null,
    });

    expect(payload.answers).toHaveLength(24);
    expect(payload.answers.every((answer) => answer.demo)).toBe(true);
    expect(new Set(payload.answers.map((answer) => answer.providerId))).toEqual(
      new Set(["perplexity", "openai", "gemini"]),
    );
    expect(payload.providers.map((provider) => provider.name)).toEqual([
      "Perplexity",
      "ChatGPT",
      "Gemini",
    ]);
    expect(payload.answerCount).toBe(24);
    expect(payload.complete).toBe(true);
    expect(payload.score).toBeGreaterThanOrEqual(0);
    expect(payload.score).toBeLessThanOrEqual(100);
    expect(payload.findings.find((finding) => finding.id === "website-missing")?.fix).toContain(
      "$500",
    );
    expect(payload.findings.find((finding) => finding.id === "website-missing")?.fix).toContain(
      "100% happy",
    );
  });
});
