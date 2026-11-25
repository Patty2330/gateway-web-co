import { describe, expect, it } from "vitest";

import { runDemoScan } from "@/lib/demo-scan";

describe("pages demo scan", () => {
  it("scores eight Perplexity sample answers without calling an API", () => {
    const payload = runDemoScan({
      businessName: "Harper's Plumbing",
      category: "plumber",
      city: "Clarksville",
      state: "TN",
      websiteUrl: null,
    });

    expect(payload.answers).toHaveLength(8);
    expect(payload.answers.every((answer) => answer.providerId === "perplexity" && answer.demo)).toBe(
      true,
    );
    expect(payload.answerCount).toBe(8);
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