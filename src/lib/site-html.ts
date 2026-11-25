import { textIncludesName } from "@/lib/names";
import type { SiteCheck } from "@/lib/types";

const LOCAL_TYPES = new Set([
  "localbusiness",
  "plumber",
  "plumbingservice",
  "electrician",
  "hvacbusiness",
  "roofingcontractor",
  "locksmith",
  "housepainter",
  "generalcontractor",
  "homeandconstructionbusiness",
  "hairsalon",
  "beautysalon",
  "nailsalon",
  "barbershop",
  "dayspa",
  "dentist",
  "physician",
  "medicalclinic",
  "medicalbusiness",
  "optometrist",
  "restaurant",
  "foodestablishment",
  "bakery",
  "cafeorcoffeeshop",
  "store",
  "autorepair",
  "automotivebusiness",
  "legalservice",
  "attorney",
  "accountingservice",
  "realestateagent",
  "insuranceagency",
  "drycleaningorlaundry",
  "movingcompany",
  "professionalservice",
  "exercisegym",
  "healthclub",
  "childcare",
  "homeandconstructionbusiness",
]);

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/;
const STREET_RE =
  /\d{1,6}\s+[a-z0-9.'-]+(?:\s+[a-z0-9.'-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct|highway|hwy|parkway|pkwy)\b/i;
const ZIP_RE = /\b\d{5}(?:-\d{4})?\b/;

export type SiteSignals = Pick<
  SiteCheck,
  | "title"
  | "metaDescription"
  | "hasViewport"
  | "hasLocalBusinessSchema"
  | "schemaTypes"
  | "hasBusinessName"
  | "hasPhone"
  | "hasAddress"
  | "hasFaq"
>;

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, name: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const nameMatch = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i);
    if (!nameMatch || nameMatch[1].toLowerCase() !== name) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (content) return decode(content[1]);
  }
  return null;
}

function collectTypes(value: unknown, into: Set<string>) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectTypes(item, into);
    return;
  }
  const record = value as Record<string, unknown>;
  const typeValue = record["@type"];
  const types = Array.isArray(typeValue) ? typeValue : typeValue ? [typeValue] : [];
  for (const type of types) {
    if (typeof type === "string") into.add(type);
  }
  if (Array.isArray(record["@graph"])) collectTypes(record["@graph"], into);
}

function isLocalType(type: string): boolean {
  const key = type.toLowerCase().replace(/^https?:\/\/schema\.org\//, "").replace(/\s+/g, "");
  return key.includes("localbusiness") || LOCAL_TYPES.has(key);
}

export function analyzeHtml(html: string, businessName: string): SiteSignals {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decode(titleMatch[1].replace(/<[^>]+>/g, "")) : null;
  const metaDescription = metaContent(html, "description");
  const viewport = metaContent(html, "viewport");
  const schemaTypes = new Set<string>();

  const scripts = html.matchAll(
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const script of scripts) {
    try {
      collectTypes(JSON.parse(script[1]), schemaTypes);
    } catch {
      // Ignore broken JSON-LD. The rest of the page can still be useful.
    }
  }

  const text = decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
  const types = [...schemaTypes];
  const faqInSchema = types.some((type) => type.toLowerCase().includes("faq"));
  const faqInText = /\bfaq\b|frequently asked questions/i.test(text);

  return {
    title,
    metaDescription,
    hasViewport: Boolean(viewport && /width\s*=\s*device-width/i.test(viewport)),
    hasLocalBusinessSchema: types.some(isLocalType),
    schemaTypes: types,
    hasBusinessName: textIncludesName(text, businessName),
    hasPhone: PHONE_RE.test(text),
    hasAddress: STREET_RE.test(text) || ZIP_RE.test(text),
    hasFaq: faqInSchema || faqInText,
  };
}
