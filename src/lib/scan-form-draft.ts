export type ScanFormDraft = {
  businessName: string;
  category: string;
  city: string;
  state: string;
  websiteUrl: string;
};

export const DEFAULT_SCAN_FORM_DRAFT: ScanFormDraft = {
  businessName: "",
  category: "",
  city: "",
  state: "TN",
  websiteUrl: "",
};

let draft: ScanFormDraft = { ...DEFAULT_SCAN_FORM_DRAFT };

/** Values typed on /check before the form remounts (Suspense, hydration). */
export function readScanFormDraft(): ScanFormDraft {
  return { ...draft };
}

export function writeScanFormDraft(update: Partial<ScanFormDraft>): ScanFormDraft {
  draft = { ...draft, ...update };
  return readScanFormDraft();
}

export function resetScanFormDraft(next: ScanFormDraft = DEFAULT_SCAN_FORM_DRAFT): ScanFormDraft {
  draft = { ...next };
  return readScanFormDraft();
}
