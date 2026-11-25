import { scoreHint, scoreLabel, summarySentence } from "@/lib/score";
import type { Finding, ScanRecord } from "@/lib/types";

export type PublicScan = {
  id: string;
  businessName: string;
  category: string;
  city: string;
  state: string;
  websiteUrl: string | null;
  createdAt: string;
  mode: ScanRecord["mode"];
  score: number;
  label: string;
  hint: string;
  summary: string;
  mentionCount: number;
  answerCount: number;
  tier: ScanRecord["tier"];
  unlocked: boolean;
  nextRunAt: string | null;
  providers: ScanRecord["payload"]["providers"];
  topFindings: Finding[];
  lockedFindingCount: number;
  competitorCount: number;
  demoAnswerCount: number;
  liveAnswerCount: number;
  findings?: Finding[];
  competitors?: ScanRecord["payload"]["competitors"];
  answers?: ScanRecord["payload"]["answers"];
  questions?: ScanRecord["payload"]["questions"];
  siteCheck?: ScanRecord["payload"]["siteCheck"];
};

export function presentScan(scan: ScanRecord): PublicScan {
  const unlocked = scan.tier !== "free";
  const findings = scan.payload.findings;
  const answers = scan.payload.answers;
  return {
    id: scan.id,
    businessName: scan.businessName,
    category: scan.category,
    city: scan.city,
    state: scan.state,
    websiteUrl: scan.websiteUrl,
    createdAt: scan.createdAt,
    mode: scan.mode,
    score: scan.score,
    label: scoreLabel(scan.score),
    hint: scoreHint(scan.score),
    summary: summarySentence(
      scan.payload.mentionCount,
      scan.payload.answerCount,
      scan.businessName,
    ),
    mentionCount: scan.payload.mentionCount,
    answerCount: scan.payload.answerCount,
    tier: scan.tier,
    unlocked,
    nextRunAt: scan.nextRunAt,
    providers: scan.payload.providers,
    topFindings: findings.slice(0, 3),
    lockedFindingCount: Math.max(0, findings.length - 3),
    competitorCount: scan.payload.competitors.length,
    demoAnswerCount: answers.filter((answer) => answer.demo && !answer.error).length,
    liveAnswerCount: answers.filter((answer) => !answer.demo && !answer.error).length,
    ...(unlocked
      ? {
          findings,
          competitors: scan.payload.competitors,
          answers,
          questions: scan.payload.questions,
          siteCheck: scan.payload.siteCheck,
        }
      : {}),
  };
}
