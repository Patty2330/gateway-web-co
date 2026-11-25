import type Stripe from "stripe";

import { getStore } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import type { Plan } from "@/lib/types";

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return Response.json({ error: "Stripe webhook is not configured." }, { status: 501 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    if (subscription.id) {
      const store = await getStore();
      await store.clearMonitor(subscription.id);
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const scanId = session.metadata?.scanId;
    if (scanId && session.payment_status === "paid") {
      const plan: Plan = session.metadata?.plan === "monitor" ? "monitor" : "report";
      const subscription = session.subscription;
      const store = await getStore();
      await store.markPaid(scanId, {
        plan,
        email: session.customer_details?.email || session.metadata?.email || null,
        stripeSessionId: session.id,
        stripeSubscriptionId: typeof subscription === "string" ? subscription : subscription?.id ?? null,
      });
    }
  }

  return Response.json({ received: true });
}
