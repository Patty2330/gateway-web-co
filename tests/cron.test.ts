import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "@/lib/db";
import { runDueMonitors } from "@/lib/monitor-run";
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

function scan(id: string, nextRunAt = "2026-11-25T12:00:00.000Z"): ScanRecord {
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
    nextRunAt,
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
    delete process.env.MONITOR_TIME_BUDGET_MS;
    delete process.env.MONITOR_MIN_SCAN_MS;
    vi.resetModules();
  });

  function cronRequest() {
    return new Request("http://127.0.0.1/api/cron/monitor", {
      method: "POST",
      headers: { Authorization: "Bearer cron-secret" },
    });
  }

  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  async function seedThree() {
    // dueMonitors orders by next_run_at, so A runs first, then B, then C.
    await store.insertScan(scan(A, "2026-11-20T12:00:00.000Z"));
    await store.insertScan(scan(B, "2026-11-21T12:00:00.000Z"));
    await store.insertScan(scan(C, "2026-11-22T12:00:00.000Z"));
  }

  it("rejects a missing or wrong bearer token", async () => {
    const { POST } = await import("@/app/api/cron/monitor/route");
    const wrong = await POST(
      new Request("http://127.0.0.1/api/cron/monitor", {
        method: "POST",
        headers: { Authorization: "Bearer nope" },
      }),
    );
    expect(wrong.status).toBe(401);
    expect(executeScan).not.toHaveBeenCalled();
  });

  it("isolates a subscriber that throws: later subscribers still run and the failed one stays due", async () => {
    await seedThree();
    executeScan.mockImplementation(async () => {
      const call = executeScan.mock.calls.length;
      if (call === 2) throw new Error("Perplexity exploded");
      return completePayload(call === 1 ? 75 : 90);
    });
    const { POST } = await import("@/app/api/cron/monitor/route");
    const response = await POST(cronRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ran).toBe(2);
    expect(body.results.map((row: { id: string }) => row.id)).toEqual([A, C]);
    expect(body.failed).toEqual([{ id: B, error: "Perplexity exploded" }]);
    expect(body.deferred).toBe(0);
    expect(executeScan).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenCalledTimes(2);

    expect((await store.getScan(A))?.score).toBe(75);
    expect((await store.getScan(C))?.score).toBe(90);
    const failed = await store.getScan(B);
    expect(failed?.score).toBe(70);
    expect(failed?.nextRunAt).toBe("2026-11-21T12:00:00.000Z");
    // A finished subscriber moves out ~30 days; it is no longer due.
    expect(Date.parse((await store.getScan(A))?.nextRunAt ?? "")).toBeGreaterThan(Date.now());
  });

  it("keeps the new score and the rest of the run when an email send throws", async () => {
    await store.insertScan(scan(A, "2026-11-20T12:00:00.000Z"));
    await store.insertScan(scan(B, "2026-11-21T12:00:00.000Z"));
    executeScan.mockResolvedValue(completePayload(88));
    send.mockRejectedValueOnce(new Error("smtp down"));
    const { POST } = await import("@/app/api/cron/monitor/route");
    const body = await (await POST(cronRequest())).json();
    expect(body.ran).toBe(2);
    expect(body.failed).toEqual([]);
    expect(body.results.map((row: { emailed: boolean }) => row.emailed)).toEqual([false, true]);
    expect((await store.getScan(A))?.score).toBe(88);
  });

  it("stops starting scans when the route's time budget runs out and reports the deferred count", async () => {
    await seedThree();
    process.env.MONITOR_TIME_BUDGET_MS = "150";
    process.env.MONITOR_MIN_SCAN_MS = "60";
    executeScan.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
      return completePayload(81);
    });
    const { POST } = await import("@/app/api/cron/monitor/route");
    const started = Date.now();
    const body = await (await POST(cronRequest())).json();
    expect(Date.now() - started).toBeLessThan(1000);
    expect(body.ran).toBe(1);
    expect(body.budgetExhausted).toBe(true);
    expect(body.deferred).toBe(2);
    expect(executeScan).toHaveBeenCalledTimes(1);
    // Deferred subscribers stay due for tomorrow.
    expect((await store.getScan(B))?.nextRunAt).toBe("2026-11-21T12:00:00.000Z");
    expect((await store.getScan(C))?.nextRunAt).toBe("2026-11-22T12:00:00.000Z");
  });

  it("caps each scan's deadline at the time left in the budget (fake clock)", async () => {
    await seedThree();
    const base = Date.parse("2026-11-27T14:00:00.000Z");
    let clock = base;
    const deadlines: number[] = [];
    const fakeScan = vi.fn(async (_input: unknown, _q: unknown, options?: { deadlineMs?: number }) => {
      deadlines.push(options?.deadlineMs ?? -1);
      clock += 50_000; // each scan takes 50s
      return completePayload(60);
    });
    const summary = await runDueMonitors({
      store,
      appUrl: "https://twoforksstudio.com",
      intervalDays: 30,
      sendEmail: async () => ({ id: "x" }),
      scan: fakeScan as unknown as Parameters<typeof runDueMonitors>[0]["scan"],
      budgetMs: 120_000,
      minScanMs: 20_000,
      now: () => clock,
    });
    // 0s: full 120s cap. 50s: 70s left. 100s: 20s left, still >= min, so it runs with a 20s cap.
    expect(deadlines).toEqual([120_000, 70_000, 20_000]);
    expect(summary.ran).toBe(3);
    expect(summary.deferred).toBe(0);

    // Fresh store, same 50s scans, but a 25s minimum: at 100s only 20s is
    // left, so the third subscriber is deferred instead of rushed.
    store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    await seedThree();
    clock = base;
    deadlines.length = 0;
    const second = await runDueMonitors({
      store,
      appUrl: "https://twoforksstudio.com",
      intervalDays: 30,
      sendEmail: async () => ({ id: "x" }),
      scan: fakeScan as unknown as Parameters<typeof runDueMonitors>[0]["scan"],
      budgetMs: 120_000,
      minScanMs: 25_000,
      now: () => clock,
    });
    expect(deadlines).toEqual([120_000, 70_000]);
    expect(second).toMatchObject({ ran: 2, deferred: 1, due: 3, budgetExhausted: true });
    expect((await store.getScan(C))?.nextRunAt).toBe("2026-11-22T12:00:00.000Z");
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
    expect(await response.json()).toEqual({
      ran: 0,
      results: [],
      unfinished: ["33333333-3333-4333-8333-333333333333"],
      failed: [],
      deferred: 0,
      due: 1,
      budgetExhausted: false,
    });
    expect(send).not.toHaveBeenCalled();
    const saved = await store.getScan("33333333-3333-4333-8333-333333333333");
    expect(saved?.score).toBe(70);
    expect(saved?.nextRunAt).toBe("2026-11-25T12:00:00.000Z");
    expect(saved?.payload.complete).toBe(true);
  });
});
