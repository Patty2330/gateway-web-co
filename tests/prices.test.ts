import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MONITOR_PRICE_CENTS,
  MONITOR_PRICE_LABEL,
  REPORT_PRICE_CENTS,
  REPORT_PRICE_LABEL,
  usdFromCents,
} from "@/lib/prices";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "data",
  ".next",
  "out",
  "coverage",
  "dist",
]);

// Generated build caches can hold any digits (hashes, offsets), so skip them.
const SKIP_FILES = new Set(["tsconfig.tsbuildinfo"]);

function walkFiles(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) continue;
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, files);
    } else if (stat.isFile()) {
      if (/\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|eot|map|mp4|webm)$/i.test(name)) continue;
      files.push(full);
    }
  }
  return files;
}

const createSession = vi.hoisted(() => vi.fn());

vi.mock("stripe", () => {
  class FakeStripe {
    checkout = {
      sessions: {
        create: (...args: unknown[]) => createSession(...args),
      },
    };
  }
  return { default: FakeStripe };
});

describe("AI Visibility Check prices", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    createSession.mockReset();
  });

  it("sets the full report at $10 (1000 cents) and leaves the monthly watch at $19", () => {
    expect(REPORT_PRICE_CENTS).toBe(1000);
    expect(REPORT_PRICE_LABEL).toBe("$10");
    expect(usdFromCents(REPORT_PRICE_CENTS)).toBe("$10.00");
    expect(MONITOR_PRICE_CENTS).toBe(1900);
    expect(MONITOR_PRICE_LABEL).toBe("$19");
    expect(usdFromCents(MONITOR_PRICE_CENTS)).toBe("$19.00");
  });

  it("sends unit_amount 1000 for the full-report Stripe Checkout line item", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_price_check");
    createSession.mockResolvedValue({
      id: "cs_test_report",
      url: "https://checkout.stripe.com/c/test_report",
    });

    const { createCheckoutSession } = await import("@/lib/stripe");
    const url = await createCheckoutSession({
      scanId: "11111111-1111-4111-8111-111111111111",
      plan: "report",
      email: "owner@example.com",
      appUrl: "https://twoforksstudio.com",
    });

    expect(url).toBe("https://checkout.stripe.com/c/test_report");
    expect(createSession).toHaveBeenCalledTimes(1);
    const session = createSession.mock.calls[0]?.[0] as {
      mode: string;
      line_items: Array<{ price_data: { unit_amount: number; recurring?: unknown } }>;
    };
    expect(session.mode).toBe("payment");
    expect(session.line_items[0]?.price_data.unit_amount).toBe(1000);
    expect(session.line_items[0]?.price_data.unit_amount).toBe(REPORT_PRICE_CENTS);
    expect(session.line_items[0]?.price_data.recurring).toBeUndefined();
  });

  it("keeps the monthly watch checkout at 1900 cents", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_price_check");
    createSession.mockResolvedValue({
      id: "cs_test_monitor",
      url: "https://checkout.stripe.com/c/test_monitor",
    });

    const { createCheckoutSession } = await import("@/lib/stripe");
    await createCheckoutSession({
      scanId: "11111111-1111-4111-8111-111111111111",
      plan: "monitor",
      email: "owner@example.com",
      appUrl: "https://twoforksstudio.com",
    });

    const session = createSession.mock.calls[0]?.[0] as {
      mode: string;
      line_items: Array<{ price_data: { unit_amount: number; recurring?: { interval: string } } }>;
    };
    expect(session.mode).toBe("subscription");
    expect(session.line_items[0]?.price_data.unit_amount).toBe(1900);
    expect(session.line_items[0]?.price_data.recurring).toEqual({ interval: "month" });
  });

  it("has no leftover previous full-report prices anywhere in the repo", () => {
    const oldDollars = 49;
    const stale = new RegExp(`\\$${oldDollars}(?:\\.00)?\\b|${oldDollars}00`);
    const hits: string[] = [];
    for (const file of walkFiles(ROOT)) {
      const relative = path.relative(ROOT, file);
      let text = "";
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      for (const [index, line] of text.split(/\r?\n/).entries()) {
        if (stale.test(line)) {
          hits.push(`${relative}:${index + 1}: ${line.trim()}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
