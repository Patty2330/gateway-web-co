import { addDaysIso, applyPurchase } from "@/lib/purchase";
import type { Plan, ScanRecord } from "@/lib/types";

const KEY = "gateway-pages-scan";
export const PAGES_SCAN_EVENT = "gateway-pages-scan";

let cachedRaw: string | null | undefined;
let cachedRecord: ScanRecord | null = null;

function notifyPagesScan() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PAGES_SCAN_EVENT));
}

export function savePagesScan(record: ScanRecord): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(record));
  cachedRaw = undefined;
  notifyPagesScan();
}

export function loadPagesScan(): ScanRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (raw === cachedRaw) return cachedRecord;
  cachedRaw = raw;
  if (!raw) {
    cachedRecord = null;
    return null;
  }
  try {
    cachedRecord = JSON.parse(raw) as ScanRecord;
    return cachedRecord;
  } catch {
    cachedRecord = null;
    return null;
  }
}

export function subscribePagesScan(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PAGES_SCAN_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PAGES_SCAN_EVENT, onStoreChange);
  };
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
