const LEGAL_SUFFIX =
  /\b(llc|l\.l\.c|inc|incorporated|co|company|ltd|pllc|p\.c|pc|corp|corporation)\b/g;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(LEGAL_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A list item matches the business when the normalized names are the same,
 * or the list item starts with the business name plus extra words
 * ("Ace Plumbing of Clarksville"). A shorter or middle-of-the-name overlap
 * does not count, so "Ace" does not match "Ace Plumbing".
 */
export function namesMatch(candidate: string, businessName: string): boolean {
  const candidateName = normalizeName(candidate);
  const business = normalizeName(businessName);
  if (!candidateName || !business) return false;
  if (candidateName === business) return true;
  if (business.length < 8) return false;
  return candidateName.startsWith(`${business} `);
}

export function textIncludesName(haystack: string, businessName: string): boolean {
  const business = normalizeName(businessName);
  if (!business) return false;
  const text = normalizeName(haystack);
  if (text === business) return true;
  return (
    text.startsWith(`${business} `) ||
    text.endsWith(` ${business}`) ||
    text.includes(` ${business} `)
  );
}
