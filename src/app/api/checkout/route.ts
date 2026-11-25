import { z } from "zod";

import { getStore } from "@/lib/db";
import { appUrlFrom } from "@/lib/request";
import { createCheckoutSession } from "@/lib/stripe";

const schema = z.object({
  scanId: z.string().uuid("Open a check before you pay."),
  plan: z.enum(["report", "monitor"]),
  email: z.string().trim().email("Add an email so we know where to send updates."),
});

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
      { error: parsed.error.issues[0]?.message || "Check the email and try again." },
      { status: 400 },
    );
  }

  const store = await getStore();
  const scan = await store.getScan(parsed.data.scanId);
  if (!scan) return Response.json({ error: "We can't find that check." }, { status: 404 });

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
