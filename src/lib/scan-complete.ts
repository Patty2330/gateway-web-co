import type { AnswerRecord, ScanPayload } from "@/lib/types";

/** A live check asks eight customer questions. */
export const QUESTIONS_PER_SCAN = 8;

/** A scan is only finished, scored, and cacheable with at least this many usable answers. */
export const MIN_ANSWERS_TO_FINISH = 6;

/** Shown on the results page and in the public API when a live check comes back short. */
export const UNFINISHED_SCAN_MESSAGE =
  "The check didn't finish. Please try again in a few minutes.";

export function usableAnswerCount(answers: Pick<AnswerRecord, "error">[]): number {
  return answers.filter((answer) => !answer.error).length;
}

export function scanIsComplete(
  payload: Pick<ScanPayload, "answerCount" | "answers"> | { answerCount?: number; answers?: Pick<AnswerRecord, "error">[] },
): boolean {
  if (Array.isArray(payload.answers) && payload.answers.length > 0) {
    return usableAnswerCount(payload.answers) >= MIN_ANSWERS_TO_FINISH;
  }
  return (payload.answerCount ?? 0) >= MIN_ANSWERS_TO_FINISH;
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
