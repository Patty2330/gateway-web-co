/** Directory hosts we never treat as a business's own site unless that was the submitted URL. */
export const DIRECTORY_REGISTRABLE_DOMAINS = new Set([
  "yelp.com",
  "facebook.com",
  "fb.com",
  "instagram.com",
  "google.com",
  "googleusercontent.com",
  "goo.gl",
  "maps.google.com",
  "bbb.org",
  "yellowpages.com",
  "angi.com",
  "tripadvisor.com",
  "alignable.com",
  "nextdoor.com",
  "bing.com",
  "yahoo.com",
  "m.facebook.com",
  "business.site",
  "mapquest.com",
  "apple.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "linkedin.com",
]);

const MULTI_PART_TLDS = new Set([
  "ac.uk",
  "co.uk",
  "gov.uk",
  "ltd.uk",
  "me.uk",
  "net.uk",
  "org.uk",
  "plc.uk",
  "co.au",
  "com.au",
  "net.au",
  "org.au",
  "co.nz",
  "co.jp",
  "co.kr",
  "co.in",
  "com.br",
  "com.mx",
  "com.tr",
  "co.za",
  "com.ar",
  "com.sg",
  "co.id",
]);

function stripHostname(host: string): string {
  return host.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

function looksLikeIp(host: string): boolean {
  const value = stripHostname(host);
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return true;
  return value.includes(":");
}

function hostnameFromValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || trimmed.startsWith("//")) {
      const url = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
      return stripHostname(url.hostname);
    }
  } catch {
    // Fall through and try a bare host.
  }
  try {
    const url = new URL(`https://${trimmed}`);
    return stripHostname(url.hostname);
  } catch {
    const candidate = trimmed.split(/[/?#]/)[0]?.replace(/\.$/, "").toLowerCase() ?? "";
    if (!candidate) return null;
    return stripHostname(candidate);
  }
}

/**
 * eTLD+1 for a URL or hostname. www and other subdomains are dropped, so
 * shop.appletonharley.com and www.appletonharley.com both become appletonharley.com.
 */
export function registrableDomain(value: string): string | null {
  const host = hostnameFromValue(value);
  if (!host) return null;
  if (looksLikeIp(host)) return host;
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return null;
  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(lastTwo)) {
    if (labels.length < 3) return null;
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}

function asUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || trimmed.startsWith("//")) {
      return new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
    }
    return new URL(`https://${trimmed}`);
  } catch {
    return null;
  }
}

function pathKey(value: string): string {
  const url = asUrl(value);
  if (!url) return "";
  return url.pathname.replace(/\/+$/, "").toLowerCase();
}

/**
 * True when a citation or bare host belongs to the submitted business website.
 * Generic directory domains only count when the submitted URL is on that
 * directory and the path points at the same listing.
 */
export function citationMatchesWebsite(
  citation: string,
  websiteUrl: string | null | undefined,
): boolean {
  if (!websiteUrl?.trim() || !citation.trim()) return false;
  const wanted = registrableDomain(websiteUrl);
  const got = registrableDomain(citation);
  if (!wanted || !got || wanted !== got) return false;
  if (!DIRECTORY_REGISTRABLE_DOMAINS.has(wanted)) return true;
  const submittedPath = pathKey(websiteUrl);
  if (!submittedPath) return false;
  const citationPath = pathKey(citation);
  return (
    citationPath === submittedPath ||
    citationPath.startsWith(`${submittedPath}/`) ||
    submittedPath.startsWith(`${citationPath}/`)
  );
}
