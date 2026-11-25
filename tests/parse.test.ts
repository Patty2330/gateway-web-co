import { describe, expect, it } from "vitest";

import { namesMatch, normalizeName } from "@/lib/names";
import { businessNameFromListItem, parseAnswer } from "@/lib/parse";

describe("name matching", () => {
  it("ignores legal suffixes, punctuation, and ampersands", () => {
    expect(normalizeName("Ace Plumbing, LLC")).toBe("ace plumbing");
    expect(normalizeName("Mike & Sons")).toBe("mike and sons");
    expect(namesMatch("Ace Plumbing LLC", "Ace Plumbing")).toBe(true);
    expect(namesMatch("Mike and Sons", "Mike & Sons")).toBe(true);
  });

  it("does not treat a shorter or overlapping name as the business", () => {
    expect(namesMatch("Ace", "Ace Plumbing")).toBe(false);
    expect(namesMatch("Best Ace Plumbing", "Ace Plumbing")).toBe(false);
    expect(namesMatch("Ace Plumbing of Clarksville", "Ace Plumbing")).toBe(true);
  });
});

describe("parseAnswer", () => {
  const sample = `
People looking for a plumber usually get a short list like this:

1. Cumberland Plumber — Often mentioned for weekday calls.
2. Harper's Plumbing — A smaller crew people name for straightforward jobs.
3. **Maple Street Plumber** — Listed with a phone number.

Sources: [Local roundup](https://example.com/sample-clarksville)
`;

  it("reads rank, competitors, and sources from a numbered answer", () => {
    const parsed = parseAnswer(sample, "Harper's Plumbing");
    expect(parsed.mentioned).toBe(true);
    expect(parsed.rank).toBe(2);
    expect(parsed.competitors.map((item) => item.name)).toEqual([
      "Cumberland Plumber",
      "Maple Street Plumber",
    ]);
    expect(parsed.sources[0]).toMatchObject({
      url: "https://example.com/sample-clarksville",
      title: "Local roundup",
    });
  });

  it("counts a prose mention without a rank", () => {
    const parsed = parseAnswer(
      "I'd call Harper's Plumbing if you need someone this week. I don't have a longer list.",
      "Harper's Plumbing",
    );
    expect(parsed.mentioned).toBe(true);
    expect(parsed.rank).toBeNull();
  });

  it("leaves the business out when only other names appear", () => {
    const parsed = parseAnswer(
      "1. Cumberland Plumber - fast\n2. Maple Street Plumber - local",
      "Harper's Plumbing",
    );
    expect(parsed.mentioned).toBe(false);
    expect(parsed.competitors).toHaveLength(2);
    expect(parsed.competitors[0]?.rank).toBe(1);
  });

  it("strips the reason off a list item", () => {
    expect(businessNameFromListItem("Harbor Light Salon — good reviews")).toBe("Harbor Light Salon");
  });
});
