import { checkoutFormSchema } from "@/lib/schemas";

import { getStore } from "@/lib/db";
import { stripeConfigured } from "@/lib/stripe";

const schema = checkoutFormSchema;

export async function POST(request: Request) {
  if (stripeConfigured()) {
    return Response.json(
      { error: "Stripe is connected. Use the real checkout." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the practice payment as JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "That practice payment is missing a detail." }, { status: 400 });
  }

  const store = await getStore();
  const scan = await store.markPaid(parsed.data.scanId, {
    plan: parsed.data.plan,
    email: parsed.data.email,
    stripeSessionId: null,
    stripeSubscriptionId: null,
  });
  if (!scan) return Response.json({ error: "We can't find that check." }, { status: 404 });
  return Response.json({ id: scan.id, tier: scan.tier });
}
