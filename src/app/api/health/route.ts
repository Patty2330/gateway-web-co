import { connection } from "next/server";

import { databaseType, getStore } from "@/lib/db";
import { anyProviderConfigured } from "@/lib/providers";
import { stripeConfigured } from "@/lib/stripe";

const noStore = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
};

export async function GET() {
  await connection();
  let database = false;
  try {
    database = await (await getStore()).ping();
  } catch {
    database = false;
  }

  const mode = anyProviderConfigured() ? "live" : "demo";
  const stripe = stripeConfigured();
  const expectsPostgres = Boolean(process.env.DATABASE_URL);
  const ok = !expectsPostgres || database;
  return Response.json(
    { ok, mode, stripe, database, databaseType: databaseType() },
    { status: ok ? 200 : 503, headers: noStore },
  );
}
