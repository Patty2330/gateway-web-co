import { buildDemoAnswer, demoSeed } from "@/lib/demo";
import { buildFindings } from "@/lib/findings";
import { mapPool } from "@/lib/http";
import { parseAnswer } from "@/lib/parse";
import { anyProviderConfigured, getProviders, type AnswerProvider } from "@/lib/providers";
import { buildQuestions } from "@/lib/questions";
import { aggregateCompetitors, pointsFor, visibilityScore } from "@/lib/score";
import { checkWebsite } from "@/lib/site-check";
import type { AnswerRecord, Question, ScanInput, ScanMode, ScanPayload, Source } from "@/lib/types";

export function buildCacheKey(input: ScanInput, signature: string): string {
  const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  return [
    norm(input.businessName),
    norm(input.category),
    norm(input.city),
    input.state.trim().toUpperCase(),
    (input.websiteUrl || "").trim().toLowerCase(),
    signature,
  ].join("|");
}

export function scanMode(): ScanMode {
  return anyProviderConfigured() ? "live" : "demo";
}

export function buildPrompt(question: string, input: Pick<ScanInput, "city" | "state">): string {
  return [
    `A customer in ${input.city}, ${input.state} asks: "${question}"`,
    "Answer the way you would to that customer.",
    "When you recommend more than one business, use a numbered list with the best option first.",
    "Start each numbered item with the business name, then a short reason.",
    "Include the source URLs you actually used.",
    "If you are not sure of a real local business, say so. Do not invent a business.",
    "Keep the answer under 180 words.",
  ].join("\n");
}

function mergeSources(left: Source[], right: Source[]): Source[] {
  const seen = new Set<string>();
  const merged: Source[] = [];
  for (const source of [...left, ...right]) {
    if (!source.url || seen.has(source.url)) continue;
    seen.add(source.url);
    merged.push(source);
  }
  return merged;
}

async function askOne(
  provider: AnswerProvider,
  question: Question,
  input: ScanInput,
  seed: number,
): Promise<AnswerRecord> {
  const base = {
    questionId: question.id,
    question: question.text,
    providerId: provider.id,
    providerName: provider.name,
  };

  if (!provider.configured()) {
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
      ...base,
      demo: true,
      text,
      mentioned: parsed.mentioned,
      rank: parsed.rank,
      competitors: parsed.competitors,
      sources: parsed.sources,
      points: pointsFor(parsed.mentioned, parsed.rank),
    };
  }

  try {
    const live = await provider.answer(buildPrompt(question.text, input));
    if (!live.text) {
      return {
        ...base,
        demo: false,
        text: "",
        mentioned: false,
        rank: null,
        competitors: [],
        sources: live.sources,
        error: `${provider.name} returned an empty answer.`,
        points: 0,
      };
    }
    const parsed = parseAnswer(live.text, input.businessName);
    return {
      ...base,
      demo: false,
      text: live.text,
      mentioned: parsed.mentioned,
      rank: parsed.rank,
      competitors: parsed.competitors,
      sources: mergeSources(parsed.sources, live.sources),
      points: pointsFor(parsed.mentioned, parsed.rank),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : `${provider.name} failed.`;
    return {
      ...base,
      demo: false,
      text: "",
      mentioned: false,
      rank: null,
      competitors: [],
      sources: [],
      error: message.slice(0, 240),
      points: 0,
    };
  }
}

export async function executeScan(
  input: ScanInput,
  existingQuestions?: Question[],
): Promise<ScanPayload> {
  const questions = existingQuestions ?? buildQuestions(input);
  const providers = getProviders();
  const seed = demoSeed(input);
  const tasks = questions.flatMap((question) =>
    providers.map((provider) => ({ question, provider })),
  );

  const [answers, siteCheck] = await Promise.all([
    mapPool(tasks, 6, ({ question, provider }) => askOne(provider, question, input, seed)),
    input.websiteUrl ? checkWebsite(input.websiteUrl, input.businessName) : Promise.resolve(null),
  ]);

  const usable = answers.filter((answer) => !answer.error);
  const mentionCount = usable.filter((answer) => answer.mentioned).length;
  const competitors = aggregateCompetitors(answers, input.businessName);
  const score = visibilityScore(answers);
  const findings = buildFindings({
    businessName: input.businessName,
    category: input.category,
    city: input.city,
    websiteUrl: input.websiteUrl,
    mentionCount,
    answerCount: usable.length,
    answers,
    competitors,
    siteCheck,
  });

  const providerStats = providers.map((provider) => {
    const rows = answers.filter((answer) => answer.providerId === provider.id);
    const error = rows.find((row) => row.error)?.error;
    return {
      id: provider.id,
      name: provider.name,
      demo: rows.length > 0 && rows.every((row) => row.demo),
      mentions: rows.filter((row) => row.mentioned && !row.error).length,
      answers: rows.filter((row) => !row.error).length,
      errors: rows.filter((row) => row.error).length,
      error,
    };
  });

  return {
    questions,
    answers,
    competitors,
    findings,
    siteCheck,
    score,
    mentionCount,
    answerCount: usable.length,
    providers: providerStats,
  };
}
