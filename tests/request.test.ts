import { afterEach, describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  clientIp,
  dailyLimitReachedMessage,
  hashIp,
  logScanRateLimitKey,
  normalizeRateLimitIp,
  rateLimitDay,
  runningOnRender,
  scanRateLimitLogLine,
  shouldRefundUnfinishedAttempt,
  trustCfConnectingIp,
  unfinishedRateKey,
} from "@/lib/request";

function request(headers: Record<string, string>): Request {
  return new Request("http://127.0.0.1/api/scans", { headers });
}

const previousTrust = process.env.TRUST_CF_CONNECTING_IP;
const previousRender = process.env.RENDER;

function useLocalEnv() {
  delete process.env.TRUST_CF_CONNECTING_IP;
  delete process.env.RENDER;
}

function useRenderEnv() {
  delete process.env.TRUST_CF_CONNECTING_IP;
  process.env.RENDER = "true";
}

afterEach(() => {
  if (previousTrust == null) delete process.env.TRUST_CF_CONNECTING_IP;
  else process.env.TRUST_CF_CONNECTING_IP = previousTrust;
  if (previousRender == null) delete process.env.RENDER;
  else process.env.RENDER = previousRender;
});

describe("clientIp", () => {
  it("on local/dev, ignores a spoofed CF-Connecting-IP unless the flag is on", () => {
    useLocalEnv();
    expect(runningOnRender()).toBe(false);
    expect(trustCfConnectingIp()).toBe(false);
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

  it("on Render, uses CF-Connecting-IP by default and does not use X-Forwarded-For", () => {
    useRenderEnv();
    expect(runningOnRender()).toBe(true);
    expect(trustCfConnectingIp()).toBe(true);
    expect(
      clientIp(
        request({
          "cf-connecting-ip": "203.0.113.7",
          "x-forwarded-for": "198.51.100.1, 10.0.0.2",
        }),
      ),
    ).toBe("203.0.113.7");
    expect(clientIp(request({ "cf-connecting-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    // Right-most XFF is a proxy on Render. Missing CF must not use it.
    expect(clientIp(request({ "x-forwarded-for": "198.51.100.1, 10.0.0.2" }))).toBe("local");
    process.env.TRUST_CF_CONNECTING_IP = "false";
    expect(trustCfConnectingIp()).toBe(false);
    expect(clientIp(request({ "cf-connecting-ip": "203.0.113.7" }))).toBe("local");
  });

  it("on local/dev, ignores client-controlled hops and uses the right-most X-Forwarded-For address", () => {
    useLocalEnv();
    expect(clientIp(request({ "x-forwarded-for": "1.2.3.4, 198.51.100.20" }))).toBe("198.51.100.20");
    expect(clientIp(request({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(request({ "x-forwarded-for": "198.51.100.1, 203.0.113.50" }))).toBe("203.0.113.50");
    expect(clientIp(request({ "x-forwarded-for": "198.51.100.2, 203.0.113.50" }))).toBe("203.0.113.50");
    expect(clientIp(request({ "x-forwarded-for": "198.51.100.1, 192.0.2.80:443" }))).toBe("192.0.2.80");
    expect(clientIp(request({ "x-forwarded-for": "198.51.100.1, [2001:db8::1]:443" }))).toBe("2001:db8::1");
  });

  it("does not trust X-Real-IP when X-Forwarded-For is missing", () => {
    useLocalEnv();
    expect(clientIp(request({ "x-real-ip": "192.0.2.9" }))).toBe("local");
    expect(clientIp(request({ "x-forwarded-for": "unknown", "x-real-ip": "198.18.60.1" }))).toBe("local");
    expect(clientIp(request({}))).toBe("local");
    useRenderEnv();
    expect(clientIp(request({ "x-real-ip": "192.0.2.9" }))).toBe("local");
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

describe("IPv6 rate-limit buckets", () => {
  it("counts IPv6 by the /64 prefix and maps IPv4-mapped addresses to IPv4", () => {
    expect(hashIp("2001:db8::1")).toBe(hashIp("2001:db8::2"));
    expect(hashIp("2001:db8:0:1::1")).not.toBe(hashIp("2001:db8::1"));
    expect(hashIp("::ffff:1.2.3.4")).toBe(hashIp("1.2.3.4"));

    const prefix = normalizeRateLimitIp("2001:db8::1");
    expect(prefix).toBe(normalizeRateLimitIp("2001:db8::2"));
    expect(prefix).toBe(normalizeRateLimitIp("[2001:db8::1]"));
    expect(prefix).toBe(normalizeRateLimitIp("2001:db8::1%eth0"));
    expect(prefix).toBe(normalizeRateLimitIp("2001:DB8:0:0:0:0:0:1"));
    expect(normalizeRateLimitIp("2001:db8:0:1::1")).not.toBe(prefix);
    expect(normalizeRateLimitIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
    expect(normalizeRateLimitIp("::FFFF:1.2.3.4")).toBe("1.2.3.4");
    expect(normalizeRateLimitIp("[::ffff:1.2.3.4]")).toBe("1.2.3.4");
    expect(normalizeRateLimitIp("::ffff:0102:0304")).toBe("1.2.3.4");
  });
});

describe("scan rate-limit log", () => {
  it("writes a short hash prefix and never the raw IP or the salt", () => {
    const ip = "198.51.100.20";
    const v6 = "2001:db8::1";
    const salt = process.env.RATE_LIMIT_SALT || "dev-salt-change-me";
    const lines: string[] = [];
    logScanRateLimitKey(hashIp(ip), (line) => lines.push(line));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(scanRateLimitLogLine(hashIp(ip)));
    expect(lines[0]).toMatch(/^scan rate-limit key [0-9a-f]{8}$/);
    expect(lines[0]).not.toContain(ip);
    expect(lines[0]).not.toContain(v6);
    expect(lines[0]).not.toContain(salt);
    expect(lines[0]).not.toContain(hashIp(ip));

    const v6Line = scanRateLimitLogLine(hashIp(v6));
    expect(v6Line).not.toContain(v6);
    expect(v6Line).not.toContain(salt);
    expect(v6Line).not.toContain(hashIp(v6));
  });
});

describe("TRUST_CF_CONNECTING_IP docs", () => {
  it("says Render trusts CF-Connecting-IP and that only private-network callers can fake it", () => {
    const env = readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    const agents = readFileSync(path.join(process.cwd(), "AGENTS.md"), "utf8");
    const render = readFileSync(path.join(process.cwd(), "render.yaml"), "utf8");
    for (const text of [env, agents]) {
      expect(text).toMatch(/CF-Connecting-IP/);
      expect(text).toMatch(/private-network/);
      expect(text).not.toMatch(/Render appends the real client IP at the right/);
    }
    expect(env).toMatch(/RENDER=true/);
    expect(env).toMatch(/403/);
    expect(agents).toMatch(/real host's docs or a live echo/);
    expect(render).toMatch(/TRUST_CF_CONNECTING_IP[\s\S]*value: "true"/);
  });
});
