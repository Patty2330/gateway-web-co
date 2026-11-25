import { describe, expect, it } from "vitest";

import { buildFindings } from "@/lib/findings";
import { friendlySiteError } from "@/lib/site-check";

const base = {
  businessName: "Harper's Plumbing",
  category: "plumber",
  city: "Clarksville",
  websiteUrl: "https://example.com",
  mentionCount: 3,
  answerCount: 8,
  answers: [
    { mentioned: true, rank: 2, error: undefined, question: "Who is the best plumber?" },
    { mentioned: false, rank: null, error: undefined, question: "Who is open now?" },
  ],
  competitors: [{ name: "Cumberland Plumber", mentions: 8, bestRank: 1 }],
};

describe("friendlySiteError", () => {
  it("maps raw DNS and fetch errors to plain language", () => {
    expect(friendlySiteError("getaddrinfo ENOTFOUND ftp")).toMatch(/couldn't find that website/i);
    expect(friendlySiteError("fetch failed")).toMatch(/couldn't reach that website/i);
    expect(friendlySiteError("The operation was aborted")).toMatch(/too long/i);
    expect(friendlySiteError("The website returned status 500.")).toBe("The website returned status 500.");
  });
});

describe("buildFindings", () => {
  it("puts an unreadable website first so it lands in the free top 3", () => {
    const findings = buildFindings({
      ...base,
      siteCheck: {
        url: "https://missing.example",
        ok: false,
        error: "We couldn't find that website. Check the address and try again.",
        finalUrl: undefined,
        title: null,
        metaDescription: null,
        hasViewport: false,
        hasLocalBusinessSchema: false,
        schemaTypes: [],
        hasBusinessName: false,
        hasPhone: false,
        hasAddress: false,
        hasFaq: false,
      },
    });
    expect(findings[0]?.id).toBe("site-unread");
    expect(findings.slice(0, 3).some((finding) => finding.id === "site-unread")).toBe(true);
  });

  it("does not mention the Perplexity env var in customer-facing copy", () => {
    const findings = buildFindings({
      ...base,
      mentionCount: 0,
      answerCount: 0,
      answers: [],
      competitors: [],
      siteCheck: null,
      websiteUrl: null,
    });
    const text = findings.map((finding) => `${finding.why} ${finding.fix}`).join(" ");
    expect(text).not.toContain("PERPLEXITY_API_KEY");
  });
});
