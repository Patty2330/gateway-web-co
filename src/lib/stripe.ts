import Stripe from "stripe";

import type { Plan } from "@/lib/types";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function createCheckoutSession(input: {
  scanId: string;
  plan: Plan;
  email: string;
  appUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) {
    const url = new URL("/checkout/demo", input.appUrl);
    url.searchParams.set("scan", input.scanId);
    url.searchParams.set("plan", input.plan);
    url.searchParams.set("email", input.email);
    return url.toString();
  }

  const monitor = input.plan === "monitor";
  const productName = monitor ? "AI Visibility monthly watch" : "AI Visibility full report";
  const productDescription = monitor
    ? "Re-run the visibility check each month and email what changed."
    : "Every question, every competitor, the full fix list, and a PDF.";
  const session = await stripe.checkout.sessions.create({
    mode: monitor ? "subscription" : "payment",
    customer_email: input.email,
    line_items: [
      monitor
        ? {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 1900,
              recurring: { interval: "month" },
              product_data: { name: productName, description: productDescription },
            },
          }
        : {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 4900,
              product_data: { name: productName, description: productDescription },
            },
          },
    ],
    metadata: {
      scanId: input.scanId,
      plan: input.plan,
      email: input.email,
    },
    success_url: `${input.appUrl}/scans/${input.scanId}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.appUrl}/scans/${input.scanId}?checkout=cancel`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout link.");
  return session.url;
}

export async function confirmCheckoutSession(
  sessionId: string,
  scanId: string,
): Promise<{
  plan: Plan;
  email: string | null;
  subscriptionId: string | null;
  sessionId: string;
} | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.scanId !== scanId) return null;
  const paid = session.payment_status === "paid" || session.status === "complete";
  if (!paid) return null;
  const plan: Plan = session.metadata?.plan === "monitor" ? "monitor" : "report";
  const email = session.customer_details?.email || session.metadata?.email || null;
  const subscription = session.subscription;
  const subscriptionId =
    typeof subscription === "string" ? subscription : subscription?.id ?? null;
  return { plan, email, subscriptionId, sessionId: session.id };
}
