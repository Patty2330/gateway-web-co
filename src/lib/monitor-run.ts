import type { EmailMessage } from "@/lib/email";
import { executeScan, SCAN_DEADLINE_MS } from "@/lib/engine";
import { monitorEmail } from "@/lib/monitor-email";
import { addDaysIso } from "@/lib/purchase";
import { scanIsComplete } from "@/lib/scan-complete";
import type { ScanPayload, ScanRecord } from "@/lib/types";

/**
 * Wall-clock budget for one POST /api/cron/monitor. The GitHub workflow calls
 * it with curl --max-time 180, so stop starting new scans well before that.
 */
export const MONITOR_TIME_BUDGET_MS = 120_000;
/**
 * Do not start a scan with less time than this left. A rushed scan would be
 * unfinished, cost API calls, and get thrown away. It runs tomorrow instead.
 */
export const MONITOR_MIN_SCAN_MS = 45_000;

function positiveNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return raw && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function monitorTimeBudgetMs(env: NodeJS.ProcessEnv = process.env): number {
  return positiveNumber(env.MONITOR_TIME_BUDGET_MS, MONITOR_TIME_BUDGET_MS);
}

export function monitorMinScanMs(env: NodeJS.ProcessEnv = process.env): number {
  return positiveNumber(env.MONITOR_MIN_SCAN_MS, MONITOR_MIN_SCAN_MS);
}

export interface MonitorStore {
  dueMonitors(nowIso: string): Promise<ScanRecord[]>;
  updateResults(
    id: string,
    payload: ScanPayload,
    update: { previousScore: number; nextRunAt: string; now?: Date },
  ): Promise<void>;
}

export type MonitorRunSummary = {
  ran: number;
  results: { id: string; previous: number; score: number; emailed: boolean }[];
  /** Re-ran but did not finish. Still due, so tomorrow's cron retries it. */
  unfinished: string[];
  /** Threw. Still due, so tomorrow's cron retries it. Later monitors still ran. */
  failed: { id: string; error: string }[];
  /** Not started because the time budget ran out. Still due. */
  deferred: number;
  due: number;
  budgetExhausted: boolean;
};

export async function runDueMonitors(input: {
  store: MonitorStore;
  appUrl: string;
  intervalDays: number;
  sendEmail: (message: EmailMessage) => Promise<unknown>;
  scan?: typeof executeScan;
  budgetMs?: number;
  minScanMs?: number;
  now?: () => number;
  log?: (line: string) => void;
}): Promise<MonitorRunSummary> {
  const now = input.now ?? Date.now;
  const scan = input.scan ?? executeScan;
  const budgetMs = input.budgetMs ?? monitorTimeBudgetMs();
  const minScanMs = Math.min(input.minScanMs ?? monitorMinScanMs(), budgetMs);
  const log = input.log ?? ((line: string) => console.error(line));
  const started = now();
  const deadlineAt = started + budgetMs;

  const due = await input.store.dueMonitors(new Date(started).toISOString());
  const summary: MonitorRunSummary = {
    ran: 0,
    results: [],
    unfinished: [],
    failed: [],
    deferred: 0,
    due: due.length,
    budgetExhausted: false,
  };

  for (let index = 0; index < due.length; index++) {
    const record = due[index];
    const remaining = deadlineAt - now();
    if (remaining < minScanMs) {
      summary.budgetExhausted = true;
      summary.deferred = due.length - index;
      break;
    }

    try {
      const payload = await scan(
        {
          businessName: record.businessName,
          category: record.category,
          city: record.city,
          state: record.state,
          websiteUrl: record.websiteUrl,
        },
        record.payload.questions,
        // Never let one scan run past the request budget.
        { deadlineMs: Math.min(SCAN_DEADLINE_MS, remaining) },
      );
      if (!scanIsComplete(payload) || payload.score == null) {
        // Leave nextRunAt due so the next cron can retry. Do not overwrite a finished report.
        summary.unfinished.push(record.id);
        continue;
      }
      const previous = record.score ?? 0;
      await input.store.updateResults(record.id, payload, {
        previousScore: previous,
        nextRunAt: addDaysIso(new Date(now()), input.intervalDays),
      });

      let emailed = false;
      if (record.email) {
        try {
          const message = monitorEmail({
            businessName: record.businessName,
            previousScore: previous,
            score: payload.score,
            mentionCount: payload.mentionCount,
            answerCount: payload.answerCount,
            url: `${input.appUrl}/scans/${record.id}`,
          });
          await input.sendEmail({ to: record.email, ...message, scanId: record.id });
          emailed = true;
        } catch (error) {
          // The new score is saved. A mail failure must not undo it or stop the run.
          log(JSON.stringify({ event: "monitor.email_failed", scanId: record.id, error: errorName(error) }));
        }
      }
      summary.results.push({ id: record.id, previous, score: payload.score, emailed });
      summary.ran += 1;
    } catch (error) {
      summary.failed.push({ id: record.id, error: errorMessage(error) });
      log(JSON.stringify({ event: "monitor.scan_failed", scanId: record.id, error: errorName(error) }));
    }
  }

  return summary;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 200) || "The re-check failed.";
}
