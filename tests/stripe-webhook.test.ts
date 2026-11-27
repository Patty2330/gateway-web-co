import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "@/lib/db";
import type { ScanPayload, ScanRecord } from "@/lib/types";

let store: Awaited<ReturnType<typeof createStore>>;
const constructEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getStore: async () => store };
});

vi.mock("@/lib/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe")>();
  return {
    ...actual,
    getStripe: () => ({ webhooks: { constructEvent: (...args: unknown[]) => constructEvent(...args) } }),
  };
});

const SCAN = "55555555-5555-4555-8555-555555555555";
const SUB = "sub_watch_1";

function payload(): ScanPayload {
  return {
    questions: [],
    answers: Array.from({ length: 8 }, (_, index) => ({
      questionId: `q${index + 1}`,
      question: "Best plumber?",
      providerId: "perplexity" as const,
      providerName: "Perplexity",
      demo: false,
      text: "1. Harper's Plumbing",
      mentioned: true,
      rank: 1,
      competitors: [],
      sources: [],
      points: 100,
    })),
    competitors: [],
    findings: [],
    siteCheck: null,
    score: 80,
    mentionCount: 8,
    answerCount: 8,
    complete: true,
    providers: [{ id: "perplexity", name: "Perplexity", demo: false, mentions: 8, answers: 8, errors: 0 }],
  };
}

function scan(overrides: Partial<ScanRecord> = {}): ScanRecord {
  const now = "2026-11-25T12:00:00.000Z";
  return {
    id: SCAN,
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
    score: 80,
    tier: "free",
    email: null,
    stripeSessionId: null,
    stripeSubscriptionId: null,
    nextRunAt: null,
    previousScore: null,
    payload: payload(),
    ...overrides,
  };
}

function monitorScan(nextRunAt: string | null = "2026-12-25T12:00:00.000Z") {
  return scan({ tier: "monitor", email: "owner@example.com", stripeSubscriptionId: SUB, nextRunAt });
}

async function deliver(event: { type: string; data: { object: unknown } }) {
  constructEvent.mockReturnValue({ id: "evt_1", ...event });
  const { POST } = await import("@/app/api/stripe/webhook/route");
  return POST(
    new Request("http://127.0.0.1/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=fake" },
      body: JSON.stringify(event),
    }),
  );
}

