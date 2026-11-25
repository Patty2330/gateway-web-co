import { afterEach, describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  clientIp,
  dailyLimitReachedMessage,
  hashIp,
  leadsDailyLimitReachedMessage,
  logMissingCfConnectingIp,
  logScanRateLimitKey,
  MISSING_CF_CONNECTING_IP_WARNING,
  MISSING_CF_WARNING_INTERVAL_MS,
  normalizeRateLimitIp,
  parseIpv6Hextets,
  rateLimitDay,
  resetMissingCfConnectingIpWarning,
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
  resetMissingCfConnectingIpWarning();
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

  it("groups embedded-IPv4 addresses after '::' by /64, including 64:ff9b::1.2.3.4 and ::1.2.3.4", () => {
    expect(parseIpv6Hextets("64:ff9b::1.2.3.4")).toEqual([
      0x64, 0xff9b, 0, 0, 0, 0, 0x0102, 0x0304,
    ]);
    expect(parseIpv6Hextets("::1.2.3.4")).toEqual([0, 0, 0, 0, 0, 0, 0x0102, 0x0304]);

    const nat64 = normalizeRateLimitIp("64:ff9b::1.2.3.4");
    expect(nat64).toMatch(/\/64$/);
    expect(nat64).toBe(normalizeRateLimitIp("64:ff9b::5.6.7.8"));
    expect(nat64).toBe(normalizeRateLimitIp("[64:ff9b::1.2.3.4]"));
    expect(nat64).toBe(normalizeRateLimitIp("64:ff9b::1.2.3.4%eth0"));
    expect(nat64).toBe(normalizeRateLimitIp("64:FF9B::1.2.3.4"));
    expect(hashIp("64:ff9b::1.2.3.4")).toBe(hashIp("64:ff9b::5.6.7.8"));
    expect(normalizeRateLimitIp("64:ff9b:0:1::1.2.3.4")).not.toBe(nat64);

    const compact = normalizeRateLimitIp("::1.2.3.4");
    expect(compact).toMatch(/\/64$/);
    expect(compact).toBe(normalizeRateLimitIp("::5.6.7.8"));
    expect(compact).toBe(normalizeRateLimitIp("[::1.2.3.4]"));
    expect(compact).toBe(normalizeRateLimitIp("::1.2.3.4%eth0"));
    expect(compact).toBe(normalizeRateLimitIp("::1.2.3.4"));
    expect(hashIp("::1.2.3.4")).toBe(hashIp("::5.6.7.8"));

    // Existing cases still hold: ::ffff maps to IPv4; brackets, zone ids, and case do not change the bucket.
    expect(normalizeRateLimitIp("::ffff:1.2.3.4")).toBe("1.2.3.4");
    expect(normalizeRateLimitIp("::FFFF:1.2.3.4")).toBe("1.2.3.4");
    expect(normalizeRateLimitIp("[::ffff:1.2.3.4]")).toBe("1.2.3.4");
    expect(normalizeRateLimitIp("::ffff:1.2.3.4%eth0")).toBe("1.2.3.4");
    const prefix = normalizeRateLimitIp("2001:db8::1");
    expect(prefix).toBe(normalizeRateLimitIp("[2001:db8::1]"));
    expect(prefix).toBe(normalizeRateLimitIp("2001:db8::1%eth0"));
    expect(prefix).toBe(normalizeRateLimitIp("2001:DB8::1"));
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
    expect(env).toMatch(/TRUST_CF_CONNECTING_IP=false/);
    expect(env).toMatch(/shared daily count/);
    expect(agents).toMatch(/real host's docs or a live echo/);
    expect(render).toMatch(/TRUST_CF_CONNECTING_IP[\s\S]*value: "true"/);
  });
});

describe("missing CF-Connecting-IP warning", () => {
  it("logs one throttled warning with no IP when Render falls back to the shared local bucket", () => {
    useRenderEnv();
    const spoofed = "198.51.100.1";
    const lines: string[] = [];
    const write = (line: string) => lines.push(line);

    expect(clientIp(request({ "x-forwarded-for": spoofed, "x-real-ip": "192.0.2.9" }))).toBe("local");
    expect(clientIp(request({ "cf-connecting-ip": "not-an-ip" }))).toBe("local");

    resetMissingCfConnectingIpWarning();
    expect(logMissingCfConnectingIp(write, 1_000)).toBe(true);
    expect(logMissingCfConnectingIp(write, 1_000 + 1_000)).toBe(false);
    expect(logMissingCfConnectingIp(write, 1_000 + MISSING_CF_WARNING_INTERVAL_MS)).toBe(true);
    expect(lines).toEqual([
      MISSING_CF_CONNECTING_IP_WARNING,
      MISSING_CF_CONNECTING_IP_WARNING,
    ]);
    expect(MISSING_CF_CONNECTING_IP_WARNING).toMatch(/shared local/);
    expect(MISSING_CF_CONNECTING_IP_WARNING).not.toMatch(/\d{1,3}(?:\.\d{1,3}){3}/);
    for (const line of lines) {
      expect(line).not.toContain(spoofed);
      expect(line).not.toContain("192.0.2.9");
      expect(line).toBe(MISSING_CF_CONNECTING_IP_WARNING);
    }

    const warnings: string[] = [];
    const spy = {
      warn: console.warn,
    };
    console.warn = ((message?: unknown, ...rest: unknown[]) => {
      warnings.push([message, ...rest].map(String).join(" "));
    }) as typeof console.warn;
    try {
      resetMissingCfConnectingIpWarning();
      expect(clientIp(request({ "x-forwarded-for": spoofed }))).toBe("local");
      expect(clientIp(request({ "x-forwarded-for": "203.0.113.8" }))).toBe("local");
      expect(warnings).toEqual([MISSING_CF_CONNECTING_IP_WARNING]);
      expect(warnings[0]).not.toContain(spoofed);
      expect(warnings[0]).not.toContain("203.0.113.8");
      expect(clientIp(request({ "cf-connecting-ip": "203.0.113.7" }))).toBe("203.0.113.7");
      expect(warnings).toHaveLength(1);
    } finally {
      console.warn = spy.warn;
    }
  });

  it("does not warn off Render when CF-Connecting-IP is missing", () => {
    useLocalEnv();
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = ((message?: unknown, ...rest: unknown[]) => {
      warnings.push([message, ...rest].map(String).join(" "));
    }) as typeof console.warn;
    try {
      expect(clientIp(request({}))).toBe("local");
      expect(warnings).toEqual([]);
    } finally {
      console.warn = original;
    }
  });
});

describe("leadsDailyLimitReachedMessage", () => {
  it("uses the approved wording", () => {
    const message = leadsDailyLimitReachedMessage();
    expect(message).toBe(
      "That's enough notes for today. Jalen at Two Forks Studio will see the ones you already sent.",
    );
    expect(message).not.toContain("gatewaywebco@gmail.com");
  });
});
