"use client";

import { formatCityState } from "@/lib/place";
import type { PublicScan } from "@/lib/present";

export function DownloadSummaryButton({ scan }: { scan: PublicScan }) {
  function download() {
    const lines = [
      `AI Visibility Check for ${scan.businessName}`,
      `${scan.category} in ${formatCityState(scan.city, scan.state)}`,
      scan.complete ? `Score: ${scan.score} / 100 (${scan.label})` : scan.summary,
      scan.complete ? scan.summary : "",
      "",
      "Fixes",
      ...(scan.findings ?? scan.topFindings).flatMap((finding) => [
        finding.title,
        finding.why,
        finding.fix,
        "",
      ]),
      "Other businesses named",
      ...(scan.competitors ?? []).map(
        (competitor) =>
          `${competitor.name} — ${competitor.mentions} mention${competitor.mentions === 1 ? "" : "s"}`,
      ),
      "",
      "Demo preview. This summary was built in the browser from sample answers.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ai-visibility-check.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
    >
      Download summary
    </button>
  );
}
