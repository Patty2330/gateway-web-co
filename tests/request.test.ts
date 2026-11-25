import { afterEach, describe, expect, it } from "vitest";

import {
  clientIp,
  dailyLimitReachedMessage,
  rateLimitDay,
  shouldRefundUnfinishedAttempt,
  unfinishedRateKey,
} from "@/lib/request";

function request(headers: Record<string, string>): Request {
  return new Request("http://127.0.0.1/api/scans", { headers });
}

const previousTrust = process.env.TRUST_CF_CONNECTING_IP;

afterEach(() => {
  if (previousTrust == null) delete process.env.TRUST_CF_CONNECTING_IP;
  else process.env.TRUST_CF_CONNECTING_IP = previousTrust;
});

describe("clientIp", () => {
  it("ignores a spoofed CF-Connecting-IP unless TRUST_CF_CONNECTING_IP=true", () => {
    delete process.env.TRUST_CF_CONNECTING_IP;
    // Repro from /workspace/reviews/gw-pr5/responses/r2/m-cf-spoof.txt:
    // two different CF-Connecting-IP values must share the same rate-limit IP.
    expect(clientIp(request({ "cf-connecting-ip": "203.0.113.7" }))).toBe("local");
    expect(clientIp(request({ "cf-connecting-ip": "203.0.113.8" }))).toBe("local");
    expect(
      clientIp(
        request({
          "cf-connecting-ip": "203.0.113.7",
          "x-forwarded-for": "198.51.100.1, 192.0.2.80",
        }),
      ),
    ).toBe("192.0.2.80");
    expect(
      clientIp(
        request({
          "cf-connecting-ip": "203.0.113.8",
          "x-forwarded-for": "198.51.100.2, 192.0.2.80",
        }),
      ),
    ).toBe("192.0.2.80");

    process.env.TRUST_CF_CONNECTING_IP = "true";
    expect(
      clientIp(
        request({
          "cf-connecting-ip": "203.0.113.7",
          "x-forwarded-for": "198.51.100.1, 192.0.2.80",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  it("ignores client-controlled hops and uses the right-most X-Forwarded-For address", () => {
    delete process.env.TRUST_CF_CONNECTING_IP;
    expect(clientIp(request({ "x-forwarded-for": "1.2.3.4, 198.51.100.20" }))).toBe("198.51.100.20");
    expect(clientIp(request({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
    // Same spoof headers as the PR #5 repro still collapse to the right-most hop.
    expect(clientIp(request({ "x-forwarded-for": "198.51.100.1, 203.0.113.50" }))).toBe("203.0.113.50");
    expect(clientIp(request({ "x-forwarded-for": "198.51.100.2, 203.0.113.50" }))).toBe("203.0.113.50");
  });

  it("falls back to x-real-ip or local", () => {
    expect(clientIp(request({ "x-real-ip": "192.0.2.9" }))).toBe("192.0.2.9");
    expect(clientIp(request({}))).toBe("local");
  });
});

describe("rateLimitDay", () => {
  it("resets at midnight America/Chicago, not UTC", () => {
    // 5:30 UTC on Nov 26, 2026 is 11:30 PM CST on Nov 25.
    expect(rateLimitDay(new Date("2026-11-26T05:30:00.000Z"))).toBe("2026-11-25");
    // Midnight CST is 06:00 UTC.
    expect(rateLimitDay(new Date("2026-11-26T06:00:00.000Z"))).toBe("2026-11-26");
    // 4:30 UTC on Jun 15, 2026 is 11:30 PM CDT on Jun 14.
    expect(rateLimitDay(new Date("2026-06-15T04:30:00.000Z"))).toBe("2026-06-14");
    // Midnight CDT is 05:00 UTC.
    expect(rateLimitDay(new Date("2026-06-15T05:00:00.000Z"))).toBe("2026-06-15");
  });
});

describe("dailyLimitReachedMessage", () => {
  it("mentions that unfinished checks do not count", () => {
    const message = dailyLimitReachedMessage(5);
    expect(message).toMatch(/5 a day/);
    expect(message).toMatch(/don'?t count|do not count|unfinished/i);
  });
});

describe("unfinished rate-limit refunds", () => {
  it("refunds only while the unfinished retry count is within the cap", () => {
    expect(unfinishedRateKey("abc")).toBe("abc:unfinished");
    expect(shouldRefundUnfinishedAttempt(0, 5)).toBe(false);
    expect(shouldRefundUnfinishedAttempt(1, 5)).toBe(true);
    expect(shouldRefundUnfinishedAttempt(5, 5)).toBe(true);
    expect(shouldRefundUnfinishedAttempt(6, 5)).toBe(false);
  });
});
