import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getStore } from "@/lib/db";
import { buildCacheKey, executeScan, scanMode } from "@/lib/engine";
import { providerSignature } from "@/lib/providers";
import { RateLimitConfigError, cacheHours, clientIp, dailyLimit, hashIp } from "@/lib/request";
import { normalizeWebsite } from "@/lib/website-url";
import type { ScanRecord } from "@/lib/types";

const schema = z.object({
  businessName: z.string().trim().min(2, "Add the business name.").max(80, "Keep the business name under 80 characters."),
  category: z.string().trim().min(2, "Add the kind of business.").max(40, "Keep the category under 40 characters."),
  city: z.string().trim().min(2, "Add the city.").max(60, "Keep the city name under 60 characters."),
  state: z.string().trim().length(2, "Pick a state.").toUpperCase(),
  websiteUrl: z.string().trim().max(300, "Keep the website address under 300 characters.").optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the business details as JSON." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Check the form and try again." },
      { status: 400 },
    );
  }

  let websiteUrl: string | null;
  try {
    websiteUrl = normalizeWebsite(parsed.data.websiteUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check the website address.";
    return Response.json({ error: message }, { status: 400 });
  }

  const input = {
    businessName: parsed.data.businessName,
    category: parsed.data.category,
    city: parsed.data.city,
    state: parsed.data.state,
    websiteUrl,
  };
  const signature = providerSignature();
  const cacheKey = buildCacheKey(input, signature);
  let ipHash: string;
  try {
    ipHash = hashIp(clientIp(request));
  } catch (error) {
    if (error instanceof RateLimitConfigError) {
      return Response.json(
        { error: "This install isn't ready for new checks. Set RATE_LIMIT_SALT on the server." },
        { status: 503 },
      );
    }
    throw error;
  }
  const since = new Date(Date.now() - cacheHours() * 60 * 60 * 1000).toISOString();
  const store = await getStore();
  const own = await store.findRecentByIp(ipHash, cacheKey, since);
  if (own) return Response.json({ id: own.id, cached: true });

  const count = await store.consumeRateLimit(ipHash, new Date().toISOString().slice(0, 10));
  if (count > dailyLimit()) {
    return Response.json(
      {
        error: `That's enough free checks for today. Each connection gets ${dailyLimit()} a day, so the AI bills stay small.`,
      },
      { status: 429 },
    );
  }

  const now = new Date().toISOString();
  const donor = await store.findRecentCache(cacheKey, since);
  if (donor) {
    const id = randomUUID();
    const copy: ScanRecord = {
      ...donor,
      id,
      createdAt: now,
      updatedAt: now,
      ipHash,
      tier: "free",
      email: null,
      stripeSessionId: null,
      stripeSubscriptionId: null,
      nextRunAt: null,
      previousScore: null,
    };
    await store.insertScan(copy);
    return Response.json({ id, cached: true });
  }

  try {
    const payload = await executeScan(input);
    const id = randomUUID();
    await store.insertScan({
      id,
      ...input,
      createdAt: now,
      updatedAt: now,
      ipHash,
      mode: scanMode(),
      cacheKey,
      score: payload.score,
      tier: "free",
      email: null,
      stripeSessionId: null,
      stripeSubscriptionId: null,
      nextRunAt: null,
      previousScore: null,
      payload,
    });
    return Response.json({ id, cached: false });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "The check didn't finish. Please try again in a minute." },
      { status: 500 },
    );
  }
}
