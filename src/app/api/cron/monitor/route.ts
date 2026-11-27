import { getStore } from "@/lib/db";
import { getEmailSender } from "@/lib/email";
import { runDueMonitors } from "@/lib/monitor-run";
import { appUrlFrom, monitorDays, safeEqual } from "@/lib/request";

/**
 * Called once a day by .github/workflows/monthly-monitor.yml. Each subscriber
 * is re-checked on its own due date. One subscriber failing never stops the
 * rest, and the run stops starting new scans when its time budget is spent
 * (MONITOR_TIME_BUDGET_MS, default 120s). Anything left stays due for tomorrow.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const store = await getStore();
  const sender = getEmailSender();
  const summary = await runDueMonitors({
    store,
    appUrl: appUrlFrom(request),
    intervalDays: monitorDays(),
    sendEmail: (message) => sender.send(message),
  });

  return Response.json(summary);
}
