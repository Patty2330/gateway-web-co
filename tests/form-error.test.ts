import { describe, expect, it } from "vitest";

import { zodErrorMessage } from "@/lib/form-error";
import { checkoutFormSchema, scanFormSchema } from "@/lib/schemas";

describe("friendly form messages", () => {
  it("uses plain wording when the business name is missing", () => {
    const parsed = scanFormSchema.safeParse({
      category: "restaurant",
      city: "Clarksville",
      state: "TN",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const message = zodErrorMessage(parsed.error);
    expect(message).toBe("Add the business name.");
    expect(message).not.toMatch(/Invalid input/i);
    expect(message).not.toMatch(/undefined/i);
  });

  it("uses plain wording when the checkout email is missing", () => {
    const parsed = checkoutFormSchema.safeParse({
      scanId: "11111111-1111-4111-8111-111111111111",
      plan: "report",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const message = zodErrorMessage(parsed.error, "Check the email and try again.");
    expect(message).toBe("Add an email so we know where to send updates.");
    expect(message).not.toMatch(/Invalid input/i);
    expect(message).not.toMatch(/undefined/i);
  });
});
