import { describe, expect, it } from "vitest";

import { applyPurchase } from "@/lib/purchase";
import { aggregateCompetitors, pointsFor, scoreLabel, visibilityScore } from "@/lib/score";

describe("scoring", () => {
  it("scores a first-place mention higher than a passing mention", () => {
    expect(pointsFor(false, null)).toBe(0);
    expect(pointsFor(true, null)).toBe(35);
    expect(pointsFor(true, 1)).toBe(100);
    expect(pointsFor(true, 2)).toBe(80);
    expect(pointsFor(true, 3)).toBe(60);
    expect(pointsFor(true, 4)).toBe(40);
    expect(pointsFor(true, 6)).toBe(20);
  });

  it("averages usable answers and skips provider errors", () => {
    const score = visibilityScore([
      { mentioned: true, rank: 1 },
      { mentioned: false, rank: null },
      { mentioned: true, rank: 2, error: "timeout" },
    ]);
    expect(score).toBe(50);
    expect(visibilityScore([{ mentioned: true, rank: 1, error: "down" }])).toBe(0);
  });

  it("labels the bands an owner can read", () => {
    expect(scoreLabel(80)).toBe("Often recommended");
    expect(scoreLabel(50)).toBe("Sometimes named");
    expect(scoreLabel(25)).toBe("Rarely named");
    expect(scoreLabel(10)).toBe("Hard to find");
  });

  it("rolls competitor mentions together and drops the business", () => {
    const stats = aggregateCompetitors(
      [
        {
          error: undefined,
          competitors: [
            { name: "Maple Street Plumber", rank: 1 },
            { name: "Harper's Plumbing LLC", rank: 2 },
          ],
        },
        {
          error: undefined,
          competitors: [{ name: "maple street plumber", rank: 3 }],
        },
        {
          error: "skip",
          competitors: [{ name: "Should Not Count", rank: 1 }],
        },
      ],
      "Harper's Plumbing",
    );
    expect(stats).toEqual([{ name: "Maple Street Plumber", mentions: 2, bestRank: 1 }]);
  });
});

describe("purchases", () => {
  it("keeps a monthly watch if someone later buys the one-time report", () => {
    expect(applyPurchase("free", "report")).toBe("report");
    expect(applyPurchase("free", "monitor")).toBe("monitor");
    expect(applyPurchase("report", "monitor")).toBe("monitor");
    expect(applyPurchase("monitor", "report")).toBe("monitor");
  });
});
