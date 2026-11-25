import { getStore } from "@/lib/db";
import { renderReportPdf } from "@/lib/pdf";
import { presentScan } from "@/lib/present";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const store = await getStore();
  const scan = await store.getScan(id);
  if (!scan) return Response.json({ error: "We can't find that check." }, { status: 404 });
  const view = presentScan(scan);
  if (!view.unlocked) {
    return Response.json(
      { error: "The PDF is part of the full report. Unlock it for $49." },
      { status: 402 },
    );
  }
  const pdf = await renderReportPdf(view);
  const slug = scan.businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ai-visibility-${slug || "report"}.pdf"`,
    },
  });
}
