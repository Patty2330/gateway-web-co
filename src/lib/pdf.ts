import PDFDocument from "pdfkit";

import { formatCityState } from "@/lib/place";
import type { PublicScan } from "@/lib/present";

const REPORT_ZONE = "America/Chicago";

export function formatReportTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}


function writeLine(doc: PDFKit.PDFDocument, text: string, options?: PDFKit.Mixins.TextOptions) {
  doc.text(text, options);
}

export function renderReportPdf(scan: PublicScan): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Times-Bold").fontSize(22).fillColor("#231c17");
    writeLine(doc, "AI Visibility Check");
    doc.moveDown(0.2);
    doc.font("Times-Roman").fontSize(11).fillColor("#5c5348");
    writeLine(doc, "Gateway Web Co  ·  Clarksville, Tennessee");
    doc.moveDown(0.8);

    doc.font("Times-Bold").fontSize(16).fillColor("#231c17");
    writeLine(doc, scan.businessName);
    doc.font("Times-Roman").fontSize(12);
    writeLine(
      doc,
      `${scan.category} in ${formatCityState(scan.city, scan.state)}${scan.websiteUrl ? `  ·  ${scan.websiteUrl}` : ""}`,
    );
    writeLine(doc, `Checked ${formatReportTime(scan.createdAt)}`);
    doc.moveDown(0.6);

    if (scan.complete) {
      doc.font("Times-Bold").fontSize(28).fillColor("#8d2c2c");
      writeLine(doc, `${scan.score} / 100`);
      doc.font("Times-Bold").fontSize(13).fillColor("#1f4d3a");
      writeLine(doc, scan.label);
      doc.font("Times-Roman").fontSize(12).fillColor("#231c17");
      writeLine(doc, scan.summary);
      writeLine(doc, scan.hint);
    } else {
      doc.font("Times-Bold").fontSize(16).fillColor("#8d2c2c");
      writeLine(doc, "The check didn't finish");
      doc.font("Times-Roman").fontSize(12).fillColor("#231c17");
      writeLine(doc, scan.summary);
    }

    if (scan.mode === "demo" || scan.demoAnswerCount > 0) {
      doc.moveDown(0.5);
      doc.fillColor("#8d2c2c").font("Times-Bold").fontSize(16);
      writeLine(doc, "SAMPLE REPORT");
      doc.font("Times-Roman").fontSize(11);
      writeLine(
        doc,
        "This is a sample report, not a live Perplexity result. Do not treat the score as real until a Perplexity key is connected.",
      );
      doc.fillColor("#231c17");
    }

    doc.moveDown(0.8);
    doc.font("Times-Bold").fontSize(14);
    writeLine(doc, "What to fix");
    doc.font("Times-Roman").fontSize(11);
    for (const finding of scan.findings ?? scan.topFindings) {
      doc.moveDown(0.45);
      doc.font("Times-Bold").fontSize(12);
      writeLine(doc, finding.title);
      doc.font("Times-Roman").fontSize(11);
      writeLine(doc, finding.why);
      writeLine(doc, finding.fix);
    }

    doc.moveDown(0.8);
    doc.font("Times-Bold").fontSize(14);
    writeLine(doc, "Businesses named instead");
    doc.font("Times-Roman").fontSize(11);
    const competitors = scan.competitors ?? [];
    if (competitors.length === 0) {
      doc.moveDown(0.3);
      writeLine(doc, "No other business was pulled out of the answers.");
    } else {
      for (const competitor of competitors) {
        doc.moveDown(0.25);
        const rank = competitor.bestRank ? `, best spot #${competitor.bestRank}` : "";
        writeLine(doc, `${competitor.name} — named ${competitor.mentions} time${competitor.mentions === 1 ? "" : "s"}${rank}`);
      }
    }

    doc.moveDown(0.8);
    doc.font("Times-Bold").fontSize(14);
    writeLine(doc, "Question by question");
    doc.font("Times-Roman").fontSize(11);
    const questions = scan.questions ?? [];
    const answers = scan.answers ?? [];
    for (const question of questions) {
      doc.moveDown(0.45);
      doc.font("Times-Bold").fontSize(12);
      writeLine(doc, question.text);
      doc.font("Times-Roman").fontSize(10);
      for (const answer of answers.filter((item) => item.questionId === question.id)) {
        doc.moveDown(0.2);
        const place = answer.error
          ? "didn't answer"
          : answer.mentioned
            ? answer.rank
              ? `named you #${answer.rank}`
              : "named you"
            : "did not name you";
        const sample = answer.demo ? " (sample)" : "";
        doc.font("Times-Bold");
        writeLine(doc, `${answer.providerName}${sample}: ${place} · ${answer.points} pts`);
        doc.font("Times-Roman");
        if (answer.error) writeLine(doc, answer.error);
        else writeLine(doc, answer.text.slice(0, 700));
      }
    }

    if (scan.siteCheck) {
      doc.moveDown(0.8);
      doc.font("Times-Bold").fontSize(14);
      writeLine(doc, "Website check");
      doc.font("Times-Roman").fontSize(11);
      const site = scan.siteCheck;
      doc.moveDown(0.3);
      if (!site.ok) {
        writeLine(doc, site.error || "The site could not be read.");
      } else {
        writeLine(doc, `Title: ${site.title || "(missing)"}`);
        writeLine(doc, `Description: ${site.metaDescription || "(missing)"}`);
        writeLine(doc, `LocalBusiness schema: ${site.hasLocalBusinessSchema ? "yes" : "no"}`);
        writeLine(doc, `Name on page: ${site.hasBusinessName ? "yes" : "no"}`);
        writeLine(doc, `Phone on page: ${site.hasPhone ? "yes" : "no"}`);
        writeLine(doc, `Address on page: ${site.hasAddress ? "yes" : "no"}`);
        writeLine(doc, `FAQ: ${site.hasFaq ? "yes" : "no"}`);
        writeLine(doc, `Phone-friendly viewport: ${site.hasViewport ? "yes" : "no"}`);
      }
    }

    doc.moveDown(1);
    doc.font("Times-Bold").fontSize(12).fillColor("#8d2c2c");
    writeLine(doc, "Get it fixed by Gateway Web Co");
    doc.font("Times-Roman").fontSize(11).fillColor("#231c17");
    writeLine(
      doc,
      "Jalen builds websites for local businesses in Clarksville. The first 10 clients are $500, paid only when you're 100% happy. Use the contact form on your check to send a note.",
    );

    doc.end();
  });
}
