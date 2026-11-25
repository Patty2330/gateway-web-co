import { describe, expect, it } from "vitest";

import { gateway } from "@/lib/gateway";
import { getSite } from "@/lib/site";

describe("public brand", () => {
  it("uses Two Forks Studio as the homepage title", () => {
    const site = getSite();
    expect(site.business_name).toBe("Two Forks Studio");
    expect(site.seo.title).toContain("Two Forks Studio");
    expect(site.seo.title).toBe("Two Forks Studio | $500 Websites for Clarksville, TN Businesses");
    expect(site.seo.description).toContain("Two Forks Studio");
    expect(site.seo.social_title).toContain("Two Forks Studio");
    expect(site.seo.social_description).not.toContain("Gateway Web Co");
    expect(site.seo.title).not.toContain("Gateway Web Co");
  });

  it("keeps the check copy on the same public name", () => {
    expect(gateway.name).toBe("Two Forks Studio");
    expect(gateway.buildPitch).toContain("Two Forks Studio");
    expect(gateway.buildPitch).not.toContain("Gateway Web Co");
  });
});
