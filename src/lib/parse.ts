import { namesMatch, textIncludesName } from "@/lib/names";
import type { ParsedAnswer, ParsedCompetitor, Source } from "@/lib/types";

const URL_RE = /https?:\/\/[^\s)>\]]+/gi;
const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function cleanUrl(raw: string): string {
  return raw.replace(/[.,;:]+$/g, "");
}

export function extractSources(text: string): Source[] {
  const sources: Source[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(MD_LINK_RE)) {
    const url = cleanUrl(match[2]);
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({ url, title: match[1].trim() || undefined });
  }

  for (const match of text.matchAll(URL_RE)) {
    const url = cleanUrl(match[0]);
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({ url });
  }

  return sources;
}

export function businessNameFromListItem(raw: string): string {
  const withoutMd = raw
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
  const [head] = withoutMd.split(/\s+[—–|]\s+|\s+-\s+|\s+:\s+/);
  return head.replace(/[.,;]+$/g, "").trim();
}

function parseListLine(line: string): { rank: number | null; text: string } | null {
  const trimmed = line.trim();
  const numbered = trimmed.match(/^(?:\*\*)?(\d+)[.)]\s+(.+)$/);
  if (numbered) {
    return { rank: Number(numbered[1]), text: numbered[2] };
  }
  const bullet = trimmed.match(/^[-*]\s+(.+)$/);
  if (bullet) return { rank: null, text: bullet[1] };
  return null;
}

const GENERIC_ITEM = /^(sources?|references?|note|notes|summary|overall|bottom line)$/i;

export function parseAnswer(text: string, businessName: string): ParsedAnswer {
  const sources = extractSources(text);
  const items: { rank: number | null; name: string }[] = [];

  for (const line of text.split(/\r?\n/)) {
    const parsed = parseListLine(line);
    if (!parsed) continue;
    const name = businessNameFromListItem(parsed.text);
    if (!name || GENERIC_ITEM.test(name)) continue;
    items.push({ rank: parsed.rank, name });
  }

  const allBullets = items.length > 0 && items.every((item) => item.rank == null);
  const rankedItems = items.map((item, index) => ({
    name: item.name,
    rank: item.rank ?? (allBullets ? index + 1 : null),
  }));

  const match = rankedItems.find((item) => namesMatch(item.name, businessName));
  const competitors: ParsedCompetitor[] = rankedItems
    .filter((item) => !namesMatch(item.name, businessName))
    .map((item) => ({ name: item.name, rank: item.rank }));

  if (match) {
    return {
      mentioned: true,
      rank: match.rank,
      competitors,
      sources,
    };
  }

  if (textIncludesName(text, businessName)) {
    return { mentioned: true, rank: null, competitors, sources };
  }

  return { mentioned: false, rank: null, competitors, sources };
}
