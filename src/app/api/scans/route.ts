import { randomUUID } from "node:crypto";

import { getStore } from "@/lib/db";
import { zodErrorMessage } from "@/lib/form-error";
import { scanFormSchema } from "@/lib/schemas";
import { buildCacheKey, executeScan, scanMode } from "@/lib/engine";
import { providerSignature } from "@/lib/providers";
import { scanIsComplete } from "@/lib/scan-complete";
import { RateLimitConfigError, cacheHours, clientIp, dailyLimit, dailyLimitReachedMessage, hashIp, rateLimitDay, shouldRefundUnfinishedAttempt, unfinishedRateKey } from "@/lib/request";
import { normalizeWebsite } from "@/lib/website-url";
import type { ScanRecord } from "@/lib/types";

const schema = scanFormSchema;

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
      { error: zodErrorMessage(parsed.error) },
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

  const day = rateLimitDay();
  const count = await store.consumeRateLimit(ipHash, day);
  if (count > dailyLimit()) {
    return Response.json(
      {
        error: dailyLimitReachedMessage(),
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

  async function refundIfUnfinished(): Promise<void> {
    const unfinishedCount = await store.consumeRateLimit(unfinishedRateKey(ipHash), day);
    if (shouldRefundUnfinishedAttempt(unfinishedCount)) {
      await store.refundRateLimit(ipHash, day);
    }
  }

  try {
    const payload = await executeScan(input);
    if (!scanIsComplete(payload)) {
      await refundIfUnfinished();
    }
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
    try {
      await refundIfUnfinished();
    } catch (refundError) {
      console.error(refundError);
    }
    return Response.json(
      { error: "The check didn't finish. Please try again in a minute." },
      { status: 500 },
    );
  }
}
