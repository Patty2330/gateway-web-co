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

function payload(score: number | null, usable = 8): ScanPayload {
  const rows = answers(usable);
  const complete = usable >= 6;
  return {
    questions: [],
    answers: rows,
    competitors: [],
    findings: [],
    siteCheck: null,
    score: complete ? score : null,
    mentionCount: rows.filter((row) => row.mentioned).length,
    answerCount: usable,
    complete,
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
        score: null,
        payload: payload(null, 1),
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
        payload: payload(null, 1),
        score: null,
      }),
    );
    const cached = await store.findRecentCache(
      "harpers|plumber|clarksville|TN||demo",
      "2026-11-25T00:00:00.000Z",
    );
    expect(cached?.id).toBe("done");
    expect(cached?.score).toBe(70);

    const unfinished = await store.getScan("later-short");
    expect(unfinished?.score).toBeNull();
  });

  it("refunds a rate-limit count but never goes below zero", async () => {
    const store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    expect(await store.consumeRateLimit("ip-1", "2026-11-25")).toBe(1);
    expect(await store.consumeRateLimit("ip-1", "2026-11-25")).toBe(2);
    expect(await store.refundRateLimit("ip-1", "2026-11-25")).toBe(1);
    expect(await store.refundRateLimit("ip-1", "2026-11-25")).toBe(0);
    expect(await store.refundRateLimit("ip-1", "2026-11-25")).toBe(0);
    expect(await store.refundRateLimit("missing", "2026-11-25")).toBe(0);
  });
});

describe("findRecentByIp never hands back a paid scan", () => {
  const since = "2026-11-24T00:00:00.000Z";
  const PAID = "aaaaaaaa-0000-4000-8000-000000000001";
  const FREE = "aaaaaaaa-0000-4000-8000-000000000002";

  it("skips a newer paid scan from the same IP and returns the older free one", async () => {
    const store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    await store.insertScan(scan(FREE, { ipHash: "shared-nat", cacheKey: "k1", createdAt: "2026-11-25T10:00:00.000Z" }));
    await store.insertScan(scan(PAID, { ipHash: "shared-nat", cacheKey: "k1", createdAt: "2026-11-25T11:00:00.000Z" }));
    await store.markPaid(PAID, { plan: "report", email: "owner@example.com", stripeSessionId: "cs_1", stripeSubscriptionId: null });
    const found = await store.findRecentByIp("shared-nat", "k1", since);
    expect(found?.id).toBe(FREE);
  });

  it.each([
    ["report", { plan: "report" as const, email: "a@example.com", stripeSessionId: "cs_r", stripeSubscriptionId: null }],
    ["monitor", { plan: "monitor" as const, email: "a@example.com", stripeSessionId: "cs_m", stripeSubscriptionId: "sub_m" }],
    ["practice report", { plan: "report" as const, email: "a@example.com", stripeSessionId: null, stripeSubscriptionId: null }],
  ])("returns null when the only match is a %s purchase", async (_label, purchase) => {
    const store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    await store.insertScan(scan(PAID, { ipHash: "shared-nat", cacheKey: "k1", createdAt: "2026-11-25T11:00:00.000Z" }));
    await store.markPaid(PAID, purchase);
    expect(await store.findRecentByIp("shared-nat", "k1", since)).toBeNull();
  });

  it("returns null when a monitor was canceled back to a report tier", async () => {
    const store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    await store.insertScan(scan(PAID, { ipHash: "shared-nat", cacheKey: "k1", createdAt: "2026-11-25T11:00:00.000Z" }));
    await store.markPaid(PAID, { plan: "monitor", email: "a@example.com", stripeSessionId: "cs_m", stripeSubscriptionId: "sub_x" });
    await store.clearMonitor("sub_x");
    expect((await store.getScan(PAID))?.tier).toBe("report");
    expect(await store.findRecentByIp("shared-nat", "k1", since)).toBeNull();
  });

  it("still reuses a plain free scan from the same IP", async () => {
    const store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    await store.insertScan(scan(FREE, { ipHash: "me", cacheKey: "k2", createdAt: "2026-11-25T10:00:00.000Z" }));
    expect((await store.findRecentByIp("me", "k2", since))?.id).toBe(FREE);
  });
});
