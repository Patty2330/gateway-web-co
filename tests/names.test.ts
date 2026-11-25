import { describe, expect, it } from "vitest";

import { namesMatch, normalizeName, textIncludesName } from "@/lib/names";

describe("name matching", () => {
  it("folds accents so Cafe matches Café and José's Taquería matches without marks", () => {
    expect(namesMatch("Cafe", "Café")).toBe(true);
    expect(namesMatch("Café", "Cafe")).toBe(true);
    expect(namesMatch("Joses Taqueria", "José's Taquería")).toBe(true);
    expect(textIncludesName("Visit José's Taquería today", "Joses Taqueria")).toBe(true);
  });

  it("treats a leading The as optional on both sides", () => {
    expect(namesMatch("The Customs House Museum", "Customs House Museum")).toBe(true);
    expect(namesMatch("Customs House Museum", "The Customs House Museum")).toBe(true);
    expect(textIncludesName("Welcome to The Cafe on Main", "Cafe on Main")).toBe(true);
    expect(textIncludesName("Welcome to Cafe on Main Street", "The Cafe on Main")).toBe(true);
  });

  it("still requires a real name match", () => {
    expect(namesMatch("Ace", "Ace Plumbing")).toBe(false);
    expect(normalizeName("Café")).toBe("cafe");
  });
});
