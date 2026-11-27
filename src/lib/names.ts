const LEGAL_SUFFIX =
  /\b(llc|l\.l\.c|inc|incorporated|co|company|ltd|pllc|p\.c|pc|corp|corporation)\b/g;

function stripLeadingThe(name: string): string {
  return name.replace(/^the\s+/, "");
}

function foldMarks(name: string): string {
  return name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function scrubNormalized(value: string): string {
  return value
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(LEGAL_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeName(name: string): string {
  return scrubNormalized(foldMarks(name));
}

function normalizeNameForms(name: string): string[] {
  const folded = foldMarks(name);
  const kept = scrubNormalized(folded);
  const withoutPossessive = scrubNormalized(folded.replace(/['’]s\b/g, " "));
  return [...new Set([kept, withoutPossessive].filter(Boolean))];
}

const BRAND_ALIASES: { match: string[]; replacements: string[][] }[] = [
  { match: ["harley", "davidson"], replacements: [["harley", "davidson"], ["hd"], ["h", "d"]] },
  { match: ["hd"], replacements: [["harley", "davidson"], ["hd"], ["h", "d"]] },
  { match: ["h", "d"], replacements: [["harley", "davidson"], ["hd"], ["h", "d"]] },
];

function tokensMatchAt(tokens: string[], start: number, pattern: string[]): boolean {
  if (start + pattern.length > tokens.length) return false;
  return pattern.every((token, index) => tokens[start + index] === token);
}

function expandBrandTokens(tokens: string[]): string[][] {
  const variants: string[][] = [[...tokens]];
  const seen = new Set<string>([tokens.join(" ")]);

  for (let index = 0; index < variants.length; index++) {
    const current = variants[index];
    for (let start = 0; start < current.length; start++) {
      for (const alias of BRAND_ALIASES) {
        if (!tokensMatchAt(current, start, alias.match)) continue;
        for (const replacement of alias.replacements) {
          const next = [
            ...current.slice(0, start),
            ...replacement,
            ...current.slice(start + alias.match.length),
          ];
          const key = next.join(" ");
          if (seen.has(key)) continue;
          seen.add(key);
          variants.push(next);
        }
      }
    }
  }

  return variants;
}

function nameForms(name: string): string[] {
  const forms = new Set<string>();
  for (const normalized of normalizeNameForms(name)) {
    for (const base of [normalized, stripLeadingThe(normalized)]) {
      if (!base) continue;
      forms.add(base);
      for (const variant of expandBrandTokens(base.split(" ").filter(Boolean))) {
        const joined = variant.join(" ").trim();
        if (joined) forms.add(joined);
        const stripped = stripLeadingThe(joined);
        if (stripped) forms.add(stripped);
      }
    }
  }
  return [...forms];
}

function phraseInText(text: string, phrase: string): boolean {
  if (!text || !phrase) return false;
  return (
    text === phrase ||
    text.startsWith(`${phrase} `) ||
    text.endsWith(` ${phrase}`) ||
    text.includes(` ${phrase} `)
  );
}

/**
 * A list item matches the business when the normalized names are the same,
 * or the list item starts with the business name plus extra words
 * ("Ace Plumbing of Clarksville"). A shorter or middle-of-the-name overlap
 * does not count, so "Ace" does not match "Ace Plumbing".
 * Accents are folded, a leading "The" is optional on either side, and a
 * possessive 's / ’s is optional. Distinctive brand aliases such as
 * "Appleton HD" for "Appleton's Harley-Davidson" also count.
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
  const texts = nameForms(haystack);
  if (texts.length === 0) {
    const fallback = normalizeName(haystack);
    return businesses.some((business) => phraseInText(fallback, business));
  }
  for (const text of texts) {
    for (const business of businesses) {
      if (phraseInText(text, business)) return true;
    }
  }
  return false;
}
