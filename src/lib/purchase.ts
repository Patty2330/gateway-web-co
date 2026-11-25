import type { Plan, Tier } from "@/lib/types";

export function applyPurchase(current: Tier, plan: Plan): Tier {
  if (plan === "monitor" || current === "monitor") return "monitor";
  return "report";
}

/** After a subscription is canceled, keep any one-time report and stop monthly re-checks. */
export function dropMonitor(current: Tier): Tier {
  return current === "monitor" ? "report" : current;
}

export function addDaysIso(from: Date, days: number): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