describe("Stripe webhook", () => {
  beforeEach(async () => {
    store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    constructEvent.mockReset();
    process.env.STRIPE_SECRET_KEY = "sk_test_webhook";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("rejects a bad signature without touching the store", async () => {
    await store.insertScan(scan());
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://127.0.0.1/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=bad" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(400);
    expect((await store.getScan(SCAN))?.tier).toBe("free");
  });

  describe("checkout.session.async_payment_succeeded", () => {
    it("unlocks the report once a delayed payment clears", async () => {
      await store.insertScan(scan());
      const response = await deliver({
        type: "checkout.session.async_payment_succeeded",
        data: {
          object: {
            id: "cs_async_report",
            payment_status: "paid",
            metadata: { scanId: SCAN, plan: "report", email: "owner@example.com" },
            customer_details: { email: "owner@example.com" },
            subscription: null,
          },
        },
      });
      expect(response.status).toBe(200);
      const saved = await store.getScan(SCAN);
      expect(saved?.tier).toBe("report");
      expect(saved?.email).toBe("owner@example.com");
      expect(saved?.stripeSessionId).toBe("cs_async_report");
    });

    it("activates the monitor with its subscription id", async () => {
      await store.insertScan(scan());
      await deliver({
        type: "checkout.session.async_payment_succeeded",
        data: {
          object: {
            id: "cs_async_monitor",
            payment_status: "paid",
            metadata: { scanId: SCAN, plan: "monitor" },
            customer_details: { email: "owner@example.com" },
            subscription: { id: SUB },
          },
        },
      });
      const saved = await store.getScan(SCAN);
      expect(saved?.tier).toBe("monitor");
      expect(saved?.stripeSubscriptionId).toBe(SUB);
      expect(saved?.nextRunAt).not.toBeNull();
    });

    it("does not unlock anything while the payment is still unpaid", async () => {
      await store.insertScan(scan());
      for (const type of ["checkout.session.completed", "checkout.session.async_payment_succeeded"]) {
        await deliver({
          type,
          data: { object: { id: "cs_pending", payment_status: "unpaid", metadata: { scanId: SCAN, plan: "report" } } },
        });
      }
      expect((await store.getScan(SCAN))?.tier).toBe("free");
    });
  });

  describe("invoice.payment_failed", () => {
    it("pauses the monitor (new API shape: parent.subscription_details)", async () => {
      await store.insertScan(monitorScan());
      await deliver({
        type: "invoice.payment_failed",
        data: { object: { id: "in_1", parent: { subscription_details: { subscription: SUB } } } },
      });
      const saved = await store.getScan(SCAN);
      expect(saved?.nextRunAt).toBeNull();
      expect(await store.dueMonitors("2099-01-01T00:00:00.000Z")).toEqual([]);
      // Kept so it can resume, and the one-time report access is not taken away.
      expect(saved?.tier).toBe("monitor");
      expect(saved?.stripeSubscriptionId).toBe(SUB);
    });

    it("pauses the monitor (legacy top-level invoice.subscription)", async () => {
      await store.insertScan(monitorScan());
      await deliver({ type: "invoice.payment_failed", data: { object: { id: "in_2", subscription: SUB } } });
      expect((await store.getScan(SCAN))?.nextRunAt).toBeNull();
    });

    it("ignores invoices for other subscriptions or with none", async () => {
      await store.insertScan(monitorScan());
      await deliver({ type: "invoice.payment_failed", data: { object: { id: "in_3", subscription: "sub_other" } } });
      await deliver({ type: "invoice.payment_failed", data: { object: { id: "in_4", parent: null } } });
      expect((await store.getScan(SCAN))?.nextRunAt).toBe("2026-12-25T12:00:00.000Z");
    });
  });

  describe("customer.subscription.updated", () => {
    it.each(["past_due", "unpaid"])("pauses the monitor when status is %s", async (status) => {
      await store.insertScan(monitorScan());
      await deliver({ type: "customer.subscription.updated", data: { object: { id: SUB, status } } });
      const saved = await store.getScan(SCAN);
      expect(saved?.nextRunAt).toBeNull();
      expect(saved?.tier).toBe("monitor");
    });

    it("ends the monitor when status is canceled, keeping the report", async () => {
      await store.insertScan(monitorScan());
      await deliver({ type: "customer.subscription.updated", data: { object: { id: SUB, status: "canceled" } } });
      const saved = await store.getScan(SCAN);
      expect(saved?.tier).toBe("report");
      expect(saved?.nextRunAt).toBeNull();
      expect(saved?.stripeSubscriptionId).toBeNull();
    });

    it("reactivates a paused monitor when status returns to active, due right away", async () => {
      await store.insertScan(monitorScan());
      await deliver({ type: "customer.subscription.updated", data: { object: { id: SUB, status: "past_due" } } });
      expect((await store.getScan(SCAN))?.nextRunAt).toBeNull();
      const before = Date.now();
      await deliver({ type: "customer.subscription.updated", data: { object: { id: SUB, status: "active" } } });
      const saved = await store.getScan(SCAN);
      expect(saved?.tier).toBe("monitor");
      expect(Date.parse(saved?.nextRunAt ?? "")).toBeGreaterThanOrEqual(before - 1000);
      expect(Date.parse(saved?.nextRunAt ?? "")).toBeLessThanOrEqual(Date.now() + 1000);
      expect(await store.dueMonitors(new Date(Date.now() + 1000).toISOString())).toHaveLength(1);
    });

    it("keeps an already scheduled monitor's date when status is active", async () => {
      await store.insertScan(monitorScan("2026-12-25T12:00:00.000Z"));
      await deliver({ type: "customer.subscription.updated", data: { object: { id: SUB, status: "active" } } });
      expect((await store.getScan(SCAN))?.nextRunAt).toBe("2026-12-25T12:00:00.000Z");
    });

    it("does not turn a report-only check into a monitor on active", async () => {
      await store.insertScan(scan({ tier: "report", stripeSubscriptionId: SUB }));
      await deliver({ type: "customer.subscription.updated", data: { object: { id: SUB, status: "active" } } });
      const saved = await store.getScan(SCAN);
      expect(saved?.tier).toBe("report");
      expect(saved?.nextRunAt).toBeNull();
    });
  });
});
