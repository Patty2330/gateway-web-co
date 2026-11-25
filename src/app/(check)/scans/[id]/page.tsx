import { Suspense } from "react";

import { ResultsView } from "@/components/results-view";
import { getStore } from "@/lib/db";
import { presentScan } from "@/lib/present";
import { confirmCheckoutSession } from "@/lib/stripe";

function ResultsSkeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-16">
      <p className="font-serif text-3xl">Pulling the check…</p>
      <p className="mt-2 text-sm text-muted-foreground">This usually takes a moment.</p>
    </main>
  );
}

async function ResultsLoader({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string; checkout?: string; paid?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const store = await getStore();

  if (query.session_id) {
    const confirmed = await confirmCheckoutSession(query.session_id, id);
    if (confirmed) {
      await store.markPaid(id, {
        plan: confirmed.plan,
        email: confirmed.email,
        stripeSessionId: confirmed.sessionId,
        stripeSubscriptionId: confirmed.subscriptionId,
      });
    }
  }

  const scan = await store.getScan(id);
  if (!scan) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-16">
        <h1 className="font-serif text-4xl">We can&apos;t find that check</h1>
        <p className="mt-3 text-muted-foreground">
          The link may be old. Run a new one from the home page.
        </p>
      </main>
    );
  }

  return (
    <ResultsView
      scan={presentScan(scan)}
      paidNotice={query.paid === "1" || Boolean(query.session_id && scan.tier !== "free")}
      cancelNotice={query.checkout === "cancel"}
    />
  );
}

export default function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string; checkout?: string; paid?: string }>;
}) {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <ResultsLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}
