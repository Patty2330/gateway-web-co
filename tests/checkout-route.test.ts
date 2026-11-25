import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "@/lib/db";
import { UNFINISHED_CHECKOUT_MESSAGE } from "@/lib/scan-complete";
import type { ScanPayload, ScanRecord } from "@/lib/types";

let store: Awaited<ReturnType<typeof createStore>>;

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getStore: async () => store };
});

function payload(complete: boolean): ScanPayload {
  const usable = complete ? 8 : 1;
  const answers = Array.from({ length: 8 }, (_, index) => ({
    questionId: `q${index + 1}`,
    question: "What is the best plumber in Clarksville, TN?",
    providerId: "perplexity" as const,
    providerName: "Perplexity",
    demo: false,
    text: index < usable ? "1. Harper's Plumbing — named." : "",
    mentioned: index < usable,
    rank: index < usable ? 1 : null,
    competitors: [],
    sources: [],
    error: index < usable ? undefined : "The check ran out of time.",
    points: index < usable ? 100 : 0,
  }));
  return {
    questions: [],
    answers,
    competitors: [],
    findings: [],
    siteCheck: null,
    score: complete ? 80 : null,
    mentionCount: usable,
    answerCount: usable,
    complete,
    providers: [{ id: "perplexity", name: "Perplexity", demo: false, mentions: usable, answers: usable, errors: 8 - usable }],
  };
}

function scan(id: string, complete: boolean): ScanRecord {
  const now = "2026-11-25T12:00:00.000Z";
  const body = payload(complete);
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
    mode: "live",
    cacheKey: "k",
    score: body.score,
    tier: "free",
    email: null,
    stripeSessionId: null,
    stripeSubscriptionId: null,
    nextRunAt: null,
    previousScore: null,
    payload: body,
  };
}

const emailBody = {
  plan: "monitor",
  email: "qa@example.com",
};

describe("checkout rejects unfinished scans", () => {
  beforeEach(async () => {
    store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();
  });

  it("returns 409 from /api/checkout and does not start payment", async () => {
    await store.insertScan(scan("11111111-1111-4111-8111-111111111111", false));
    const { POST } = await import("@/app/api/checkout/route");
    const response = await POST(
      new Request("http://127.0.0.1/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: "11111111-1111-4111-8111-111111111111", ...emailBody }),
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: UNFINISHED_CHECKOUT_MESSAGE });
    const saved = await store.getScan("11111111-1111-4111-8111-111111111111");
    expect(saved?.tier).toBe("free");
  });

  it("returns 409 from /api/checkout/simulate and does not mark the check paid", async () => {
    await store.insertScan(scan("22222222-2222-4222-8222-222222222222", false));
    const { POST } = await import("@/app/api/checkout/simulate/route");
    const response = await POST(
      new Request("http://127.0.0.1/api/checkout/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: "22222222-2222-4222-8222-222222222222", ...emailBody }),
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: UNFINISHED_CHECKOUT_MESSAGE });
    const saved = await store.getScan("22222222-2222-4222-8222-222222222222");
    expect(saved?.tier).toBe("free");
    expect(saved?.email).toBeNull();
  });

  it("marks a finished check paid on /api/checkout/simulate", async () => {
    await store.insertScan(scan("44444444-4444-4444-8444-444444444444", true));
    const { POST } = await import("@/app/api/checkout/simulate/route");
    const response = await POST(
      new Request("http://127.0.0.1/api/checkout/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: "44444444-4444-4444-8444-444444444444", ...emailBody }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ id: "44444444-4444-4444-8444-444444444444", tier: "monitor" });
    const saved = await store.getScan("44444444-4444-4444-8444-444444444444");
    expect(saved?.tier).toBe("monitor");
    expect(saved?.email).toBe("qa@example.com");
  });
});
