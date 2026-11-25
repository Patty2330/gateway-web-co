import { inflateSync } from "node:zlib";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ResultsView } from "@/components/results-view";
import { renderReportPdf } from "@/lib/pdf";
import { presentScan } from "@/lib/present";
import type { AnswerRecord, ScanPayload, ScanRecord } from "@/lib/types";

function record(): ScanRecord {
  const answers: AnswerRecord[] = Array.from({ length: 8 }, (_, index) => ({
    questionId: `q${index + 1}`,
    question: "What is the best restaurant in Clarksville, TN?",
    providerId: "perplexity",
    providerName: "Perplexity",
    demo: false,
    text: index === 0 ? "1. The Catfish House — listed locally." : "",
    mentioned: index === 0,
    rank: index === 0 ? 1 : null,
    competitors: [],
    sources: [],
    error: index === 0 ? undefined : "The check ran out of time.",
    points: index === 0 ? 100 : 0,
  }));
  const payload: ScanPayload = {
    questions: answers.map((row) => ({ id: row.questionId, text: row.question, index: 0 })),
    answers,
    competitors: [],
    findings: [],
    siteCheck: null,
    score: null,
    mentionCount: 1,
    answerCount: 1,
    complete: false,
    providers: [
      { id: "perplexity", name: "Perplexity", demo: false, mentions: 1, answers: 1, errors: 7 },
    ],
  };
  return {
    id: "55555555-5555-4555-8555-555555555555",
    businessName: "The Catfish House",
    category: "restaurant",
    city: "Clarksville, TN",
    state: "TN",
    websiteUrl: "https://www.catfishhouseclarksville.com/",
    createdAt: "2026-11-25T19:38:05.000Z",
    updatedAt: "2026-11-25T19:38:05.000Z",
    ipHash: "hash",
    mode: "live",
    cacheKey: "key",
    score: null,
    tier: "free",
    email: null,
    stripeSessionId: null,
    stripeSubscriptionId: null,
    nextRunAt: null,
    previousScore: null,
    payload,
  };
}

function pdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const streams: string[] = [];
  const pattern = /stream\r?\n([\s\S]*?)\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    try {
      streams.push(inflateSync(Buffer.from(match[1], "latin1")).toString("latin1"));
    } catch {
      streams.push(match[1]);
    }
  }
  const decoded: string[] = [];
  const hex = /<([0-9A-Fa-f]+)>/g;
  for (const stream of streams) {
    hex.lastIndex = 0;
    let hexMatch: RegExpExecArray | null;
    while ((hexMatch = hex.exec(stream))) {
      decoded.push(Buffer.from(hexMatch[1], "hex").toString("latin1"));
    }
  }
  return decoded.join("");
}

describe("unfinished results rendering", () => {
  it("shows that the check didn't finish and does not print a 0 / 100 score", async () => {
    const scan = presentScan(record());
    const html = renderToStaticMarkup(
      ResultsView({ scan, paidNotice: false, cancelNotice: false }),
    );
    expect(html).toMatch(/didn(?:['’]|&apos;|&#x27;)t finish/i);
    expect(html).not.toMatch(/0\s*\/\s*100/);
    expect(html).toContain("Clarksville, TN");
    expect(html).not.toContain("Clarksville, TN, TN");

    const pdf = await renderReportPdf(scan);
    const text = pdfText(pdf);
    expect(text).toMatch(/didn't finish/i);
    expect(text).not.toMatch(/0\s*\/\s*100/);
  });
});
