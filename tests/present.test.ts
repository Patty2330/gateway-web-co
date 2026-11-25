import { describe, expect, it } from "vitest";

import { presentScan } from "@/lib/present";
import { UNFINISHED_SCAN_MESSAGE } from "@/lib/scan-complete";
import type { AnswerRecord, ScanPayload, ScanRecord } from "@/lib/types";

function answers(usable: number, total = 8): AnswerRecord[] {
  return Array.from({ length: total }, (_, index) => ({
    questionId: `q${index + 1}`,
    question: "What is the best restaurant in Clarksville, TN?",
    providerId: "perplexity",
    providerName: "Perplexity",
    demo: false,
    text: index < usable ? "1. The Catfish House — listed locally." : "",
    mentioned: index < usable,
    rank: index < usable ? 2 : null,
    competitors: [],
    sources: index < usable ? [{ url: "https://www.catfishhouseclarksville.com/" }] : [],
    error:
      index < usable
        ? undefined
        : 'Perplexity returned 429. {"error":{"message":"Request rate limit exceeded","code":429}}',
    points: index < usable ? 80 : 0,
  }));
}

function record(overrides: Partial<ScanRecord> = {}, usable = 8): ScanRecord {
  const rows = answers(usable);
  const payload: ScanPayload = {
    questions: rows.map((row) => ({ id: row.questionId, text: row.question, index: 0 })),
    answers: rows,
    competitors: [],
    findings: [],
    siteCheck: null,
    score: usable >= 6 ? 40 : 0,
    mentionCount: usable,
    answerCount: usable,
    complete: usable >= 6,
    providers: [
      {
        id: "perplexity",
        name: "Perplexity",
        demo: false,
        mentions: usable,
        answers: usable,
        errors: 8 - usable,
        error:
          usable < 8
            ? 'Perplexity returned 429. {"error":{"message":"Request rate limit exceeded","code":429}}'
            : undefined,
      },
    ],
  };
  return {
    id: "11111111-1111-4111-8111-111111111111",
    businessName: "The Catfish House",
    category: "restaurant",
    city: "Clarksville",
    state: "TN",
    websiteUrl: "https://www.catfishhouseclarksville.com/",
    createdAt: "2026-11-25T19:38:05.000Z",
    updatedAt: "2026-11-25T19:38:05.000Z",
    ipHash: "hash",
    mode: "live",
    cacheKey: "key",
    score: payload.score,
    tier: "free",
    email: null,
    stripeSessionId: null,
    stripeSubscriptionId: null,
    nextRunAt: null,
    previousScore: null,
    payload,
    ...overrides,
  };
}

describe("presentScan", () => {
  it("hides the score and uses the unfinished message when fewer than 6 answers come back", () => {
    const publicScan = presentScan(record({}, 1));
    expect(publicScan.complete).toBe(false);
    expect(publicScan.score).toBeNull();
    expect(publicScan.label).toBe("");
    expect(publicScan.summary).toBe(UNFINISHED_SCAN_MESSAGE);
    expect(publicScan.topFindings).toEqual([]);
  });

  it("redacts raw upstream errors on the public payload", () => {
    const publicScan = presentScan(record({ tier: "report" }, 1));
    expect(JSON.stringify(publicScan)).not.toContain("Request rate limit exceeded");
    expect(JSON.stringify(publicScan)).not.toContain("429");
    expect(publicScan.providers[0]?.error).toBe("Perplexity didn't finish every question.");
    expect(publicScan.answers).toBeUndefined();
    expect(publicScan.complete).toBe(false);

    const unlockedComplete = presentScan(record({ tier: "report" }, 6));
    expect(unlockedComplete.complete).toBe(true);
    expect(unlockedComplete.score).toBe(40);
    const failed = unlockedComplete.answers?.filter((answer) => answer.error) ?? [];
    expect(failed.length).toBe(2);
    for (const answer of failed) {
      expect(answer.error).toBe("This question didn't get an answer.");
      expect(answer.text).toBe("");
    }
  });
});
