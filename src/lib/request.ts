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

/**
 * Drop brackets, an optional :port, and a trailing IPv6 zone id (%eth0 or %25eth0).
 * Unbracketed IPv6 is left alone: 2001:db8::1:443 is a real address, not a port.
 */
export function stripIpDecorations(raw: string): string {
  let value = raw.trim();
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    if (end > 0) value = value.slice(1, end);
  } else {
    const ipv4Port = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d+)$/;
    const match = value.match(ipv4Port);
    if (match && net.isIP(match[1]) === 4) value = match[1];
  }
  const zone = value.lastIndexOf("%");
  if (zone > 0 && net.isIP(value.slice(0, zone)) === 6) {
    value = value.slice(0, zone);
  }
  return value;
}

function firstValidIp(value: string | null): string | null {
  if (!value) return null;
  const cleaned = stripIpDecorations(value);
  if (net.isIP(cleaned)) return cleaned;
  return null;
}

function parseHextet(group: string): number | null {
  if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
  return Number.parseInt(group, 16);
}

function parseIpv4Octets(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    octets.push(octet);
  }
  return octets;
}

/** Expand IPv6, including :: shorthand and a dotted or hex IPv4 tail. */
export function parseIpv6Hextets(ip: string): number[] | null {
  const cleaned = stripIpDecorations(ip).toLowerCase();
  if (cleaned.includes(":::")) return null;

  let raw = cleaned;
  let ipv4Tail: number[] | null = null;
  const lastColon = raw.lastIndexOf(":");
  const maybeV4 = lastColon >= 0 ? raw.slice(lastColon + 1) : "";
  if (maybeV4.includes(".")) {
    ipv4Tail = parseIpv4Octets(maybeV4);
    if (!ipv4Tail) return null;
    raw = raw.slice(0, lastColon);
  }

  const sides = raw.split("::");
  if (sides.length > 2) return null;

  const parseSide = (side: string): number[] | null => {
    if (side === "") return [];
    const groups = side.split(":");
    const out: number[] = [];
    for (const group of groups) {
      const hextet = parseHextet(group);
      if (hextet == null) return null;
      out.push(hextet);
    }
    return out;
  };

  let hextets: number[];
  if (sides.length === 1) {
    const groups = parseSide(sides[0]);
    if (!groups) return null;
    hextets = groups;
  } else {
    const left = parseSide(sides[0]);
    const right = parseSide(sides[1]);
    if (!left || !right) return null;
    const missing = 8 - left.length - right.length - (ipv4Tail ? 2 : 0);
    if (missing < 1) return null;
    hextets = [...left, ...Array(missing).fill(0), ...right];
  }

  if (ipv4Tail) {
    hextets.push((ipv4Tail[0] << 8) + ipv4Tail[1], (ipv4Tail[2] << 8) + ipv4Tail[3]);
  }
  if (hextets.length !== 8) return null;
  return hextets;
}

function ipv4MappedAddress(hextets: number[]): string | null {
  if (hextets.slice(0, 5).every((part) => part === 0) && hextets[5] === 0xffff) {
    const first = hextets[6];
    const second = hextets[7];
    return `${first >> 8}.${first & 0xff}.${second >> 8}.${second & 0xff}`;
  }
  return null;
}

function formatIpv6Hextets(hextets: number[]): string {
  return hextets.map((part) => part.toString(16)).join(":");
}

/**
 * Address used as the rate-limit bucket.
 * IPv6 is counted by its /64 prefix so rotating the interface id cannot
 * bypass the daily cap. IPv4-mapped addresses such as ::ffff:1.2.3.4
 * become 1.2.3.4 before hashing.
 */
export function normalizeRateLimitIp(ip: string): string {
  if (ip === "local") return "local";
  const cleaned = stripIpDecorations(ip);
  if (net.isIP(cleaned) === 4) return cleaned;
  const hextets = parseIpv6Hextets(cleaned);
  if (!hextets) return cleaned;
  const mapped = ipv4MappedAddress(hextets);
  if (mapped) return mapped;
  return `${formatIpv6Hextets([...hextets.slice(0, 4), 0, 0, 0, 0])}/64`;
}

export const RATE_LIMIT_LOG_PREFIX_LENGTH = 8;

/** One log line for a scan request. Never includes the raw IP or the salt. */
export function scanRateLimitLogLine(ipHash: string): string {
  return `scan rate-limit key ${ipHash.slice(0, RATE_LIMIT_LOG_PREFIX_LENGTH)}`;
}

export function logScanRateLimitKey(
  ipHash: string,
  write: (line: string) => void = (line) => {
    console.info(line);
  },
): void {
  write(scanRateLimitLogLine(ipHash));
}

/** Render sets RENDER=true on its services. */
export function runningOnRender(): boolean {
  return process.env.RENDER === "true";
}

/**
 * Trust CF-Connecting-IP on Render by default, or when the env flag is "true".
 * Set TRUST_CF_CONNECTING_IP=false to turn that default off.
 * On public Render traffic, Cloudflare sets this header and rejects a
 * client-supplied value (HTTP 403, error 1000). Private-network callers
 * bypass Cloudflare and can fake it.
 */
export function trustCfConnectingIp(): boolean {
  const flag = process.env.TRUST_CF_CONNECTING_IP;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return runningOnRender();
}

/**
 * Client IP for rate limits.
 *
 * On Render, use CF-Connecting-IP. The right-most X-Forwarded-For hop there
 * is a proxy (Cloudflare, then the Render load balancer), so using it would
 * put every visitor in one bucket. X-Forwarded-For is only read for local/dev.
 * X-Real-IP is never trusted.
 */
export function clientIp(request: Request): string {
  if (trustCfConnectingIp()) {
    const cloudflare = firstValidIp(request.headers.get("cf-connecting-ip"));
    if (cloudflare) return cloudflare;
  }

  if (!runningOnRender()) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const hops = forwarded
        .split(",")
        .map((part) => firstValidIp(part))
        .filter((part): part is string => Boolean(part));
      if (hops.length > 0) return hops[hops.length - 1];
    }
  }

  return "local";
}

export function hashIp(ip: string): string {
  if (!rateLimitSaltConfigured()) throw new RateLimitConfigError();
  const salt = process.env.RATE_LIMIT_SALT || DEFAULT_SALT;
  const bucket = normalizeRateLimitIp(ip);
  return createHash("sha256").update(`${salt}|${bucket}`).digest("hex").slice(0, 32);
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
