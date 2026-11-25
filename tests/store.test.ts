import { describe, expect, it } from "vitest";

import { createStore } from "@/lib/db";
import type { ScanPayload, ScanRecord } from "@/lib/types";

function answers(usable: number, total = 8) {
  return Array.from({ length: total }, (_, index) => ({
    questionId: `q${index + 1}`,
    question: "What is the best plumber in Clarksville, TN?",
    providerId: "perplexity" as const,
    providerName: "Perplexity",
    demo: true,
    text: index < usable ? "1. Harper's Plumbing — often named." : "",
    mentioned: index < usable,
    rank: index < usable ? 1 : null,
    competitors: [],
    sources: [],
    error: index < usable ? undefined : "Perplexity returned 429.",
    points: index < usable ? 100 : 0,
  }));
}

function payload(score: number, usable = 8): ScanPayload {
  const rows = answers(usable);
  return {
    questions: [],
    answers: rows,
    competitors: [],
    findings: [],
    siteCheck: null,
    score,
    mentionCount: rows.filter((row) => row.mentioned).length,
    answerCount: usable,
    complete: usable >= 6,
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
    expect(await store.ping()).toBe(true);
  });

  it("stops monthly re-checks when a subscription is canceled", async () => {
    const store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    await store.insertScan(
      scan("watch", {
        tier: "monitor",
        stripeSubscriptionId: "sub_123",
        nextRunAt: "2026-12-25T12:00:00.000Z",
      }),
    );
    const updated = await store.clearMonitor("sub_123");
    expect(updated?.tier).toBe("report");
    expect(updated?.stripeSubscriptionId).toBeNull();
    expect(updated?.nextRunAt).toBeNull();
  });

  it("does not cache an incomplete scan, so a replay can run again", async () => {
    const store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    await store.insertScan(
      scan("short", {
        score: 0,
        payload: payload(0, 1),
      }),
    );
    const cached = await store.findRecentByIp(
      "ip-1",
      "harpers|plumber|clarksville|TN||demo",
      "2026-11-25T00:00:00.000Z",
    );
    const donor = await store.findRecentCache(
      "harpers|plumber|clarksville|TN||demo",
      "2026-11-25T00:00:00.000Z",
    );
    expect(cached).toBeNull();
    expect(donor).toBeNull();
    expect(await store.getScan("short")).not.toBeNull();
  });

  it("skips an incomplete row and still serves a complete scan from the 24-hour cache", async () => {
    const store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    await store.insertScan(
      scan("done", {
        createdAt: "2026-11-25T11:00:00.000Z",
        updatedAt: "2026-11-25T11:00:00.000Z",
        payload: payload(70, 8),
        score: 70,
      }),
    );
    await store.insertScan(
      scan("later-short", {
        createdAt: "2026-11-25T12:30:00.000Z",
        updatedAt: "2026-11-25T12:30:00.000Z",
        payload: payload(0, 1),
        score: 0,
      }),
    );
    const cached = await store.findRecentCache(
      "harpers|plumber|clarksville|TN||demo",
      "2026-11-25T00:00:00.000Z",
    );
    expect(cached?.id).toBe("done");
    expect(cached?.score).toBe(70);
  });
});
