/** One-time AI Visibility Check full report, in USD cents. */
export const REPORT_PRICE_CENTS = 1000;

/** Monthly AI Visibility watch, in USD cents. Independent of the report price. */
export const MONITOR_PRICE_CENTS = 1900;

export const REPORT_PRICE_LABEL = "$10";
export const MONITOR_PRICE_LABEL = "$19";

export function usdFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
