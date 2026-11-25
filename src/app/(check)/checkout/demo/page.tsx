"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { DemoCheckoutForm } from "@/components/demo-checkout-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadCheckoutEmail } from "@/lib/checkout-client";
import { isPagesDemo } from "@/lib/pages";
import { loadPagesScan } from "@/lib/pages-store";

function CheckoutSkeleton() {
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-16">
      <p className="font-serif text-3xl">Opening checkout…</p>
    </main>
  );
}

function CheckoutBody() {
  const query = useSearchParams();
  const scanId = query.get("scan") || "";
  const plan = query.get("plan") === "monitor" ? "monitor" : "report";
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [missing, setMissing] = useState(false);
  const [stripeOn, setStripeOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const storedEmail = loadCheckoutEmail();
      if (!cancelled) setEmail(storedEmail);

      if (isPagesDemo()) {
        const stored = loadPagesScan();
        if (!cancelled) {
          if (!stored || !storedEmail) setMissing(true);
          else setBusinessName(stored.businessName);
          setReady(true);
        }
        return;
      }
      if (!scanId || !storedEmail) {
        if (!cancelled) {
          setMissing(true);
          setReady(true);
        }
        return;
      }
      const [scanResponse, healthResponse] = await Promise.all([
        fetch(`/api/scans/${scanId}`),
        fetch("/api/health"),
      ]);
      if (cancelled) return;
      if (!scanResponse.ok) {
        setMissing(true);
        setReady(true);
        return;
      }
      const scan = (await scanResponse.json()) as { businessName?: string };
      const health = healthResponse.ok
        ? ((await healthResponse.json()) as { stripe?: boolean })
        : {};
      setBusinessName(scan.businessName || "Your business");
      setStripeOn(Boolean(health.stripe));
      setReady(true);
    }
    load().catch(() => {
      if (!cancelled) {
        setMissing(true);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scanId]);

  if (!ready) return <CheckoutSkeleton />;

  if (missing) {
    return (
      <main className="mx-auto w-full max-w-lg px-5 py-16">
        <h1 className="font-serif text-4xl">Checkout needs a check</h1>
        <p className="mt-3 text-muted-foreground">
          Run a visibility check first, then choose the report or the monthly watch.
        </p>
        <Link href="/check" className="mt-4 inline-block underline underline-offset-4">
          Back to the check
        </Link>
      </main>
    );
  }

  if (stripeOn) {
    return (
      <main className="mx-auto w-full max-w-lg px-5 py-16">
        <h1 className="font-serif text-4xl">Use the Stripe checkout</h1>
        <p className="mt-3 text-muted-foreground">
          A Stripe key is set, so practice payments are turned off. Go back to the report and
          start checkout again.
        </p>
        <Link href={`/scans/${scanId}`} className="mt-4 inline-block underline underline-offset-4">
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
        {isPagesDemo()
          ? "This preview pretends to take payment and then unlocks the sample report in your browser. No card is charged."
          : "Stripe isn't connected on this install, so this page pretends to take payment and then unlocks the report. No card is charged."}
      </p>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Test payment</CardTitle>
        </CardHeader>
        <CardContent>
          <DemoCheckoutForm
            scanId={scanId || "pages-demo"}
            plan={plan}
            email={email}
            businessName={businessName}
          />
        </CardContent>
      </Card>
    </main>
  );
}

export default function DemoCheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutBody />
    </Suspense>
  );
}
