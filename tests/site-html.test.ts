import { describe, expect, it } from "vitest";

import { isPrivateAddress } from "@/lib/site-check";
import { analyzeHtml } from "@/lib/site-html";

const page = `<!doctype html>
<html>
  <head>
    <title>Harper's Plumbing | Plumber in Clarksville</title>
    <meta name="description" content="Harper's Plumbing serves Clarksville, TN. Call (931) 555-0148." />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Plumber","name":"Harper's Plumbing","telephone":"(931) 555-0148"}
    </script>
  </head>
  <body>
    <h1>Harper's Plumbing</h1>
    <p>121 Main Street, Clarksville, TN 37040. Call (931) 555-0148.</p>
    <h2>Frequently asked questions</h2>
  </body>
</html>`;

describe("website parsing", () => {
  it("reads title, schema, and contact details", () => {
    const signals = analyzeHtml(page, "Harper's Plumbing");
    expect(signals.title).toContain("Harper's Plumbing");
    expect(signals.hasViewport).toBe(true);
    expect(signals.hasLocalBusinessSchema).toBe(true);
    expect(signals.hasBusinessName).toBe(true);
    expect(signals.hasPhone).toBe(true);
    expect(signals.hasAddress).toBe(true);
    expect(signals.hasFaq).toBe(true);
  });

  it("blocks private addresses before a fetch", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("10.1.2.3")).toBe(true);
    expect(isPrivateAddress("192.168.0.8")).toBe(true);
    expect(isPrivateAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});
