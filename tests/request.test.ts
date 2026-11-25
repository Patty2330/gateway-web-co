import { describe, expect, it } from "vitest";

import { clientIp, shouldRefundUnfinishedAttempt, unfinishedRateKey } from "@/lib/request";

function request(headers: Record<string, string>): Request {
  return new Request("http://127.0.0.1/api/scans", { headers });
}

describe("clientIp", () => {
  it("prefers Cloudflare's connecting IP when present", () => {
    expect(
      clientIp(
        request({
          "cf-connecting-ip": "203.0.113.10",
          "x-forwarded-for": "1.2.3.4, 203.0.113.10, 10.0.0.2",
        }),
      ),
    ).toBe("203.0.113.10");
  });

  it("ignores client-controlled hops and uses the right-most X-Forwarded-For address", () => {
    expect(clientIp(request({ "x-forwarded-for": "1.2.3.4, 198.51.100.20" }))).toBe("198.51.100.20");
    expect(clientIp(request({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip or local", () => {
    expect(clientIp(request({ "x-real-ip": "192.0.2.9" }))).toBe("192.0.2.9");
    expect(clientIp(request({}))).toBe("local");
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
