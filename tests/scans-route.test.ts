import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "@/lib/db";
import { dailyLimit, dailyLimitReachedMessage, hashIp, rateLimitDay, unfinishedRateKey } from "@/lib/request";
import type { ScanPayload } from "@/lib/types";

let store: Awaited<ReturnType<typeof createStore>>;
const executeScan = vi.fn();

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getStore: async () => store };
});

vi.mock("@/lib/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine")>();
  return { ...actual, executeScan: (...args: unknown[]) => executeScan(...args) };
});

function unfinishedPayload(): ScanPayload {
  return {
    questions: [],
    answers: Array.from({ length: 8 }, (_, index) => ({
      questionId: `q${index + 1}`,
      question: "q",
      providerId: "perplexity",
      providerName: "Perplexity",
      demo: false,
      text: "",
      mentioned: false,
      rank: null,
      competitors: [],
      sources: [],
      error: "Perplexity returned 429.",
      points: 0,
    })),
    competitors: [],
    findings: [],
    siteCheck: null,
    score: null,
    mentionCount: 0,
    answerCount: 0,
    complete: false,
    providers: [{ id: "perplexity", name: "Perplexity", demo: false, mentions: 0, answers: 0, errors: 8 }],
  };
}

function completePayload(): ScanPayload {
  const payload = unfinishedPayload();
  return {
    ...payload,
    answers: payload.answers.map((answer) => ({ ...answer, error: undefined, text: "1. A — ok", mentioned: true, rank: 1, points: 100 })),
    score: 100,
    mentionCount: 8,
    answerCount: 8,
    complete: true,
    providers: [{ id: "perplexity", name: "Perplexity", demo: false, mentions: 8, answers: 8, errors: 0 }],
  };
}

async function postScan(name: string, websiteUrl?: string) {
  const { POST } = await import("@/app/api/scans/route");
  return POST(
    new Request("http://127.0.0.1/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: name,
        category: "restaurant",
        city: "Clarksville",
        state: "TN",
        websiteUrl,
      }),
    }),
  );
}

describe("POST /api/scans", () => {
  beforeEach(async () => {
    store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    executeScan.mockReset();
    vi.resetModules();
  });

  it("returns 400 for a website that is not a valid DNS name", async () => {
    const response = await postScan("Test Business", "!!!");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "That website address doesn't look right." });
    expect(executeScan).not.toHaveBeenCalled();
  });

  it("refunds the daily cap for unfinished checks, then stops refunding after the unfinished retry cap", async () => {
    executeScan.mockResolvedValue(unfinishedPayload());
    const ip = hashIp("local");
    const day = rateLimitDay();
    const cap = dailyLimit();

    for (let index = 0; index < cap; index++) {
      const response = await postScan(`Unfinished Shop ${index}`);
      expect(response.status).toBe(200);
    }
    expect(await store.consumeRateLimit(ip, day)).toBe(1);
    await store.refundRateLimit(ip, day);

    for (let index = 0; index < cap; index++) {
      const response = await postScan(`Unfinished Extra ${index}`);
      expect(response.status).toBe(200);
    }

    const blocked = await postScan("Unfinished Overflow");
    expect(blocked.status).toBe(429);
    expect(await store.consumeRateLimit(unfinishedRateKey(ip), day)).toBeGreaterThan(cap);
  });

  it("still counts a finished check toward the daily cap", async () => {
    executeScan.mockResolvedValue(completePayload());
    const day = rateLimitDay();
    for (let index = 0; index < dailyLimit(); index++) {
      const response = await postScan(`Finished Shop ${index}`);
      expect(response.status).toBe(200);
    }
    const blocked = await postScan("Finished Overflow");
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: dailyLimitReachedMessage() });
    expect(dailyLimitReachedMessage()).toMatch(/don't count toward that limit/);
    expect(await store.consumeRateLimit(hashIp("local"), day)).toBe(dailyLimit() + 2);
  });

  it("logs a short rate-limit key and never the raw IP or the salt", async () => {
    executeScan.mockResolvedValue(completePayload());
    const ip = "198.51.100.20";
    const salt = process.env.RATE_LIMIT_SALT || "dev-salt-change-me";
    const lines: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((message, ...rest) => {
      lines.push([message, ...rest].map(String).join(" "));
    });
    const { POST } = await import("@/app/api/scans/route");
    const response = await POST(
      new Request("http://127.0.0.1/api/scans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": ip,
        },
        body: JSON.stringify({
          businessName: "Log Shop",
          category: "restaurant",
          city: "Clarksville",
          state: "TN",
        }),
      }),
    );
    spy.mockRestore();
    expect(response.status).toBe(200);
    const joined = lines.join("\n");
    expect(joined).toMatch(/scan rate-limit key [0-9a-f]{8}/);
    expect(joined).not.toContain(ip);
    expect(joined).not.toContain(salt);
  });
});
