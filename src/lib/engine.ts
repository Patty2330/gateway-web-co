import { buildDemoAnswer, demoSeed } from "@/lib/demo";
import { buildFindings } from "@/lib/findings";
import { parseAnswer } from "@/lib/parse";
import { anyProviderConfigured, getProviders, type AnswerProvider, type ProviderAskOptions } from "@/lib/providers";
import { MIN_ANSWERS_TO_FINISH, scanIsComplete } from "@/lib/scan-complete";
import { buildQuestions } from "@/lib/questions";
import { aggregateCompetitors, pointsFor, visibilityScore } from "@/lib/score";
import { formatCityState } from "@/lib/place";
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

/** Live Perplexity questions run two at a time so a single check is less likely to hit 429s. */
export const PERPLEXITY_CONCURRENCY = 2;

/**
 * Hard wall-clock cap for one check, including per-request timeouts, retries, and waits.
 * In-flight Perplexity requests are aborted when this deadline is reached.
 */
export const SCAN_DEADLINE_MS = 40_000;

export function buildPrompt(question: string, input: Pick<ScanInput, "city" | "state">): string {
  return [
    `A customer in ${formatCityState(input.city, input.state)} asks: "${question}"`,
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
  ask?: ProviderAskOptions,
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
    const live = await provider.answer(buildPrompt(question.text, input), ask);
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
  options: {
    providers?: AnswerProvider[];
    concurrency?: number;
    deadlineMs?: number;
    now?: () => number;
    signal?: AbortSignal;
  } = {},
): Promise<ScanPayload> {
  const questions = existingQuestions ?? buildQuestions(input);
  const providers = options.providers ?? getProviders();
  const seed = demoSeed(input);
  const tasks = questions.flatMap((question) =>
    providers.map((provider) => ({ question, provider })),
  );
  const concurrency = options.concurrency ?? PERPLEXITY_CONCURRENCY;
  const now = options.now ?? Date.now;
  const deadlineMs = options.deadlineMs ?? SCAN_DEADLINE_MS;
  const started = now();
  const deadlineAt = started + deadlineMs;
  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", onParentAbort);
  }
  const realClock = now === Date.now;
  const timer = realClock
    ? setTimeout(() => controller.abort(), Math.max(0, deadlineAt - Date.now()))
    : undefined;

  const cancelledAnswer = (task: (typeof tasks)[number], message: string): AnswerRecord => ({
    questionId: task.question.id,
    question: task.question.text,
    providerId: task.provider.id,
    providerName: task.provider.name,
    demo: false,
    text: "",
    mentioned: false,
    rank: null,
    competitors: [],
    sources: [],
    error: message,
    points: 0,
  });

  const results: Array<AnswerRecord | undefined> = new Array(tasks.length);
  let next = 0;
  let settled = 0;
  let successes = 0;

  const canStillFinish = () => successes + (tasks.length - settled) >= MIN_ANSWERS_TO_FINISH;
  const outOfTime = () => controller.signal.aborted || now() >= deadlineAt;

  try {
    const siteCheckPromise = input.websiteUrl
      ? checkWebsite(input.websiteUrl, input.businessName)
      : Promise.resolve(null);

    const workers = Array.from({ length: Math.min(concurrency, Math.max(1, tasks.length)) }, async () => {
      while (next < tasks.length) {
        if (outOfTime() || !canStillFinish()) {
          controller.abort();
          return;
        }
        const index = next;
        next += 1;
        const task = tasks[index];
        try {
          results[index] = await askOne(task.provider, task.question, input, seed, {
            signal: controller.signal,
            deadlineAt,
            now,
          });
        } catch (error) {
          const message =
            error instanceof Error && error.name === "AbortError"
              ? "The check ran out of time."
              : error instanceof Error
                ? error.message.slice(0, 240)
                : `${task.provider.name} failed.`;
          results[index] = cancelledAnswer(task, message);
        } finally {
          settled += 1;
          if (results[index] && !results[index]?.error) successes += 1;
          if (outOfTime() || !canStillFinish()) controller.abort();
        }
      }
    });

    await Promise.all(workers);
    controller.abort();

    for (let index = 0; index < tasks.length; index++) {
      if (!results[index]) {
        results[index] = cancelledAnswer(
          tasks[index],
          outOfTime() ? "The check ran out of time." : "The check didn't finish.",
        );
      }
    }

    let siteCheck = null;
    if (input.websiteUrl) {
      const leftover = Math.max(0, deadlineAt - now());
      siteCheck = await Promise.race([
        siteCheckPromise,
        new Promise<null>((resolve) => {
          if (!realClock || leftover <= 0) {
            resolve(null);
            return;
          }
          setTimeout(() => resolve(null), leftover);
        }),
      ]);
    }

    const answers = results as AnswerRecord[];
    const usable = answers.filter((answer) => !answer.error);
    const mentionCount = usable.filter((answer) => answer.mentioned).length;
    const competitors = aggregateCompetitors(answers, input.businessName);
    const complete = scanIsComplete({ answers });
    const score = complete ? visibilityScore(answers) : null;
    const findings = complete
      ? buildFindings({
          businessName: input.businessName,
          category: input.category,
          city: input.city,
          websiteUrl: input.websiteUrl,
          mentionCount,
          answerCount: usable.length,
          answers,
          competitors,
          siteCheck,
        })
      : [];

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
      complete,
      providers: providerStats,
    };
  } finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener("abort", onParentAbort);
  }
}
