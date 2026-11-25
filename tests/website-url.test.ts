import { describe, expect, it } from "vitest";

import { normalizeWebsite } from "@/lib/website-url";

describe("normalizeWebsite", () => {
  it("adds https to a bare domain", () => {
    expect(normalizeWebsite("example.com")).toBe("https://example.com/");
  });

  it("keeps http and https", () => {
    expect(normalizeWebsite("http://example.com/path")).toBe("http://example.com/path");
    expect(normalizeWebsite("https://example.com/path?x=1")).toBe("https://example.com/path?x=1");
  });

  it("rejects ftp, javascript, and other schemes", () => {
    expect(() => normalizeWebsite("ftp://example.com")).toThrow(/http or https/);
    expect(() => normalizeWebsite("javascript:alert(1)")).toThrow(/http or https/);
    expect(() => normalizeWebsite("data:text/html,hi")).toThrow(/http or https/);
  });

  it("rejects credentials in the URL", () => {
    expect(() => normalizeWebsite("https://user:pass@example.com")).toThrow(/username and password/);
    expect(() => normalizeWebsite("user:pass@example.com")).toThrow(/username and password/);
  });

  it("rejects values that are not a URL", () => {
    expect(() => normalizeWebsite("not a website")).toThrow(/doesn't look right/);
    expect(() => normalizeWebsite("hello world")).toThrow(/doesn't look right/);
  });

  it("returns null for a blank value", () => {
    expect(normalizeWebsite(undefined)).toBeNull();
    expect(normalizeWebsite("  ")).toBeNull();
  });

  it("rejects hostnames that are not valid DNS names", () => {
    expect(() => normalizeWebsite("!!!")).toThrow(/doesn't look right/);
    expect(() => normalizeWebsite("https://!!!/")).toThrow(/doesn't look right/);
    expect(() => normalizeWebsite("...")).toThrow(/doesn't look right/);
    expect(() => normalizeWebsite("https://./")).toThrow(/doesn't look right/);
    expect(normalizeWebsite("https://www.catfishhouseclarksville.com/")).toBe(
      "https://www.catfishhouseclarksville.com/",
    );
    expect(normalizeWebsite("joes_pizza.com")).toBe("https://joes_pizza.com/");
    expect(normalizeWebsite("example.com.")).toBe("https://example.com/");
    expect(normalizeWebsite("example.com:8080")).toBe("https://example.com:8080/");
    expect(normalizeWebsite("[::1]")).toBe("https://[::1]/");
    expect(normalizeWebsite("http://[::1]/")).toBe("http://[::1]/");
  });

  it("rejects underscore-only labels and port 0", () => {
    expect(() => normalizeWebsite("_.com")).toThrow(/doesn't look right/);
    expect(() => normalizeWebsite("https://_.com/")).toThrow(/doesn't look right/);
    expect(() => normalizeWebsite("example.com:0")).toThrow(/doesn't look right/);
    expect(() => normalizeWebsite("https://example.com:0/")).toThrow(/doesn't look right/);
    expect(() => normalizeWebsite("[::1]:0")).toThrow(/doesn't look right/);
    expect(normalizeWebsite("joes_pizza.com")).toBe("https://joes_pizza.com/");
    expect(normalizeWebsite("example.com:8080")).toBe("https://example.com:8080/");
  });
});
