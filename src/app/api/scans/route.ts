import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getStore } from "@/lib/db";
import { buildCacheKey, executeScan, scanMode } from "@/lib/engine";
import { providerSignature } from "@/lib/providers";
import { cacheHours, clientIp, dailyLimit, hashIp } from "@/lib/request";
import type { ScanRecord } from "@/lib/types";

const schema = z.object({
  businessName: z.string().trim().min(2, "Add the business name.").max(80),
  category: z.string().trim().min(2, "Add the kind of business.").max(40),
  city: z.string().trim().min(2, "Add the city.").max(60),
  state: z.string().trim().length(2, "Pick a state.").toUpperCase(),
  websiteUrl: z.string().trim().max(300).optional(),
});

function normalizeWebsite(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw.trim() : `https://${raw.trim()}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("That website address doesn't look right.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The website link needs to start with http or https.");
  }
  return url.toString();
}

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
  const ipHash = hashIp(clientIp(request));
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
