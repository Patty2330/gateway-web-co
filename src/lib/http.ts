export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  dispatcher?: unknown,
  fetchImpl: typeof fetch = fetch,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, timeoutMs));
  const onAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      const error = new Error("This operation was aborted");
      error.name = "AbortError";
      throw error;
    }
    externalSignal.addEventListener("abort", onAbort);
  }
  try {
    const options: RequestInit & { dispatcher?: unknown } = { ...init, signal: controller.signal };
    if (dispatcher) options.dispatcher = dispatcher;
    return await fetchImpl(url, options);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onAbort);
  }
}

export function shortError(who: string, status: number, body: string): string {
  const cleaned = body
    .replace(/\b(?:sk_live_|sk_test_|rk_live_|rk_test_|rk_|whsec_|pplx-)[A-Za-z0-9]+/g, "[key]")
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[key]")
    .replace(/AIza[\w-]+/g, "[key]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return cleaned ? `${who} returned ${status}. ${cleaned}` : `${who} returned ${status}.`;
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
