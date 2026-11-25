import { createHash, timingSafeEqual } from "node:crypto";
import net from "node:net";

const DEFAULT_SALT = "dev-salt-change-me";

export const RATE_LIMIT_TIME_ZONE = "America/Chicago";

export class RateLimitConfigError extends Error {
  constructor() {
    super("RATE_LIMIT_SALT is not set for production.");
    this.name = "RateLimitConfigError";
  }
}

export function rateLimitSaltConfigured(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const salt = process.env.RATE_LIMIT_SALT;
  return Boolean(salt && salt !== DEFAULT_SALT && salt !== "change-me");
}

function firstValidIp(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (net.isIP(trimmed)) return trimmed;
  return null;
}

/** Cloudflare's visitor IP is only safe when the edge actually sets this header. */
export function trustCfConnectingIp(): boolean {
  return process.env.TRUST_CF_CONNECTING_IP === "true";
}

/**
 * Client IP for rate limits.
 *
 * CF-Connecting-IP is ignored unless TRUST_CF_CONNECTING_IP=true, because a
 * caller can send that header and bypass the daily cap when Cloudflare is not
 * in front (or when a request never passed through it).
 *
 * Render keeps any client-supplied X-Forwarded-For values and appends the TCP
 * peer at the right, so the right-most valid hop is the platform-trusted
 * client. Left-most hops are client-controlled and must not be used.
 */
export function clientIp(request: Request): string {
  if (trustCfConnectingIp()) {
    const cloudflare = firstValidIp(request.headers.get("cf-connecting-ip"));
    if (cloudflare) return cloudflare;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter((part) => net.isIP(part));
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return firstValidIp(request.headers.get("x-real-ip")) || "local";
}

export function hashIp(ip: string): string {
  if (!rateLimitSaltConfigured()) throw new RateLimitConfigError();
  const salt = process.env.RATE_LIMIT_SALT || DEFAULT_SALT;
  return createHash("sha256").update(`${salt}|${ip}`).digest("hex").slice(0, 32);
}

export function appUrlFrom(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  return "http://127.0.0.1:43123";
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function dailyLimit(): number {
  const parsed = Number(process.env.RATE_LIMIT_PER_DAY || 5);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

/** Calendar day for the free-check cap, at midnight America/Chicago, not UTC. */
export function rateLimitDay(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RATE_LIMIT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Could not work out today's date in America/Chicago.");
  }
  return `${year}-${month}-${day}`;
}

export function dailyLimitReachedMessage(limit = dailyLimit()): string {
  return `That's enough free checks for today. Each connection gets ${limit} a day, so the AI bills stay small. Checks that don't finish don't count toward that limit.`;
}

/** How many unfinished attempts can be refunded toward the daily cap. */
export function unfinishedRetryLimit(): number {
  const parsed = Number(process.env.UNFINISHED_RETRY_LIMIT || 5);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

export function unfinishedRateKey(ipHash: string): string {
  return `${ipHash}:unfinished`;
}

export function shouldRefundUnfinishedAttempt(
  unfinishedCount: number,
  cap = unfinishedRetryLimit(),
): boolean {
  return unfinishedCount > 0 && unfinishedCount <= cap;
}

export function cacheHours(): number {
  const parsed = Number(process.env.CACHE_HOURS || 24);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
}

export function monitorDays(): number {
  const parsed = Number(process.env.MONITOR_INTERVAL_DAYS || 30);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}
