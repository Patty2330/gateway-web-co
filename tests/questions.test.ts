import { describe, expect, it } from "vitest";

import { buildDemoAnswer, demoPlacement, demoSeed } from "@/lib/demo";
import { buildFindings } from "@/lib/findings";
import { parseAnswer } from "@/lib/parse";
import { buildQuestions } from "@/lib/questions";
import type { ProviderId } from "@/lib/types";

describe("questions", () => {
  it("asks eight local questions and changes the extra one by trade", () => {
    const plumbing = buildQuestions({ category: "plumber", city: "Clarksville", state: "TN" });
    expect(plumbing).toHaveLength(8);
    expect(plumbing.every((question) => question.text.includes("Clarksville"))).toBe(true);
    expect(plumbing.every((question) => /plumber/i.test(question.text))).toBe(true);
    expect(plumbing.some((question) => /emergency/i.test(question.text))).toBe(true);

    const salon = buildQuestions({ category: "salon", city: "Clarksville", state: "TN" });
    expect(salon.some((question) => /appointment/i.test(question.text))).toBe(true);
  });
});

describe("demo answers", () => {
  it("parse back to the rank the sample meant to show", () => {
    const input = {
      businessName: "Harper's Plumbing",
      category: "plumber",
      city: "Clarksville",
      state: "TN",
    };
    const seed = demoSeed(input);
    const providers: ProviderId[] = ["openai", "perplexity", "gemini"];
    for (const providerId of providers) {
      for (let index = 0; index < 8; index++) {
        const expected = demoPlacement(seed, providerId, index);
        const text = buildDemoAnswer({ ...input, providerId, questionIndex: index, seed });
        const parsed = parseAnswer(text, input.businessName);
        expect(parsed.sources.some((source) => source.url.includes("example.com"))).toBe(true);
        if (expected == null) {
          expect(parsed.mentioned).toBe(false);
        } else {
          expect(parsed.mentioned).toBe(true);
          expect(parsed.rank).toBe(expected);
        }
      }
    }
  });
});

describe("findings", () => {
  it("leads with the Google listing when the business is almost never named", () => {
    const findings = buildFindings({
      businessName: "Harper's Plumbing",
      category: "plumber",
      city: "Clarksville",
      websiteUrl: null,
      mentionCount: 0,
      answerCount: 8,
      answers: Array.from({ length: 8 }, () => ({
        mentioned: false,
        rank: null,
        question: "What is the best plumber in Clarksville, TN?",
      })),
      competitors: [{ name: "Cumberland Plumber", mentions: 6, bestRank: 1 }],
      siteCheck: null,
    });
    expect(findings[0]?.id).toBe("google-profile");
    expect(findings.map((finding) => finding.id)).toContain("website-missing");
    expect(findings.find((finding) => finding.id === "website-missing")?.fix).toContain(
      "Gateway Web Co",
    );
    expect(findings.length).toBeGreaterThanOrEqual(5);
    const priorities = findings.map((finding) => finding.priority);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
  });

  it("asks for schema and contact details when the site is thin", () => {
    const findings = buildFindings({
      businessName: "Harper's Plumbing",
      category: "plumber",
      city: "Clarksville",
      websiteUrl: "https://harpers.example",
      mentionCount: 8,
      answerCount: 8,
      answers: Array.from({ length: 8 }, () => ({
        mentioned: true,
        rank: 1,
        question: "What is the best plumber in Clarksville, TN?",
      })),
      competitors: [],
      siteCheck: {
        url: "https://harpers.example",
        ok: true,
        title: "Home",
        metaDescription: "Welcome",
        hasViewport: true,
        hasLocalBusinessSchema: false,
        schemaTypes: [],
        hasBusinessName: true,
        hasPhone: false,
        hasAddress: false,
        hasFaq: false,
      },
    });
    const ids = findings.map((finding) => finding.id);
    expect(ids).toContain("schema");
    expect(ids).toContain("nap");
    expect(ids[0]).not.toBe("google-profile");
  });
});
