import { buildDemoAnswer, demoSeed } from "@/lib/demo";
import { buildFindings } from "@/lib/findings";
import { parseAnswer } from "@/lib/parse";
import { buildQuestions } from "@/lib/questions";
import { aggregateCompetitors, pointsFor, visibilityScore } from "@/lib/score";
import type { AnswerRecord, ScanInput, ScanPayload, ScanRecord } from "@/lib/types";

/** Sample scan that stays in the browser. No network, no database. */
export function runDemoScan(input: ScanInput): ScanPayload {
  const questions = buildQuestions(input);
  const seed = demoSeed(input);
  const answers: AnswerRecord[] = questions.map((question) => {
    const text = buildDemoAnswer({
      businessName: input.businessName,
      category: input.category,
      city: input.city,
      state: input.state,
      questionIndex: question.index,
      seed,
    });
    const parsed = parseAnswer(text, input.businessName);
    return {
      questionId: question.id,
      question: question.text,
      providerId: "perplexity",
      providerName: "Perplexity",
      demo: true,
      text,
      mentioned: parsed.mentioned,
      rank: parsed.rank,
      competitors: parsed.competitors,
      sources: parsed.sources,
      points: pointsFor(parsed.mentioned, parsed.rank),
    };
  });

  const mentionCount = answers.filter((answer) => answer.mentioned).length;
  const competitors = aggregateCompetitors(answers, input.businessName);
  const score = visibilityScore(answers);
  const findings = buildFindings({
    businessName: input.businessName,
    category: input.category,
    city: input.city,
    websiteUrl: input.websiteUrl,
    mentionCount,
    answerCount: answers.length,
    answers,
    competitors,
    siteCheck: null,
  });

  return {
    questions,
    answers,
    competitors,
    findings,
    siteCheck: null,
    score,
    mentionCount,
    answerCount: answers.length,
    providers: [
      {
        id: "perplexity",
        name: "Perplexity",
        demo: true,
        mentions: mentionCount,
        answers: answers.length,
        errors: 0,
      },
    ],
  };
}

export function demoScanRecord(input: ScanInput, id: string): ScanRecord {
  const payload = runDemoScan(input);
  const now = new Date().toISOString();
  return {
    id,
    businessName: input.businessName,
    category: input.category,
    city: input.city,
    state: input.state,
    websiteUrl: input.websiteUrl,
    createdAt: now,
    updatedAt: now,
    ipHash: "pages-demo",
    mode: "demo",
    cacheKey: "pages-demo",
    score: payload.score,
    tier: "free",
    email: null,
    stripeSessionId: null,
    stripeSubscriptionId: null,
    nextRunAt: null,
    previousScore: null,
    payload,
  };
}
