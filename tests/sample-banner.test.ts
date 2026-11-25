import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { stickyHeaderTopClass, topBannerStyle } from "@/lib/banner-layout";

describe("sample mode banner layout", () => {
  it("stays in document flow so it cannot cover the sticky header on a phone", () => {
    expect(topBannerStyle.position).toBe("relative");
    expect(topBannerStyle.position).not.toBe("sticky");
    expect(stickyHeaderTopClass).toBe("top-0");
  });

  it("does not offset the header or marketing nav under a wrapping banner", () => {
    const header = readFileSync(path.join(process.cwd(), "src/components/site-header.tsx"), "utf8");
    const nav = readFileSync(path.join(process.cwd(), "src/components/gateway-nav.tsx"), "utf8");
    const css = readFileSync(path.join(process.cwd(), "styles.css"), "utf8");
    expect(header).toContain("stickyHeaderTopClass");
    expect(header).not.toContain("top-11");
    expect(nav).not.toMatch(/top:\s*44/);
    expect(css).not.toContain("body:has([data-sample-banner]) .nav{top:44px}");
  });
});
