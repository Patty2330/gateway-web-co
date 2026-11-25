import { getStore } from "@/lib/db";
import { getEmailSender } from "@/lib/email";
import { executeScan } from "@/lib/engine";
import { scanIsComplete } from "@/lib/scan-complete";
import { monitorEmail } from "@/lib/monitor-email";
import { addDaysIso } from "@/lib/purchase";
import { appUrlFrom, monitorDays, safeEqual } from "@/lib/request";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const store = await getStore();
  const due = await store.dueMonitors(new Date().toISOString());
  const results: { id: string; previous: number; score: number }[] = [];

  for (const scan of due) {
    const payload = await executeScan(
      {
        businessName: scan.businessName,
        category: scan.category,
        city: scan.city,
        state: scan.state,
        websiteUrl: scan.websiteUrl,
      },
      scan.payload.questions,
    );
    if (!scanIsComplete(payload) || payload.score == null) {
      // Leave nextRunAt due so the next cron can retry. Do not overwrite a finished report.
      continue;
    }
    const nextRunAt = addDaysIso(new Date(), monitorDays());
    await store.updateResults(scan.id, payload, {
      previousScore: scan.score ?? 0,
      nextRunAt,
    });
    if (scan.email) {
      const message = monitorEmail({
        businessName: scan.businessName,
        previousScore: scan.score ?? 0,
        score: payload.score,
        mentionCount: payload.mentionCount,
        answerCount: payload.answerCount,
        url: `${appUrlFrom(request)}/scans/${scan.id}`,
      });
      await getEmailSender().send({ to: scan.email, ...message, scanId: scan.id });
    }
    results.push({ id: scan.id, previous: scan.score ?? 0, score: payload.score });
  }

  return Response.json({ ran: results.length, results });
}
