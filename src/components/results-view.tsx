import Link from "next/link";

import { LeadForm } from "@/components/lead-form";
import { ScoreRing } from "@/components/score-ring";
import { UnlockPanel } from "@/components/unlock-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicScan } from "@/lib/present";
import type { AnswerRecord } from "@/lib/types";

function providerLine(provider: PublicScan["providers"][number]) {
  if (provider.errors > 0 && provider.answers === 0) {
    return `${provider.name} didn't answer`;
  }
  return `${provider.name} named you in ${provider.mentions} of ${provider.answers}`;
}

function placeLabel(answer: AnswerRecord) {
  if (answer.error) return "Didn't answer";
  if (!answer.mentioned) return "Not named";
  if (answer.rank) return `Named #${answer.rank}`;
  return "Named";
}

export function ResultsView({
  scan,
  paidNotice,
  cancelNotice,
}: {
  scan: PublicScan;
  paidNotice: boolean;
  cancelNotice: boolean;
}) {
  const sampleOnly = scan.mode === "demo";

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          New check
        </Link>
        <span> · {scan.category} in {scan.city}, {scan.state}</span>
      </p>
      <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
        {scan.businessName}
      </h1>

      {sampleOnly ? (
        <div className="mt-5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm leading-6">
          <strong className="font-medium">Sample answers.</strong> These are stand-ins so you can
          click through the whole check. Add a Perplexity key to ask Perplexity for real. The
          score on this page is from the sample, not from a live answer.
        </div>
      ) : null}
      {paidNotice ? (
        <div className="mt-5 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          Payment received. The full report is unlocked on this page.
        </div>
      ) : null}
      {cancelNotice ? (
        <div className="mt-5 rounded-xl bg-muted px-4 py-3 text-sm">
          Payment canceled. Your free check is still here.
        </div>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-[auto_1fr]">
        <Card className="items-center text-center lg:items-start lg:text-left">
          <CardContent className="flex flex-col items-center gap-4 lg:items-start">
            <ScoreRing score={scan.score} />
            <div>
              <p className="font-serif text-2xl">{scan.label}</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{scan.hint}</p>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">What the answers did</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-base leading-7">{scan.summary}</p>
              <ul className="grid gap-2">
                {scan.providers.map((provider) => (
                  <li key={provider.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                    <span>{providerLine(provider)}</span>
                    <Badge variant={provider.demo ? "outline" : "secondary"}>
                      {provider.demo ? "Sample" : "Live"}
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                The score is the average of Perplexity&apos;s answers to eight customer questions.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">The three fixes to start with</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {scan.topFindings.map((finding, index) => (
            <Card key={finding.id}>
              <CardHeader>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Fix {index + 1}
                </p>
                <CardTitle className="font-serif text-xl">{finding.title}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm leading-6">
                <p>{finding.why}</p>
                <p className="text-foreground">{finding.fix}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {scan.unlocked ? (
        <section className="mt-10 grid gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-serif text-3xl">Full report</h2>
            <a
              href={`/api/scans/${scan.id}/pdf`}
              className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Download PDF
            </a>
          </div>
          {scan.tier === "monitor" && scan.nextRunAt ? (
            <p className="text-sm text-muted-foreground">
              Monthly watch is on. Next check {new Date(scan.nextRunAt).toLocaleDateString("en-US")}.
              Email sending in this build is saved to the database until you connect a mail provider.
            </p>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Every fix</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {(scan.findings ?? []).map((finding) => (
                <article key={finding.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <h3 className="font-medium">{finding.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{finding.why}</p>
                  <p className="mt-1 text-sm leading-6">{finding.fix}</p>
                </article>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Who got named</CardTitle>
            </CardHeader>
            <CardContent>
              {(scan.competitors ?? []).length === 0 ? (
                <p className="text-sm">No other business was pulled out of these answers.</p>
              ) : (
                <ul className="grid gap-2">
                  {(scan.competitors ?? []).map((competitor) => (
                    <li key={competitor.name} className="flex items-center justify-between gap-3 text-sm">
                      <span>{competitor.name}</span>
                      <span className="text-muted-foreground">
                        {competitor.mentions} mention{competitor.mentions === 1 ? "" : "s"}
                        {competitor.bestRank ? ` · best #${competitor.bestRank}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <h2 className="font-serif text-3xl">Question by question</h2>
            {(scan.questions ?? []).map((question) => (
              <Card key={question.id}>
                <CardHeader>
                  <CardTitle className="text-base leading-6">{question.text}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {(scan.answers ?? [])
                    .filter((answer) => answer.questionId === question.id)
                    .map((answer) => (
                      <article key={`${question.id}-${answer.providerId}`} className="rounded-lg bg-muted/70 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{answer.providerName}</span>
                          <Badge variant="outline">{placeLabel(answer)}</Badge>
                          {answer.demo ? <Badge variant="secondary">Sample</Badge> : null}
                          <span className="text-muted-foreground">{answer.points} pts</span>
                        </div>
                        {answer.error ? (
                          <p className="mt-2 text-sm text-primary">{answer.error}</p>
                        ) : (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{answer.text}</p>
                        )}
                        {answer.sources.length > 0 ? (
                          <ul className="mt-2 grid gap-1 text-sm">
                            {answer.sources.slice(0, 4).map((source) => (
                              <li key={source.url}>
                                <a href={source.url} className="break-all underline underline-offset-4" target="_blank" rel="noreferrer">
                                  {source.title || source.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </article>
                    ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {scan.siteCheck ? (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-2xl">Website check</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm leading-6">
                <p className="break-all text-muted-foreground">{scan.siteCheck.url}</p>
                {scan.siteCheck.ok ? (
                  <ul className="grid gap-1">
                    <li>Title: {scan.siteCheck.title || "missing"}</li>
                    <li>Description: {scan.siteCheck.metaDescription || "missing"}</li>
                    <li>LocalBusiness schema: {scan.siteCheck.hasLocalBusinessSchema ? "yes" : "no"}</li>
                    <li>Business name on the page: {scan.siteCheck.hasBusinessName ? "yes" : "no"}</li>
                    <li>Phone on the page: {scan.siteCheck.hasPhone ? "yes" : "no"}</li>
                    <li>Address on the page: {scan.siteCheck.hasAddress ? "yes" : "no"}</li>
                    <li>FAQ: {scan.siteCheck.hasFaq ? "yes" : "no"}</li>
                    <li>Phone-friendly viewport: {scan.siteCheck.hasViewport ? "yes" : "no"}</li>
                  </ul>
                ) : (
                  <p>{scan.siteCheck.error}</p>
                )}
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : (
        <section className="mt-10">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="font-serif text-3xl">The rest of the report</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="max-w-2xl text-sm leading-6">
                {scan.competitorCount === 0
                  ? "No other business was pulled out of these answers."
                  : `${scan.competitorCount} other business${scan.competitorCount === 1 ? "" : "es"} showed up.`}
                {scan.lockedFindingCount > 0
                  ? ` ${scan.lockedFindingCount} more fixes are in the full report, along with every question and a PDF.`
                  : " The full report adds every question and a PDF."}
                {scan.websiteUrl ? " It also includes the website check." : ""}
              </p>
              <div className="relative overflow-hidden rounded-xl border border-dashed border-border p-4">
                <div className="pointer-events-none select-none blur-[3px]">
                  <p className="text-sm">1. What is the best {scan.category} in {scan.city}?</p>
                  <p className="mt-2 text-sm text-muted-foreground">Perplexity</p>
                  <p className="mt-3 text-sm">Cumberland {scan.category} · Maple Street {scan.category}</p>
                </div>
                <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm font-medium">
                  Locked until you buy the report
                </p>
              </div>
              <UnlockPanel scanId={scan.id} email={scan.email} tier={scan.tier} />
              <p className="text-xs leading-5 text-muted-foreground">
                $49 is a one-time report. $19 a month re-runs this check and emails what changed.
                Without a Stripe key, checkout is a clearly labeled practice payment.
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {scan.unlocked && scan.tier !== "monitor" ? (
        <section className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Keep an eye on it</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm leading-6">
                $19 a month runs the same questions again and emails you when the score moves.
              </p>
              <UnlockPanel scanId={scan.id} email={scan.email} tier={scan.tier} />
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.1fr]" id="fix">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-accent">Gateway Web Co</p>
          <h2 className="mt-2 font-serif text-4xl leading-tight">Get it fixed</h2>
          <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">
            Jalen builds websites for Clarksville businesses. The first 10 local clients are
            $500, and you pay only when you&apos;re 100% happy. Send a note if you want him to
            take the fixes from this check and put them on a site.
          </p>
        </div>
        <Card>
          <CardContent>
            <LeadForm scanId={scan.id} businessName={scan.businessName} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
