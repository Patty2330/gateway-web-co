import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { gateway, leadEmailSubject } from "@/lib/gateway";
import { monitorEmail } from "@/lib/monitor-email";
import { renderReportPdf } from "@/lib/pdf";
import type { PublicScan } from "@/lib/present";
import { getSite } from "@/lib/site";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      className,
    }: {
      href: string;
      children?: React.ReactNode;
      className?: string;
    }) => React.createElement("a", { href, className }, children),
  };
});

function expectPublicBrand(text: string) {
  expect(text).toContain("Two Forks Studio");
  expect(text).not.toContain("Gateway Web Co");
}

/** Pull readable strings out of a PDFKit buffer (content streams are Flate-compressed). */
function pdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const streams: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  for (const match of raw.matchAll(streamRe)) {
    const bytes = Buffer.from(match[1], "latin1");
    for (const candidate of [bytes, bytes.subarray(0, -1), bytes.subarray(0, -2)]) {
      try {
        streams.push(inflateSync(candidate).toString("latin1"));
        break;
      } catch {
        // Try a slightly shorter slice; the stream may include a trailing newline.
      }
    }
  }
  const decoded = streams.join("\n");
  const parts: string[] = [];
  const re = /\((?:\\[()\\]|[^()])*\)|<([0-9A-Fa-f\s]+)>/g;
  for (const match of decoded.matchAll(re)) {
    if (match[0].startsWith("<")) {
      const hex = (match[1] ?? "").replace(/\s+/g, "");
      if (hex.length % 2 === 0 && hex.length > 0) {
        parts.push(Buffer.from(hex, "hex").toString("latin1"));
      }
    } else {
      parts.push(
        match[0]
          .slice(1, -1)
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\([()\\])/g, "$1"),
      );
    }
  }
  return parts.join("");
}

function sampleScan(): PublicScan {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    businessName: "Harper's Plumbing",
    category: "plumber",
    city: "Clarksville",
    state: "TN",
    websiteUrl: null,
    createdAt: "2026-11-25T16:30:00.000Z",
    mode: "live",
    complete: true,
    score: 30,
    label: "Rarely named",
    hint: "Customers who ask AI will usually see another business first.",
    summary: "Harper's Plumbing was named in 3 of 8 answers.",
    mentionCount: 3,
    answerCount: 8,
    tier: "report",
    unlocked: true,
    nextRunAt: null,
    providers: [],
    topFindings: [],
    lockedFindingCount: 0,
    competitorCount: 0,
    demoAnswerCount: 0,
    liveAnswerCount: 8,
    findings: [],
    competitors: [],
    answers: [],
    questions: [],
  };
}


function expectUnfinishedPdfHasNoScore(text: string) {
  expect(text).not.toMatch(/0\s*\/\s*100/);
  expect(text).not.toMatch(/\d+\s*\/\s*100/);
  expect(text).not.toMatch(/null\s*\/\s*100/i);
}

