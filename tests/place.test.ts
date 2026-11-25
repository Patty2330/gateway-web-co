import { describe, expect, it } from "vitest";

import { formatCityState } from "@/lib/place";

describe("formatCityState", () => {
  it("does not repeat the state when the city already ends with it", () => {
    expect(formatCityState("Clarksville", "TN")).toBe("Clarksville, TN");
    expect(formatCityState("Clarksville, TN", "TN")).toBe("Clarksville, TN");
    expect(formatCityState("Clarksville, TN, TN", "TN")).toBe("Clarksville, TN");
  });
});
