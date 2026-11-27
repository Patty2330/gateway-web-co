import { getStore } from "@/lib/db";
import { zodErrorMessage } from "@/lib/form-error";
import { UNFINISHED_CHECKOUT_MESSAGE, scanIsComplete } from "@/lib/scan-complete";
import { checkoutFormSchema } from "@/lib/schemas";
import {
  RateLimitConfigError,
  appUrlFrom,
  checkoutDailyLimit,
  checkoutDailyLimitReachedMessage,
  checkoutRateKey,
  clientIp,
  hashIp,
  rateLimitDay,
} from "@/lib/request";
import {
  DEMO_CHECKOUT_DISABLED_MESSAGE,
  createCheckoutSession,
  demoCheckoutAllowed,
  stripeConfigured,
} from "@/lib/stripe";

const schema = checkoutFormSchema;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the checkout details as JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: zodErrorMessage(parsed.error, "Check the email and try again.") },
      { status: 400 },
    );
  }

  let ipHash: string;
  try {
    ipHash = hashIp(clientIp(request));
  } catch (error) {
    if (error instanceof RateLimitConfigError) {
      return Response.json(
        { error: "This install isn't ready for checkout. Set RATE_LIMIT_SALT on the server." },
        { status: 503 },
      );
    }
    throw error;
  }

  const store = await getStore();
  const attempts = await store.consumeRateLimit(checkoutRateKey(ipHash), rateLimitDay());
  if (attempts > checkoutDailyLimit()) {
    return Response.json({ error: checkoutDailyLimitReachedMessage() }, { status: 429 });
  }

  const scan = await store.getScan(parsed.data.scanId);
  if (!scan) return Response.json({ error: "We can't find that check." }, { status: 404 });
  if (!scanIsComplete(scan.payload)) {
    return Response.json({ error: UNFINISHED_CHECKOUT_MESSAGE }, { status: 409 });
  }
  if (!stripeConfigured() && !demoCheckoutAllowed()) {
    // Without Stripe and without ALLOW_DEMO_CHECKOUT=true there is nowhere to pay.
    return Response.json({ error: DEMO_CHECKOUT_DISABLED_MESSAGE }, { status: 503 });
  }

  try {
    const url = await createCheckoutSession({
      scanId: scan.id,
      plan: parsed.data.plan,
      email: parsed.data.email,
      appUrl: appUrlFrom(request),
    });
    return Response.json({ url });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Checkout didn't start. Check the Stripe key and try again." },
      { status: 502 },
    );
  }
}
