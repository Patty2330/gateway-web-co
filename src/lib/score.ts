import { namesMatch, normalizeName } from "@/lib/names";
import type { AnswerRecord, CompetitorStat } from "@/lib/types";

/**
 * Points for one answer. Rank 1 is a full mark. A mention with no list
 * position still counts, because the business was named.
 */
export function pointsFor(mentioned: boolean, rank: number | null): number {
  if (!mentioned) return 0;
  if (rank == null || rank < 1) return 35;
  if (rank === 1) return 100;
  if (rank === 2) return 80;
  if (rank === 3) return 60;
  if (rank === 4) return 40;
  return 20;
}

export function visibilityScore(
  rows: { mentioned: boolean; rank: number | null; error?: string }[],
): number {
  const usable = rows.filter((row) => !row.error);
  if (usable.length === 0) return 0;
  const total = usable.reduce((sum, row) => sum + pointsFor(row.mentioned, row.rank), 0);
  return Math.round(total / usable.length);
}

export function scoreLabel(score: number): string {
  if (score >= 75) return "Often recommended";
  if (score >= 50) return "Sometimes named";
  if (score >= 25) return "Rarely named";
  return "Hard to find";
}

export function scoreHint(score: number): string {
  if (score >= 75) {
    return "These AI answers are putting your business near the front of the list.";
  }
  if (score >= 50) {
    return "You show up some of the time. A stronger listing and a few fresh reviews can move you up.";
  }
  if (score >= 25) {
    return "Customers who ask AI will usually see another business first.";
  }
  return "Right now, these AI answers are sending people to other businesses.";
}

export function summarySentence(
  mentionCount: number,
  answerCount: number,
  businessName: string,
): string {
  if (answerCount === 0) {
    return "We couldn't get an answer from the AI tools on this run.";
  }
  if (mentionCount === 0) {
    return `None of the ${answerCount} answers named ${businessName}.`;
  }
  return `${businessName} was named in ${mentionCount} of ${answerCount} answers.`;
}

export function aggregateCompetitors(
  answers: Pick<AnswerRecord, "competitors" | "error">[],
  businessName: string,
): CompetitorStat[] {
  const map = new Map<string, CompetitorStat>();

  for (const answer of answers) {
    if (answer.error) continue;
    const seen = new Set<string>();
    for (const competitor of answer.competitors) {
      const key = normalizeName(competitor.name);
      if (!key || key.length < 3 || seen.has(key)) continue;
      if (namesMatch(competitor.name, businessName)) continue;
      seen.add(key);
      const current = map.get(key);
      if (!current) {
        map.set(key, {
          name: competitor.name,
          mentions: 1,
          bestRank: competitor.rank,
        });
        continue;
      }
      current.mentions += 1;
      if (
        competitor.rank != null &&
        (current.bestRank == null || competitor.rank < current.bestRank)
      ) {
        current.bestRank = competitor.rank;
      }
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      b.mentions - a.mentions ||
      (a.bestRank ?? 99) - (b.bestRank ?? 99) ||
      a.name.localeCompare(b.name),
  );
}
