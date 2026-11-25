import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "@/lib/db";
import type { ScanPayload, ScanRecord } from "@/lib/types";

let store: Awaited<ReturnType<typeof createStore>>;
const executeScan = vi.fn();
const send = vi.fn();

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getStore: async () => store };
});

vi.mock("@/lib/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine")>();
  return { ...actual, executeScan: (...args: unknown[]) => executeScan(...args) };
});

vi.mock("@/lib/email", () => ({
  getEmailSender: () => ({ send }),
}));

function completePayload(score: number): ScanPayload {
  return {
    questions: [{ id: "q1", text: "Best plumber?", index: 0 }],
    answers: Array.from({ length: 8 }, (_, index) => ({
      questionId: `q${index + 1}`,
      question: "Best plumber?",
      providerId: "perplexity",
      providerName: "Perplexity",
      demo: false,
      text: "1. Harper's Plumbing — named.",
      mentioned: true,
      rank: 1,
      competitors: [],
      sources: [],
      points: 100,
    })),
    competitors: [],
    findings: [],
    siteCheck: null,
    score,
    mentionCount: 8,
    answerCount: 8,
    complete: true,
    providers: [{ id: "perplexity", name: "Perplexity", demo: false, mentions: 8, answers: 8, errors: 0 }],
  };
}

function unfinishedPayload(): ScanPayload {
  return { ...completePayload(0), score: null, complete: false, answerCount: 1, mentionCount: 0, answers: completePayload(0).answers.map((answer, index) => (index === 0 ? answer : { ...answer, error: "429", text: "", mentioned: false, points: 0 })), providers: [{ id: "perplexity", name: "Perplexity", demo: false, mentions: 0, answers: 1, errors: 7 }] };
}

function scan(id: string): ScanRecord {
  const now = "2026-11-01T12:00:00.000Z";
  return {
    id,
    businessName: "Harper's Plumbing",
    category: "plumber",
    city: "Clarksville",
    state: "TN",
    websiteUrl: null,
    createdAt: now,
    updatedAt: now,
    ipHash: "ip",
    mode: "live",
    cacheKey: "k",
    score: 70,
    tier: "monitor",
    email: "owner@example.com",
    stripeSessionId: null,
    stripeSubscriptionId: "sub_123",
    nextRunAt: "2026-11-25T12:00:00.000Z",
    previousScore: null,
    payload: completePayload(70),
  };
}

describe("monthly watch cron", () => {
  beforeEach(async () => {
    store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    executeScan.mockReset();
    send.mockReset();
    process.env.CRON_SECRET = "cron-secret";
    vi.resetModules();
  });

  it("skips an unfinished rerun and does not overwrite the finished report or email a zero score", async () => {
    await store.insertScan(scan("33333333-3333-4333-8333-333333333333"));
    executeScan.mockResolvedValue(unfinishedPayload());
    const { POST } = await import("@/app/api/cron/monitor/route");
    const response = await POST(
      new Request("http://127.0.0.1/api/cron/monitor", {
        method: "POST",
        headers: { Authorization: "Bearer cron-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ran: 0, results: [] });
    expect(send).not.toHaveBeenCalled();
    const saved = await store.getScan("33333333-3333-4333-8333-333333333333");
    expect(saved?.score).toBe(70);
    expect(saved?.nextRunAt).toBe("2026-11-25T12:00:00.000Z");
    expect(saved?.payload.complete).toBe(true);
  });
});
