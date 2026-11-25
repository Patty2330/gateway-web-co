import { addDaysIso, applyPurchase } from "@/lib/purchase";
import type { Plan, ScanRecord } from "@/lib/types";

const KEY = "gateway-pages-scan";

export function savePagesScan(record: ScanRecord): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(record));
}

export function loadPagesScan(): ScanRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ScanRecord;
  } catch {
    return null;
  }
}

export function unlockPagesScan(plan: Plan, email: string): ScanRecord | null {
  const current = loadPagesScan();
  if (!current) return null;
  const tier = applyPurchase(current.tier, plan);
  const next: ScanRecord = {
    ...current,
    tier,
    email,
    updatedAt: new Date().toISOString(),
    nextRunAt: tier === "monitor" ? (current.nextRunAt ?? addDaysIso(new Date(), 30)) : current.nextRunAt,
  };
  savePagesScan(next);
  return next;
}