describe("public brand", () => {
  it("uses Two Forks Studio as the homepage title and in seo.description", () => {
    const site = getSite();
    expect(site.business_name).toBe("Two Forks Studio");
    expect(site.seo.title).toBe("Two Forks Studio | $500 Websites for Clarksville, TN Businesses");
    expectPublicBrand(site.seo.title);
    expectPublicBrand(site.seo.description);
    expectPublicBrand(site.seo.social_title);
    expect(site.seo.social_description).not.toContain("Gateway Web Co");
  });

  it("keeps the check copy on the same public name", () => {
    expect(gateway.name).toBe("Two Forks Studio");
    expectPublicBrand(gateway.buildPitch);
  });

  it("puts Two Forks Studio in the generated PDF and leaves Gateway Web Co out", async () => {
    const text = pdfText(await renderReportPdf(sampleScan()));
    expectPublicBrand(text);
    expect(text).toContain("Get it fixed by Two Forks Studio");
  });

  it("keeps Two Forks Studio on an unfinished PDF and does not print 0/100", async () => {
    const scan = {
      ...sampleScan(),
      complete: false,
      score: null,
      label: "",
      hint: "",
      summary: "The check didn't finish. Please try again in a few minutes.",
      mentionCount: 1,
      answerCount: 1,
      liveAnswerCount: 1,
    };
    const text = pdfText(await renderReportPdf(scan));
    expectPublicBrand(text);
    expect(text).toContain("Get it fixed by Two Forks Studio");
    expect(text).toContain("The check didn't finish");
    expectUnfinishedPdfHasNoScore(text);
  });

  it("fails if the score branch is forced with a null score", () => {
    const forced = `${null} / 100`;
    expect(forced).toBe("null / 100");
    expect(() => expectUnfinishedPdfHasNoScore(forced)).toThrow();
    expect(() => expectUnfinishedPdfHasNoScore("null/100")).toThrow();
  });

  it("renders Two Forks Studio in the header and footer", () => {
    const header = renderToStaticMarkup(createElement(SiteHeader));
    const footer = renderToStaticMarkup(createElement(SiteFooter));
    expectPublicBrand(header);
    expectPublicBrand(footer);
  });

  it("signs the monitor email as Two Forks Studio", () => {
    const message = monitorEmail({
      businessName: "Harper's Plumbing",
      previousScore: 30,
      score: 32,
      mentionCount: 3,
      answerCount: 8,
      url: "http://127.0.0.1:43123/scans/example",
    });
    expectPublicBrand(message.text);
    expect(message.subject).not.toContain("Gateway Web Co");
  });

  it("uses Two Forks Studio in the leads email subject", () => {
    const subject = leadEmailSubject("Sam");
    expectPublicBrand(subject);
    expect(subject).toBe("New Two Forks Studio note from Sam");
  });

  it("uses Two Forks Studio in the check layout title", async () => {
    const { metadata } = await import("@/app/(check)/layout");
    expectPublicBrand(String(metadata.title));
    expect(metadata.title).toBe("Free AI visibility check · Two Forks Studio");
    expectPublicBrand(String(metadata.openGraph?.siteName ?? ""));
    expectPublicBrand(String(metadata.openGraph?.title ?? ""));
    expectPublicBrand(String(metadata.twitter?.title ?? ""));
  });

  it("keeps leftover Gateway Web Co, gatewaywebco, and Red River Sites out of user-facing files", () => {
    const forbidden = [/Gateway\s+Web\s+Co/i, /gatewaywebco/i, /Red\s+River\s+Sites/i];
    const allowed = [
      /gatewaywebco@gmail\.com/gi,
      /https?:\/\/(?:www\.)?github\.com\/Patty2330\/gateway-web-co/gi,
      /https?:\/\/patty2330\.github\.io\/gateway-web-co/gi,
      /https?:\/\/gateway-web-co\.onrender\.com/gi,
      /Patty2330\/gateway-web-co/gi,
    ];
    const roots = ["README.md", ".env.example", "_data", "src", "styles.css", "public", "assets"];
    const skip = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|map|svg)$/i;

    function walk(rel: string): string[] {
      const abs = path.join(process.cwd(), rel);
      const st = statSync(abs);
      if (st.isFile()) return [rel];
      if (!st.isDirectory()) return [];
      const out: string[] = [];
      for (const entry of readdirSync(abs, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        if (entry.isSymbolicLink()) continue;
        out.push(...walk(path.join(rel, entry.name)));
      }
      return out;
    }

    const hits: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        if (skip.test(file)) continue;
        let contents = readFileSync(path.join(process.cwd(), file), "utf8");
        for (const allow of allowed) {
          contents = contents.replace(allow, "");
        }
        for (const pattern of forbidden) {
          const match = contents.match(pattern);
          if (match) hits.push(`${file}: ${match[0]}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
