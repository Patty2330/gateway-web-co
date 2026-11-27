import { checkoutFormSchema } from "@/lib/schemas";

import { getStore } from "@/lib/db";
import { UNFINISHED_CHECKOUT_MESSAGE, scanIsComplete } from "@/lib/scan-complete";
import { DEMO_CHECKOUT_DISABLED_MESSAGE, demoCheckoutAllowed, stripeConfigured } from "@/lib/stripe";

const schema = checkoutFormSchema;

export async function POST(request: Request) {
  if (stripeConfigured()) {
    return Response.json(
      { error: "Stripe is connected. Use the real checkout." },
      { status: 404 },
    );
  }
  // Fail closed: a missing Stripe key alone must never unlock reports for free.
  if (!demoCheckoutAllowed()) {
    return Response.json({ error: DEMO_CHECKOUT_DISABLED_MESSAGE }, { status: 404 });
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
  const existing = await store.getScan(parsed.data.scanId);
  if (!existing) return Response.json({ error: "We can't find that check." }, { status: 404 });
  if (!scanIsComplete(existing.payload)) {
    return Response.json({ error: UNFINISHED_CHECKOUT_MESSAGE }, { status: 409 });
  }
  const scan = await store.markPaid(parsed.data.scanId, {
    plan: parsed.data.plan,
    email: parsed.data.email,
    stripeSessionId: null,
    stripeSubscriptionId: null,
  });
  if (!scan) return Response.json({ error: "We can't find that check." }, { status: 404 });
  return Response.json({ id: scan.id, tier: scan.tier });
}
