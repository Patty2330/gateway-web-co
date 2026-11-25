import { describe, expect, it } from "vitest";

import { shortError } from "@/lib/http";

describe("shortError", () => {
  it("redacts Perplexity and Stripe keys", () => {
    const sample = (prefix: string) => `${prefix}${ "abcd1234efgh5678ijkl9012mnop3456" }`;
    const message = shortError(
      "Perplexity",
      401,
      `denied ${sample("pplx-")} and ${sample("sk_test_")} and ${sample("sk_live_")} and ${sample("rk_live_")} and ${sample("whsec_")}`,
    );
    expect(message).not.toContain("abcd1234efgh5678ijkl9012mnop3456");
    expect(message).toContain("[key]");
  });
});
