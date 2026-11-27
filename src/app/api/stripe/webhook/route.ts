import type Stripe from "stripe";

import { getStore } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import type { Plan } from "@/lib/types";

/** Subscription states where the customer is not paying, so re-checks stop. */
const PAUSED_SUBSCRIPTION_STATUSES = new Set<string>(["past_due", "unpaid", "paused"]);
/** Subscription states that end the monitor for good. */
const ENDED_SUBSCRIPTION_STATUSES = new Set<string>(["canceled", "incomplete_expired"]);
/** Subscription states where re-checks should run. */
const ACTIVE_SUBSCRIPTION_STATUSES = new Set<string>(["active", "trialing"]);

function idOf(value: string | { id?: string } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id ?? null;
}

/** Unlock the report or start the monitor for a paid Checkout Session. */
async function fulfillCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  const scanId = session.metadata?.scanId;
  if (!scanId || session.payment_status !== "paid") return;
  const plan: Plan = session.metadata?.plan === "monitor" ? "monitor" : "report";
  const store = await getStore();
  await store.markPaid(scanId, {
    plan,
    email: session.customer_details?.email || session.metadata?.email || null,
    stripeSessionId: session.id,
    stripeSubscriptionId: idOf(session.subscription),
  });
}

/**
 * Subscription id on an invoice. Newer API versions moved it under
 * parent.subscription_details; older payloads have a top-level field.
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const nested = idOf(invoice.parent?.subscription_details?.subscription);
  if (nested) return nested;
  const legacy = (invoice as unknown as { subscription?: string | { id?: string } | null }).subscription;
  return idOf(legacy);
}

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

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      // Delayed methods (bank debits) finish "completed" as unpaid, then send
      // async_payment_succeeded once the money arrives.
      await fulfillCheckoutSession(event.data.object as Stripe.Checkout.Session);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.id) {
        const store = await getStore();
        await store.clearMonitor(subscription.id);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      if (!subscription.id) break;
      const store = await getStore();
      if (ENDED_SUBSCRIPTION_STATUSES.has(subscription.status)) {
        await store.clearMonitor(subscription.id);
      } else if (PAUSED_SUBSCRIPTION_STATUSES.has(subscription.status)) {
        await store.pauseMonitor(subscription.id);
      } else if (ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
        await store.resumeMonitor(subscription.id);
      }
      break;
    }

    case "invoice.payment_failed": {
      // Stop running the paid monitor for free. Stripe sends
      // customer.subscription.updated (active) when a retry succeeds.
      const subscriptionId = invoiceSubscriptionId(event.data.object as Stripe.Invoice);
      if (subscriptionId) {
        const store = await getStore();
        await store.pauseMonitor(subscriptionId);
      }
      break;
    }

    default:
      break;
  }

  return Response.json({ received: true });
}
