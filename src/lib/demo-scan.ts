import { buildDemoAnswer, demoSeed } from "@/lib/demo";
import { buildFindings } from "@/lib/findings";
import { parseAnswer } from "@/lib/parse";
import { getProviders } from "@/lib/providers";
import { buildQuestions } from "@/lib/questions";
import { aggregateCompetitors, pointsFor, visibilityScore } from "@/lib/score";
import type { AnswerRecord, ScanInput, ScanPayload, ScanRecord } from "@/lib/types";

/** Sample scan that stays in the browser. No network, no database. */
export function runDemoScan(input: ScanInput): ScanPayload {
  const questions = buildQuestions(input);
  const providers = getProviders();
  const seed = demoSeed(input);
  const answers: AnswerRecord[] = questions.flatMap((question) =>
    providers.map((provider) => {
      const text = buildDemoAnswer({
        businessName: input.businessName,
        category: input.category,
        city: input.city,
        state: input.state,
        questionIndex: question.index,
        seed,
      });
      const parsed = parseAnswer(text, input.businessName, { websiteUrl: input.websiteUrl });
      return {
        questionId: question.id,
        question: question.text,
        providerId: provider.id,
        providerName: provider.name,
        demo: true,
        text,
        mentioned: parsed.mentioned,
        rank: parsed.rank,
        competitors: parsed.competitors,
        sources: parsed.sources,
        points: pointsFor(parsed.mentioned, parsed.rank),
      };
    }),
  );

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
    complete: true,
    providers: providers.map((provider) => {
      const rows = answers.filter((answer) => answer.providerId === provider.id);
      return {
        id: provider.id,
        name: provider.name,
        demo: true,
        mentions: rows.filter((row) => row.mentioned).length,
        answers: rows.length,
        errors: 0,
      };
    }),
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
