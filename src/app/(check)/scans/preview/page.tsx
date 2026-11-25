"use client";

import { Suspense, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ResultsView } from "@/components/results-view";
import { loadPagesScan, subscribePagesScan } from "@/lib/pages-store";
import { presentScan } from "@/lib/present";

function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function PreviewBody() {
  const query = useSearchParams();
  const hydrated = useHydrated();
  const record = useSyncExternalStore(subscribePagesScan, loadPagesScan, () => null);

  if (!hydrated) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-16">
        <p className="font-serif text-3xl">Pulling the check…</p>
      </main>
    );
  }

  if (!record) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-16">
        <h1 className="font-serif text-4xl">Run a check first</h1>
        <p className="mt-3 text-muted-foreground">
          This preview keeps the result in your browser. Start from the free check.
        </p>
        <Link href="/check" className="mt-4 inline-block underline underline-offset-4">
          Free AI visibility check
        </Link>
      </main>
    );
  }

  return (
    <ResultsView
      scan={presentScan(record)}
      paidNotice={query.get("paid") === "1" ? "practice" : false}
      cancelNotice={false}
    />
  );
}

export default function PreviewPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl px-5 py-16">
          <p className="font-serif text-3xl">Pulling the check…</p>
        </main>
      }
    >
      <PreviewBody />
    </Suspense>
  );
}
