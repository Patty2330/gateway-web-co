import { publicAnswerError, publicProviderStatus, scanIsComplete, UNFINISHED_SCAN_MESSAGE } from "@/lib/scan-complete";
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
  complete: boolean;
  score: number | null;
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

function publicProviders(scan: ScanRecord) {
  return scan.payload.providers.map((provider) => ({
    ...provider,
    error: publicProviderStatus(provider),
  }));
}

function publicAnswers(scan: ScanRecord) {
  return scan.payload.answers.map((answer) =>
    answer.error ? { ...answer, error: publicAnswerError(answer.error), text: "" } : answer,
  );
}

export function presentScan(scan: ScanRecord): PublicScan {
  const complete = scan.payload.complete ?? scanIsComplete(scan.payload);
  const unlocked = scan.tier !== "free";
  const findings = complete ? scan.payload.findings : [];
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
    complete,
    score: complete ? scan.score : null,
    label: complete ? scoreLabel(scan.score) : "",
    hint: complete ? scoreHint(scan.score) : "",
    summary: complete
      ? summarySentence(scan.payload.mentionCount, scan.payload.answerCount, scan.businessName)
      : UNFINISHED_SCAN_MESSAGE,
    mentionCount: complete ? scan.payload.mentionCount : 0,
    answerCount: scan.payload.answerCount,
    tier: scan.tier,
    unlocked,
    nextRunAt: scan.nextRunAt,
    providers: publicProviders(scan),
    topFindings: complete ? findings.slice(0, 3) : [],
    lockedFindingCount: complete ? Math.max(0, findings.length - 3) : 0,
    competitorCount: complete ? scan.payload.competitors.length : 0,
    demoAnswerCount: answers.filter((answer) => answer.demo && !answer.error).length,
    liveAnswerCount: answers.filter((answer) => !answer.demo && !answer.error).length,
    ...(unlocked && complete
      ? {
          findings,
          competitors: scan.payload.competitors,
          answers: publicAnswers(scan),
          questions: scan.payload.questions,
          siteCheck: scan.payload.siteCheck,
        }
      : {}),
  };
}
