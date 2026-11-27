import { buildDemoAnswer, demoSeed } from "@/lib/demo";
import { buildFindings } from "@/lib/findings";
import { parseAnswer } from "@/lib/parse";
import { anyProviderConfigured, getProviders, sanitizeErrorSnippet, type AnswerProvider, type ProviderAskOptions } from "@/lib/providers";
import { defaultSleep } from "@/lib/retry";
import { scanIsComplete } from "@/lib/scan-complete";
import { buildQuestions } from "@/lib/questions";
import { aggregateCompetitors, pointsFor, visibilityScore } from "@/lib/score";
import { formatCityState } from "@/lib/place";
import { checkWebsite } from "@/lib/site-check";
import type { AnswerRecord, Question, ScanInput, ScanMode, ScanPayload, Source } from "@/lib/types";

/** Bump this when matcher or provider behavior changes so stale cached 0s are not reused. */
export const VISIBILITY_CACHE_VERSION = "v2-3models-match";

export function buildCacheKey(input: ScanInput, signature: string): string {
  const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  return [
    VISIBILITY_CACHE_VERSION,
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

/** Live Agent API questions run two at a time, paced to about 1 start per second. */
export const PERPLEXITY_CONCURRENCY = 2;

/** Tier 0 is 1 QPS. Space live request starts so we stay at that rate, plus 429 retries. */
export const MIN_AGENT_START_GAP_MS = 1_000;

/**
 * Hard wall-clock cap for one check, including per-request timeouts, retries, and waits.
 * 24 Agent API calls (8 questions × 3 models) need more room than a single-model run.
 * In-flight requests are aborted when this deadline is reached.
 */
export const SCAN_DEADLINE_MS = 120_000;

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

function errorClassOf(error: unknown, message?: string): string | undefined {
  const record = error && typeof error === "object" ? (error as { name?: string; httpStatus?: number; errorClass?: string }) : null;
  if (record?.errorClass) return record.errorClass;
  if (typeof record?.httpStatus === "number") return `http_${record.httpStatus}`;
  if (record?.name === "AbortError") return "abort";
  const text = message ?? (error instanceof Error ? error.message : "");
  if (!text) return undefined;
  if (/out of time|aborted/i.test(text)) return "abort";
  const status = text.match(/returned (\d{3})/);
  if (status) return `http_${status[1]}`;
  if (/empty answer/i.test(text)) return "empty";
  return "error";
}

function logVisibility(event: string, fields: Record<string, unknown>): void {
  const safe: Record<string, unknown> = { event };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (/(?:^|_)(?:api)?key(?:_|$)|authorization|prompt|ip(?:hash|addr)?|salt|token/.test(lower)) {
      continue;
    }
    safe[key] = typeof value === "string" ? sanitizeErrorSnippet(value) : value;
  }
  console.info(JSON.stringify(safe));
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
  const model = provider.model?.();
  const started = (ask?.now ?? Date.now)();

  const finish = (
    record: Omit<AnswerRecord, "questionId" | "question" | "providerId" | "providerName">,
    extra: {
      errorClass?: string;
      httpStatus?: number;
      latencyMs?: number;
      errorType?: string;
      errorParam?: string;
      errorMessage?: string;
    } = {},
  ): AnswerRecord => {
    const latencyMs = extra.latencyMs ?? Math.max(0, (ask?.now ?? Date.now)() - started);
    logVisibility("visibility.question", {
      provider: provider.id,
      model,
      httpStatus: extra.httpStatus,
      status: extra.httpStatus,
      errorClass: extra.errorClass ?? (record.error ? errorClassOf(undefined, record.error) : undefined),
      errorType: extra.errorType,
      errorParam: extra.errorParam,
      errorMessage: extra.errorMessage ? sanitizeErrorSnippet(extra.errorMessage) : undefined,
      latencyMs,
      mentioned: record.mentioned,
      rank: record.rank,
    });
    return { ...base, ...record };
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
    const parsed = parseAnswer(text, input.businessName, { websiteUrl: input.websiteUrl });
    return finish({
      demo: true,
      text,
      mentioned: parsed.mentioned,
      rank: parsed.rank,
      competitors: parsed.competitors,
      sources: parsed.sources,
      points: pointsFor(parsed.mentioned, parsed.rank),
    });
  }

  try {
    const live = await provider.answer(buildPrompt(question.text, input), {
      ...ask,
      city: input.city,
      state: input.state,
    });
    if (!live.text) {
      return finish(
        {
          demo: false,
          text: "",
          mentioned: false,
          rank: null,
          competitors: [],
          sources: live.sources,
          error: `${provider.name} returned an empty answer.`,
          points: 0,
        },
        { errorClass: "empty", httpStatus: live.httpStatus, latencyMs: live.latencyMs },
      );
    }
    const parsed = parseAnswer(live.text, input.businessName, {
      websiteUrl: input.websiteUrl,
      extraSources: live.sources,
    });
    return finish(
      {
        demo: false,
        text: live.text,
        mentioned: parsed.mentioned,
        rank: parsed.rank,
        competitors: parsed.competitors,
        sources: mergeSources(parsed.sources, live.sources),
        points: pointsFor(parsed.mentioned, parsed.rank),
      },
      { httpStatus: live.httpStatus, latencyMs: live.latencyMs },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : `${provider.name} failed.`;
    return finish(
      {
        demo: false,
        text: "",
        mentioned: false,
        rank: null,
        competitors: [],
        sources: [],
        error: message.slice(0, 240),
        points: 0,
      },
      {
        errorClass: errorClassOf(error, message),
        httpStatus:
          error && typeof error === "object" && "httpStatus" in error
            ? Number((error as { httpStatus?: number }).httpStatus)
            : undefined,
        errorType:
          error && typeof error === "object" && typeof (error as { errorType?: unknown }).errorType === "string"
            ? (error as { errorType: string }).errorType
            : undefined,
        errorParam:
          error && typeof error === "object" && typeof (error as { errorParam?: unknown }).errorParam === "string"
            ? (error as { errorParam: string }).errorParam
            : undefined,
        errorMessage:
          error && typeof error === "object" && typeof (error as { errorMessage?: unknown }).errorMessage === "string"
            ? (error as { errorMessage: string }).errorMessage
            : undefined,
      },
    );
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
    minStartGapMs?: number;
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
  const minStartGapMs = options.minStartGapMs ?? MIN_AGENT_START_GAP_MS;
  let lastLiveStart = 0;
  let paceChain = Promise.resolve();
  let siteCheckTimer: ReturnType<typeof setTimeout> | undefined;

  const waitForLiveSlot = async (configured: boolean) => {
    if (!configured || minStartGapMs <= 0) return;
    const turn = paceChain.then(async () => {
      const wait = Math.max(0, minStartGapMs - (now() - lastLiveStart));
      if (wait > 0) await defaultSleep(wait, controller.signal);
      lastLiveStart = now();
    });
    paceChain = turn.catch(() => undefined);
    await turn;
  };

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

  const canStillFinish = () => {
    const projected = tasks.map((task, index) => {
      const existing = results[index];
      if (existing) return existing;
      return { providerId: task.provider.id };
    });
    return scanIsComplete({ answers: projected });
  };
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
          await waitForLiveSlot(task.provider.configured());
          if (outOfTime() || !canStillFinish()) {
            results[index] = cancelledAnswer(task, "The check ran out of time.");
            return;
          }
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
          siteCheckTimer = setTimeout(() => resolve(null), leftover);
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

    logVisibility("visibility.scan", {
      complete,
      answerCount: usable.length,
      mentionCount,
      score,
      latencyMs: Math.max(0, now() - started),
      providers: providerStats.map((provider) => ({
        id: provider.id,
        answers: provider.answers,
        errors: provider.errors,
        mentions: provider.mentions,
      })),
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
    if (siteCheckTimer) clearTimeout(siteCheckTimer);
    options.signal?.removeEventListener("abort", onParentAbort);
  }
}
