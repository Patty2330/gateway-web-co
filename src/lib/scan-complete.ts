import type { AnswerRecord, ProviderId } from "@/lib/types";

/** A live check asks eight customer questions. */
export const QUESTIONS_PER_SCAN = 8;

/**
 * Overall usable-answer floor for a three-model run (24 calls).
 * This is 16/24, not 6/24: two models can finish cleanly, or three can each
 * clear the per-model bar with a little room to spare.
 */
export const MIN_ANSWERS_TO_FINISH = 16;

/** A single provider still finishes with 6 of its 8 answers. */
export const MIN_ANSWERS_SINGLE_PROVIDER = 6;

/** Per-model usable-answer floor on a multi-model run. */
export const MIN_ANSWERS_PER_PROVIDER = 6;

/** At least this many models must clear the per-model bar. */
export const MIN_PROVIDERS_TO_FINISH = 2;

/** Shown on the results page and in the public API when a live check comes back short. */
export const UNFINISHED_SCAN_MESSAGE =
  "The check didn't finish. Please try again in a few minutes.";

export const UNFINISHED_CHECKOUT_MESSAGE =
  "This check didn't finish, so there's nothing to buy yet. Please run it again.";

export function usableAnswerCount(answers: Pick<AnswerRecord, "error">[]): number {
  return answers.filter((answer) => !answer.error).length;
}

function providerIds(answers: { providerId?: ProviderId | string }[]): string[] {
  return [
    ...new Set(
      answers
        .map((answer) => answer.providerId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
}

function providersMeetingBar(
  answers: { error?: string; providerId?: ProviderId | string }[],
): number {
  const counts = new Map<string, number>();
  for (const answer of answers) {
    if (answer.error) continue;
    const id = typeof answer.providerId === "string" && answer.providerId ? answer.providerId : "";
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.values()].filter((count) => count >= MIN_ANSWERS_PER_PROVIDER).length;
}

/**
 * A one-model check (or an older 8-answer record) finishes at 6/8.
 * A three-model check finishes at 16/24 with at least two models each
 * contributing 6 usable answers.
 */
export function scanIsComplete(
  payload: {
    answerCount?: number;
    answers?: { error?: string; providerId?: ProviderId | string }[];
  },
): boolean {
  if (Array.isArray(payload.answers) && payload.answers.length > 0) {
    const usable = usableAnswerCount(payload.answers);
    const ids = providerIds(payload.answers);
    const multiModel = payload.answers.length > QUESTIONS_PER_SCAN || ids.length >= 2;
    if (!multiModel) {
      return usable >= MIN_ANSWERS_SINGLE_PROVIDER;
    }
    if (usable < MIN_ANSWERS_TO_FINISH) return false;
    if (ids.length === 0) return true;
    return providersMeetingBar(payload.answers) >= MIN_PROVIDERS_TO_FINISH;
  }
  const total = payload.answerCount ?? 0;
  if (total > QUESTIONS_PER_SCAN) return total >= MIN_ANSWERS_TO_FINISH;
  return total >= MIN_ANSWERS_SINGLE_PROVIDER;
}

export function publicProviderStatus(provider: {
  name: string;
  answers: number;
  errors: number;
  error?: string;
}): string | undefined {
  if (provider.errors <= 0 && !provider.error) return undefined;
  if (provider.answers === 0) return `${provider.name} didn't answer.`;
  return `${provider.name} didn't finish every question.`;
}

export function publicAnswerError(error: string | undefined): string | undefined {
  if (!error) return undefined;
  return "This question didn't get an answer.";
}
