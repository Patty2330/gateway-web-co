import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "@/lib/db";
import { UNFINISHED_CHECKOUT_MESSAGE } from "@/lib/scan-complete";
import { DEMO_CHECKOUT_DISABLED_MESSAGE } from "@/lib/stripe";
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

function post(path: string, scanId: string, headers: Record<string, string> = {}) {
  return new Request(`http://127.0.0.1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ scanId, ...emailBody }),
  });
}

function clearCheckoutEnv() {
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.ALLOW_DEMO_CHECKOUT;
  delete process.env.CHECKOUT_RATE_LIMIT_PER_DAY;
  delete process.env.APP_URL;
}

afterEach(clearCheckoutEnv);

describe("checkout rejects unfinished scans", () => {
  beforeEach(async () => {
    store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    clearCheckoutEnv();
    process.env.ALLOW_DEMO_CHECKOUT = "true";
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

describe("practice checkout needs ALLOW_DEMO_CHECKOUT=true", () => {
  const FINISHED = "66666666-6666-4666-8666-666666666666";

  beforeEach(async () => {
    store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    clearCheckoutEnv();
    vi.resetModules();
    await store.insertScan(scan(FINISHED, true));
  });

  it.each([undefined, "", "false", "1", "TRUE", "yes", " true"])(
    "rejects /api/checkout/simulate when ALLOW_DEMO_CHECKOUT is %j and STRIPE_SECRET_KEY is unset",
    async (flag) => {
      if (flag !== undefined) process.env.ALLOW_DEMO_CHECKOUT = flag;
      expect(process.env.STRIPE_SECRET_KEY).toBeUndefined();
      const { POST } = await import("@/app/api/checkout/simulate/route");
      const response = await POST(post("/api/checkout/simulate", FINISHED));
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: DEMO_CHECKOUT_DISABLED_MESSAGE });
      const saved = await store.getScan(FINISHED);
      expect(saved?.tier).toBe("free");
      expect(saved?.email).toBeNull();
    },
  );

  it("rejects /api/checkout/simulate when Stripe is configured, even with the flag on", async () => {
    process.env.ALLOW_DEMO_CHECKOUT = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_real";
    const { POST } = await import("@/app/api/checkout/simulate/route");
    const response = await POST(post("/api/checkout/simulate", FINISHED));
    expect(response.status).toBe(404);
    expect((await store.getScan(FINISHED))?.tier).toBe("free");
  });

  it("/api/checkout refuses to hand out a practice link when the flag is off and Stripe is unset", async () => {
    const { POST } = await import("@/app/api/checkout/route");
    const response = await POST(post("/api/checkout", FINISHED));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: DEMO_CHECKOUT_DISABLED_MESSAGE });
  });

  it("/api/checkout returns the practice link when the flag is on", async () => {
    process.env.ALLOW_DEMO_CHECKOUT = "true";
    process.env.APP_URL = "http://127.0.0.1:43123";
    const { POST } = await import("@/app/api/checkout/route");
    const response = await POST(post("/api/checkout", FINISHED));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { url: string };
    expect(body.url).toBe(`http://127.0.0.1:43123/checkout/demo?scan=${FINISHED}&plan=monitor`);
  });
});

describe("/api/checkout rate limit", () => {
  const FINISHED = "77777777-7777-4777-8777-777777777777";

  beforeEach(async () => {
    store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    clearCheckoutEnv();
    process.env.ALLOW_DEMO_CHECKOUT = "true";
    process.env.CHECKOUT_RATE_LIMIT_PER_DAY = "3";
    vi.resetModules();
    await store.insertScan(scan(FINISHED, true));
  });

  it("returns 429 after the daily cap for one connection, and counts each connection separately", async () => {
    const { POST } = await import("@/app/api/checkout/route");
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      statuses.push((await POST(post("/api/checkout", FINISHED, { "x-forwarded-for": "198.51.100.7" }))).status);
    }
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    const blocked = await POST(post("/api/checkout", FINISHED, { "x-forwarded-for": "198.51.100.7" }));
    expect((await blocked.json()).error).toMatch(/enough checkout tries/);

    const other = await POST(post("/api/checkout", FINISHED, { "x-forwarded-for": "198.51.100.8" }));
    expect(other.status).toBe(200);
  });

  it("counts attempts for unknown or unfinished scans too, so probing is capped", async () => {
    const { POST } = await import("@/app/api/checkout/route");
    const missing = "88888888-8888-4888-8888-888888888888";
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      statuses.push((await POST(post("/api/checkout", missing, { "x-forwarded-for": "198.51.100.9" }))).status);
    }
    expect(statuses).toEqual([404, 404, 404, 429]);
  });

  it("does not share a bucket with the free-check or leads limits", async () => {
    const { checkoutRateKey, hashIp } = await import("@/lib/request");
    const hash = hashIp("198.51.100.10");
    expect(checkoutRateKey(hash)).toBe(`${hash}:checkout`);
    expect(checkoutRateKey(hash)).not.toBe(`${hash}:lead`);
  });
});
