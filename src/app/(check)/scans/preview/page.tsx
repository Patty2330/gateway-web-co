"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { ResultsView } from "@/components/results-view";
import { loadPagesScan } from "@/lib/pages-store";
import { presentScan } from "@/lib/present";
import type { ScanRecord } from "@/lib/types";

function PreviewBody() {
  const query = useSearchParams();
  const [record, setRecord] = useState<ScanRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRecord(loadPagesScan());
    setReady(true);
  }, [query]);

  if (!ready) {
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
