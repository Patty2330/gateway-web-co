import { Suspense } from "react";
import Link from "next/link";

import { DemoCheckoutForm } from "@/components/demo-checkout-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStore } from "@/lib/db";
import { stripeConfigured } from "@/lib/stripe";

function CheckoutSkeleton() {
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-16">
      <p className="font-serif text-3xl">Opening checkout…</p>
    </main>
  );
}

async function CheckoutLoader({
  searchParams,
}: {
  searchParams: Promise<{ scan?: string; plan?: string; email?: string }>;
}) {
  const query = await searchParams;
  const scanId = query.scan || "";
  const plan = query.plan === "monitor" ? "monitor" : "report";
  const email = query.email || "";
  const store = await getStore();
  const scan = scanId ? await store.getScan(scanId) : null;

  if (!scan || !email) {
    return (
      <main className="mx-auto w-full max-w-lg px-5 py-16">
        <h1 className="font-serif text-4xl">Checkout needs a check</h1>
        <p className="mt-3 text-muted-foreground">
          Run a visibility check first, then choose the report or the monthly watch.
        </p>
        <Link href="/" className="mt-4 inline-block underline underline-offset-4">
          Back to the check
        </Link>
      </main>
    );
  }

  if (stripeConfigured()) {
    return (
      <main className="mx-auto w-full max-w-lg px-5 py-16">
        <h1 className="font-serif text-4xl">Use the Stripe checkout</h1>
        <p className="mt-3 text-muted-foreground">
          A Stripe key is set, so practice payments are turned off. Go back to the report and
          start checkout again.
        </p>
        <Link href={`/scans/${scan.id}`} className="mt-4 inline-block underline underline-offset-4">
          Back to the report
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-12">
      <p className="text-sm uppercase tracking-[0.16em] text-primary">Practice checkout</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight">
        {plan === "monitor" ? "Monthly watch" : "Full report"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Stripe isn&apos;t connected on this install, so this page pretends to take payment and
        then unlocks the report. No card is charged.
      </p>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Test payment</CardTitle>
        </CardHeader>
        <CardContent>
          <DemoCheckoutForm
            scanId={scan.id}
            plan={plan}
            email={email}
            businessName={scan.businessName}
          />
        </CardContent>
      </Card>
    </main>
  );
}

export default function DemoCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ scan?: string; plan?: string; email?: string }>;
}) {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutLoader searchParams={searchParams} />
    </Suspense>
  );
}
