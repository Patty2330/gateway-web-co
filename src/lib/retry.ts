import { fetchWithTimeout } from "@/lib/http";

export const DEFAULT_MAX_ATTEMPTS = 4;
export const DEFAULT_MAX_TOTAL_MS = 40_000;
export const DEFAULT_MAX_WAIT_MS = 10_000;
export const DEFAULT_BASE_MS = 500;

export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export function isRetryableNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    /failed to fetch|network|econnreset|etimedout|aborted|socket/i.test(message)
  );
}

/** Read Retry-After as seconds or an HTTP date. Cap the wait so one 429 cannot stall the scan. */
export function parseRetryAfterMs(
  header: string | null,
  fallbackMs: number,
  nowMs = Date.now(),
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
): number {
  if (!header?.trim()) return Math.min(Math.max(0, fallbackMs), maxWaitMs);
  const raw = header.trim();
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, maxWaitMs);
  }
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) {
    return Math.min(Math.max(0, date - nowMs), maxWaitMs);
  }
  return Math.min(Math.max(0, fallbackMs), maxWaitMs);
}

/** Exponential backoff with jitter. `attempt` is 0 for the first retry after a failure. */
export function backoffWithJitter(
  attempt: number,
  baseMs = DEFAULT_BASE_MS,
  random: () => number = Math.random,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
): number {
  const exp = Math.min(maxWaitMs, baseMs * 2 ** Math.max(0, attempt));
  const jitter = random() * exp * 0.5;
  return Math.min(maxWaitMs, Math.round(exp + jitter));
}

export async function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export type RetryFetchOptions = {
  timeoutMs: number;
  maxAttempts?: number;
  maxTotalMs?: number;
  maxWaitMs?: number;
  baseMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  dispatcher?: unknown;
};

/**
 * GET/POST with retries for 429, transient 5xx, and brief network failures.
 * Honors Retry-After when present. Stops when attempts or the total time budget run out.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryFetchOptions,
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const maxTotalMs = options.maxTotalMs ?? DEFAULT_MAX_TOTAL_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const baseMs = options.baseMs ?? DEFAULT_BASE_MS;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const started = now();

  let lastError: unknown;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url,
        init,
        options.timeoutMs,
        options.dispatcher,
        options.fetchImpl ?? fetch,
      );
      lastResponse = response;
      if (response.ok || !isRetryableHttpStatus(response.status)) {
        return response;
      }
      const isLast = attempt >= maxAttempts - 1;
      const fallback = backoffWithJitter(attempt, baseMs, random, maxWaitMs);
      const wait = parseRetryAfterMs(response.headers.get("retry-after"), fallback, now(), maxWaitMs);
      if (isLast || now() - started + wait >= maxTotalMs) {
        return response;
      }
      await sleep(wait);
    } catch (error) {
      lastError = error;
      const isLast = attempt >= maxAttempts - 1;
      if (!isRetryableNetworkError(error) || isLast) {
        throw error;
      }
      const wait = backoffWithJitter(attempt, baseMs, random, maxWaitMs);
      if (now() - started + wait >= maxTotalMs) {
        throw error;
      }
      await sleep(wait);
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error("The request didn't finish.");
}
