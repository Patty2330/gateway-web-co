/** Copy shared by the visibility check. Matches the live Two Forks Studio offer. */
export const CANONICAL_SITE_URL = "https://twoforksstudio.com";

export const gateway = {
  name: "Two Forks Studio",
  owner: "Jalen",
  email: "hello@twoforksstudio.com",
  url: CANONICAL_SITE_URL,
  phone: "612-719-4312",
  place: "Clarksville, Tennessee",
  buildPitch:
    "Two Forks Studio builds the website. The first 10 local clients are $500, and you pay only when you're 100% happy.",
};

/**
 * Public site URL for metadata, Open Graph, and JSON-LD.
 * NEXT_PUBLIC_SITE_URL or SITE_URL wins, then APP_URL (local dev and Render
 * preview already set this), then the live canonical URL. Stripe return
 * URLs still use APP_URL through appUrlFrom() and are unchanged.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const override =
    env.NEXT_PUBLIC_SITE_URL?.trim() || env.SITE_URL?.trim() || env.APP_URL?.trim() || "";
  if (override) return override.replace(/\/$/, "");
  return CANONICAL_SITE_URL;
}

export function leadEmailSubject(name: string): string {
  return `New ${gateway.name} note from ${name}`;
}
