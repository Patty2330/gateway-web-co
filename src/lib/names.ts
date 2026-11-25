const LEGAL_SUFFIX =
  /\b(llc|l\.l\.c|inc|incorporated|co|company|ltd|pllc|p\.c|pc|corp|corporation)\b/g;

function stripLeadingThe(name: string): string {
  return name.replace(/^the\s+/, "");
}

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(LEGAL_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameForms(name: string): string[] {
  const normalized = normalizeName(name);
  const stripped = stripLeadingThe(normalized);
  return stripped && stripped !== normalized ? [normalized, stripped] : [normalized];
}

/**
 * A list item matches the business when the normalized names are the same,
 * or the list item starts with the business name plus extra words
 * ("Ace Plumbing of Clarksville"). A shorter or middle-of-the-name overlap
 * does not count, so "Ace" does not match "Ace Plumbing".
 * Accents are folded, and a leading "The" is optional on either side.
 */
export function namesMatch(candidate: string, businessName: string): boolean {
  const candidates = nameForms(candidate);
  const businesses = nameForms(businessName);
  if (candidates.every((name) => !name) || businesses.every((name) => !name)) return false;
  for (const candidateName of candidates) {
    for (const business of businesses) {
      if (!candidateName || !business) continue;
      if (candidateName === business) return true;
      if (business.length < 8) continue;
      if (candidateName.startsWith(`${business} `)) return true;
    }
  }
  return false;
}

export function textIncludesName(haystack: string, businessName: string): boolean {
  const businesses = nameForms(businessName).filter(Boolean);
  if (businesses.length === 0) return false;
  const text = normalizeName(haystack);
  for (const business of businesses) {
    if (text === business) return true;
    if (
      text.startsWith(`${business} `) ||
      text.endsWith(` ${business}`) ||
      text.includes(` ${business} `)
    ) {
      return true;
    }
  }
  return false;
}
