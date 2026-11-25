import { createHash, timingSafeEqual } from "node:crypto";

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return request.headers.get("x-real-ip") || "local";
}

export function hashIp(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT || "dev-salt-change-me";
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

export function cacheHours(): number {
  const parsed = Number(process.env.CACHE_HOURS || 24);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
}

export function monitorDays(): number {
  const parsed = Number(process.env.MONITOR_INTERVAL_DAYS || 30);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}
