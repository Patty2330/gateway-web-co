import { describe, expect, it } from "vitest";

import { createStore } from "@/lib/db";
import type { ScanPayload, ScanRecord } from "@/lib/types";

function payload(score: number): ScanPayload {
  return {
    questions: [],
    answers: [],
    competitors: [],
    findings: [],
    siteCheck: null,
    score,
    mentionCount: 1,
    answerCount: 2,
    providers: [],
  };
}

function scan(id: string, overrides: Partial<ScanRecord> = {}): ScanRecord {
  const now = "2026-11-25T12:00:00.000Z";
  return {
    id,
    businessName: "Harper's Plumbing",
    category: "plumber",
    city: "Clarksville",
    state: "TN",
    websiteUrl: null,
    createdAt: now,
    updatedAt: now,
    ipHash: "ip-1",
    mode: "demo",
    cacheKey: "harpers|plumber|clarksville|TN||demo",
    score: 42,
    tier: "free",
    email: null,
    stripeSessionId: null,
    stripeSubscriptionId: null,
    nextRunAt: null,
    previousScore: null,
    payload: payload(42),
    ...overrides,
  };
}

describe("store", () => {
  it("saves a check, caches it, and unlocks a purchase", async () => {
    const store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    await store.insertScan(scan("one"));
    const found = await store.getScan("one");
    expect(found?.businessName).toBe("Harper's Plumbing");
    expect(found?.score).toBe(42);

    const recent = await store.findRecentByIp(
      "ip-1",
      "harpers|plumber|clarksville|TN||demo",
      "2026-11-25T00:00:00.000Z",
    );
    expect(recent?.id).toBe("one");

    const paid = await store.markPaid("one", {
      plan: "monitor",
      email: "owner@example.com",
      stripeSessionId: null,
      stripeSubscriptionId: null,
      now: new Date("2026-11-25T12:00:00.000Z"),
    });
    expect(paid?.tier).toBe("monitor");
    expect(paid?.email).toBe("owner@example.com");
    expect(paid?.nextRunAt).toBeTruthy();

    const first = await store.consumeRateLimit("ip-1", "2026-11-25");
    const second = await store.consumeRateLimit("ip-1", "2026-11-25");
    expect(first).toBe(1);
    expect(second).toBe(2);
  });
});
