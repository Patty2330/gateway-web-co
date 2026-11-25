import { gateway } from "@/lib/gateway";

export function monitorEmail(input: {
  businessName: string;
  previousScore: number;
  score: number;
  mentionCount: number;
  answerCount: number;
  url: string;
}): { subject: string; text: string } {
  const direction =
    input.score === input.previousScore
      ? "The score held steady."
      : input.score > input.previousScore
        ? `The score moved up, from ${input.previousScore} to ${input.score}.`
        : `The score moved down, from ${input.previousScore} to ${input.score}.`;

  return {
    subject: `AI visibility update for ${input.businessName}`,
    text: [
      `Monthly AI visibility check for ${input.businessName}`,
      "",
      direction,
      `This month the business was named in ${input.mentionCount} of ${input.answerCount} answers.`,
      "",
      `See the latest check: ${input.url}`,
      "",
      `${gateway.name} · Clarksville, TN`,
    ].join("\n"),
  };
}
