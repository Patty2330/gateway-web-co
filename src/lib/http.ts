export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function shortError(who: string, status: number, body: string): string {
  const cleaned = body
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
