"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { isPagesDemo } from "@/lib/pages";
import { MONITOR_PRICE_CENTS, REPORT_PRICE_CENTS, usdFromCents } from "@/lib/prices";
import { unlockPagesScan } from "@/lib/pages-store";

export function DemoCheckoutForm({
  scanId,
  plan,
  email,
  businessName,
}: {
  scanId: string;
  plan: "report" | "monitor";
  email: string;
  businessName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const amount =
    plan === "monitor" ? `${usdFromCents(MONITOR_PRICE_CENTS)} / month` : `${usdFromCents(REPORT_PRICE_CENTS)} once`;

  async function pay() {
    setPending(true);
    setError("");
    if (isPagesDemo()) {
      const saved = unlockPagesScan(plan, email);
      if (!saved) {
        setError("Run a check first. This preview keeps the result in your browser.");
        setPending(false);
        return;
      }
      router.push("/scans/preview?paid=1");
      return;
    }
    try {
      const response = await fetch("/api/checkout/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId, plan, email }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        setError(data.error || "The practice payment didn't go through.");
        setPending(false);
        return;
      }
      router.push(`/scans/${data.id}?paid=1`);
    } catch {
      setError("The practice payment didn't go through.");
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Business</dt>
          <dd>{businessName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="truncate">{email}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-2 text-base">
          <dt>Due today</dt>
          <dd className="font-medium">{amount}</dd>
        </div>
      </dl>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        {isPagesDemo()
          ? "This preview does not charge a card. Completing this step unlocks the sample report in your browser."
          : "Test card when Stripe is connected: 4242 4242 4242 4242, any future date, any CVC. This screen is the stand-in because the Stripe secret key is not set."}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-primary">
          {error}
        </p>
      ) : null}
      <Button type="button" size="lg" className="h-12 text-base" disabled={pending} onClick={pay}>
        {pending ? "Recording the practice payment…" : "Complete test payment"}
      </Button>
    </div>
  );
}
