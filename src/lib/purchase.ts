import type { Plan, Tier } from "@/lib/types";

export function applyPurchase(current: Tier, plan: Plan): Tier {
  if (plan === "monitor" || current === "monitor") return "monitor";
  return "report";
}

export function addDaysIso(from: Date, days: number): string {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
