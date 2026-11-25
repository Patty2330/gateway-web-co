import { describe, expect, it } from "vitest";

import {
  backoffWithJitter,
  fetchWithRetry,
  isRetryableHttpStatus,
  parseRetryAfterMs,
} from "@/lib/retry";

describe("retry helpers", () => {
  it("retries 429 and transient 5xx, but not a 400", () => {
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(500)).toBe(true);
    expect(isRetryableHttpStatus(502)).toBe(true);
    expect(isRetryableHttpStatus(503)).toBe(true);
    expect(isRetryableHttpStatus(504)).toBe(true);
    expect(isRetryableHttpStatus(400)).toBe(false);
    expect(isRetryableHttpStatus(401)).toBe(false);
    expect(isRetryableHttpStatus(200)).toBe(false);
  });

  it("honors Retry-After seconds and HTTP dates, and caps the wait", () => {
    expect(parseRetryAfterMs("2", 500, Date.now(), 10_000)).toBe(2_000);
    expect(parseRetryAfterMs("30", 500, Date.now(), 10_000)).toBe(10_000);
    const later = new Date(Date.now() + 3_000).toUTCString();
    const wait = parseRetryAfterMs(later, 500, Date.now(), 10_000);
    expect(wait).toBeGreaterThan(1_000);
    expect(wait).toBeLessThanOrEqual(3_000);
  });

  it("uses exponential backoff with jitter", () => {
    const first = backoffWithJitter(0, 500, () => 0, 10_000);
    const second = backoffWithJitter(1, 500, () => 0, 10_000);
    const third = backoffWithJitter(2, 500, () => 0, 10_000);
    expect(first).toBe(500);
    expect(second).toBe(1_000);
    expect(third).toBe(2_000);
    const jittered = backoffWithJitter(0, 500, () => 1, 10_000);
    expect(jittered).toBeGreaterThan(first);
    expect(jittered).toBeLessThanOrEqual(750);
  });
});

describe("fetchWithRetry", () => {
  it("retries a 429, waits Retry-After, then returns the successful body", async () => {
    const calls: number[] = [];
    const waits: number[] = [];
    const fetchImpl: typeof fetch = async () => {
      calls.push(Date.now());
      if (calls.length === 1) {
        return new Response("rate limited", { status: 429, headers: { "Retry-After": "1" } });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const response = await fetchWithRetry(
      "https://example.com/agent",
      { method: "POST" },
      {
        timeoutMs: 1_000,
        fetchImpl,
        sleep: async (ms) => {
          waits.push(ms);
        },
        random: () => 0,
      },
    );

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(waits).toEqual([1_000]);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("retries a 503 with exponential backoff", async () => {
    const statuses: number[] = [];
    const waits: number[] = [];
    const fetchImpl: typeof fetch = async () => {
      if (statuses.length === 0) {
        statuses.push(503);
        return new Response("busy", { status: 503 });
      }
      statuses.push(200);
      return new Response("ok", { status: 200 });
    };

    const response = await fetchWithRetry("https://example.com/agent", { method: "POST" }, {
      timeoutMs: 1_000,
      fetchImpl,
      sleep: async (ms) => {
        waits.push(ms);
      },
      random: () => 0,
      baseMs: 400,
    });

    expect(response.status).toBe(200);
    expect(statuses).toEqual([503, 200]);
    expect(waits).toEqual([400]);
  });

  it("does not retry a 400", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("bad", { status: 400 });
    };
    const response = await fetchWithRetry("https://example.com/agent", { method: "POST" }, {
      timeoutMs: 1_000,
      fetchImpl,
      sleep: async () => {
        throw new Error("should not wait");
      },
    });
    expect(response.status).toBe(400);
    expect(calls).toBe(1);
  });

  it("stops when the total time budget would be exceeded", async () => {
    let now = 0;
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      now += 100;
      return new Response("slow down", { status: 429, headers: { "Retry-After": "20" } });
    };
    const response = await fetchWithRetry("https://example.com/agent", { method: "POST" }, {
      timeoutMs: 1_000,
      maxAttempts: 4,
      maxTotalMs: 500,
      maxWaitMs: 10_000,
      fetchImpl,
      now: () => now,
      sleep: async () => {
        throw new Error("should not wait past the budget");
      },
    });
    expect(response.status).toBe(429);
    expect(calls).toBe(1);
  });
});
