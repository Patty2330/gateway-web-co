import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  readScanFormDraft,
  resetScanFormDraft,
  writeScanFormDraft,
} from "@/lib/scan-form-draft";

describe("scan form draft", () => {
  beforeEach(() => {
    resetScanFormDraft();
  });

  it("keeps a business name typed before the form remounts", () => {
    writeScanFormDraft({ businessName: "Harper's Plumbing" });
    // A remount reads the same draft, the way /check used to wipe early input
    // when Suspense replaced the fallback form.
    const remounted = readScanFormDraft();
    expect(remounted.businessName).toBe("Harper's Plumbing");
    expect(remounted.businessName.length).toBeGreaterThan(0);
  });
});

describe("check page form mount", () => {
  it("does not remount ScanForm through a Suspense fallback", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(check)/check/page.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/fallback=\{<ScanForm/);
    expect(source).toMatch(/<ScanForm \/>/);
  });
});
