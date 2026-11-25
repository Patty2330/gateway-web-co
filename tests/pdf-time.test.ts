import { describe, expect, it } from "vitest";

import { formatReportTime } from "@/lib/pdf";

describe("formatReportTime", () => {
  it("prints America/Chicago time with a zone label", () => {
    // 16:30 UTC on Nov 25, 2026 is 10:30 AM CST.
    const text = formatReportTime("2026-11-25T16:30:00.000Z");
    expect(text).toContain("November 25, 2026");
    expect(text).toMatch(/10:30\sAM/);
    expect(text).toMatch(/C[SD]T/);
  });
});
