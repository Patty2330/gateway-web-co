import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { namesMatch, textIncludesName } from "@/lib/names";
import { parseAnswer } from "@/lib/parse";

const BUSINESS = "Appleton's Harley-Davidson";

describe("Appleton Harley-Davidson matching", () => {
  it("treats possessive 's and curly ’s as optional", () => {
    expect(namesMatch("Appleton harley davidson", BUSINESS)).toBe(true);
    expect(namesMatch("Appleton’s Harley-Davidson®", BUSINESS)).toBe(true);
    expect(textIncludesName("Visit Appleton harley davidson on Fort Campbell Blvd", BUSINESS)).toBe(
      true,
    );
    expect(textIncludesName("Appleton’s Harley-Davidson® is open today", BUSINESS)).toBe(true);
  });

  it("matches distinctive aliases without requiring the full legal name", () => {
    expect(namesMatch("Appleton HD", BUSINESS)).toBe(true);
    expect(namesMatch("Appleton H-D", BUSINESS)).toBe(true);
    expect(namesMatch("Appleton Harley-Davidson® Clarksville", BUSINESS)).toBe(true);
    expect(textIncludesName("I'd start with Appleton HD.", BUSINESS)).toBe(true);
    expect(textIncludesName("Appleton H-D has inventory this week.", BUSINESS)).toBe(true);
  });

  it("does not treat a bare brand, a short first word, or another city's dealer as a hit", () => {
    expect(namesMatch("Harley-Davidson", BUSINESS)).toBe(false);
    expect(textIncludesName("Harley-Davidson makes motorcycles.", BUSINESS)).toBe(false);
    expect(namesMatch("Ace", "Ace Plumbing")).toBe(false);
    expect(textIncludesName("Ace is a playing card company.", "Ace Plumbing")).toBe(false);
    expect(namesMatch("Boswell's Harley-Davidson Nashville", BUSINESS)).toBe(false);
    expect(textIncludesName("Try Boswell's Harley-Davidson Nashville instead.", BUSINESS)).toBe(
      false,
    );
  });
});

describe("parseAnswer domain and list-line matching", () => {
  it("credits a mention when a citation URL uses the submitted registrable domain", () => {
    const parsed = parseAnswer(
      `Here are some options for a Clarksville motorcycle dealer.

1. A regional listing — see the inventory online.

Sources: [Inventory](https://www.appletonharley.com/new-inventory)`,
      BUSINESS,
      { websiteUrl: "https://appletonharley.com" },
    );
    expect(parsed.mentioned).toBe(true);
  });

  it("credits a bare domain in the answer text or a subdomain citation, and ignores www", () => {
    const inText = parseAnswer(
      "Check appletonharley.com for hours and a service appointment.",
      BUSINESS,
      { websiteUrl: "https://www.appletonharley.com/" },
    );
    expect(inText.mentioned).toBe(true);

    const subdomain = parseAnswer(
      "More details: https://shop.appletonharley.com/service",
      BUSINESS,
      { websiteUrl: "https://appletonharley.com" },
    );
    expect(subdomain.mentioned).toBe(true);
  });

  it("does not credit generic directory domains unless that is the submitted site", () => {
    const yelp = parseAnswer(
      "See reviews at https://www.yelp.com/biz/appleton-harley-davidson",
      BUSINESS,
      { websiteUrl: "https://appletonharley.com" },
    );
    expect(yelp.mentioned).toBe(false);

    const facebook = parseAnswer(
      "Their page is https://www.facebook.com/appletonharley",
      BUSINESS,
      { websiteUrl: "https://appletonharley.com" },
    );
    expect(facebook.mentioned).toBe(false);

    const google = parseAnswer(
      "Listed at https://www.google.com/maps/place/Appleton",
      BUSINESS,
      { websiteUrl: "https://appletonharley.com" },
    );
    expect(google.mentioned).toBe(false);
  });

  it("runs textIncludesName on each raw list-item line, not only the split head", () => {
    const parsed = parseAnswer(
      `People often name a few shops:

1. Local pick: Appleton HD — strong service department
2. Another dealer in Nashville — Boswell's Harley-Davidson Nashville
`,
      BUSINESS,
    );
    expect(parsed.mentioned).toBe(true);
    expect(parsed.rank).toBe(1);
  });
});

describe("scan form category suggestions", () => {
  it("includes motorcycle dealer and Harley-Davidson dealer", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/components/scan-form.tsx"),
      "utf8",
    );
    expect(source).toContain("motorcycle dealer");
    expect(source).toContain("Harley-Davidson dealer");
  });
});
