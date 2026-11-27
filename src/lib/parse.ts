import { namesMatch, textIncludesName } from "@/lib/names";
import type { ParsedAnswer, ParsedCompetitor, Source } from "@/lib/types";
import { citationMatchesWebsite } from "@/lib/domains";

function urlRe(): RegExp {
  return /https?:\/\/[^\s)>\]]+/gi;
}

function mdLinkRe(): RegExp {
  return /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
}

function bareHostRe(): RegExp {
  return /(?:^|[\s(<'"[/])((?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,})(?=$|[\s)\]>'",;:/])/gi;
}


function textForNameMatch(text: string): string {
  return text
    .replace(mdLinkRe(), " $1 ")
    .replace(urlRe(), " ")
    .replace(bareHostRe(), " ");
}

function cleanUrl(raw: string): string {
  return raw.replace(/[.,;:]+$/g, "");
}

export function extractSources(text: string): Source[] {
  const sources: Source[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(mdLinkRe())) {
    const url = cleanUrl(match[2]);
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({ url, title: match[1].trim() || undefined });
  }

  for (const match of text.matchAll(urlRe())) {
    const url = cleanUrl(match[0]);
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({ url });
  }

  return sources;
}

function hostsFromText(text: string): string[] {
  const values: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    values.push(trimmed);
  };
  for (const source of extractSources(text)) add(source.url);
  for (const match of text.matchAll(bareHostRe())) {
    add(match[1]);
  }
  return values;
}

export function mentionsWebsite(
  text: string,
  websiteUrl: string | null | undefined,
  extraSources: Source[] = [],
): boolean {
  if (!websiteUrl?.trim()) return false;
  for (const source of extraSources) {
    if (citationMatchesWebsite(source.url, websiteUrl)) return true;
  }
  for (const host of hostsFromText(text)) {
    if (citationMatchesWebsite(host, websiteUrl)) return true;
  }
  return false;
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

export type ParseAnswerOptions = {
  websiteUrl?: string | null;
  extraSources?: Source[];
};

export function parseAnswer(
  text: string,
  businessName: string,
  options: ParseAnswerOptions = {},
): ParsedAnswer {
  const extracted = extractSources(text);
  const sources: Source[] = [];
  const seen = new Set<string>();
  for (const source of [...extracted, ...(options.extraSources ?? [])]) {
    if (!source.url || seen.has(source.url)) continue;
    seen.add(source.url);
    sources.push(source);
  }
  const items: { rank: number | null; name: string; isBusiness: boolean }[] = [];

  for (const line of text.split(/\r?\n/)) {
    const parsed = parseListLine(line);
    if (!parsed) continue;
    const name = businessNameFromListItem(parsed.text);
    if (!name || GENERIC_ITEM.test(name)) continue;
    const isBusiness =
      namesMatch(name, businessName) ||
      textIncludesName(textForNameMatch(parsed.text), businessName) ||
      textIncludesName(textForNameMatch(line), businessName) ||
      mentionsWebsite(parsed.text, options.websiteUrl, options.extraSources) ||
      mentionsWebsite(line, options.websiteUrl, options.extraSources);
    items.push({ rank: parsed.rank, name, isBusiness });
  }

  const allBullets = items.length > 0 && items.every((item) => item.rank == null);
  const rankedItems = items.map((item, index) => ({
    name: item.name,
    rank: item.rank ?? (allBullets ? index + 1 : null),
    isBusiness: item.isBusiness,
  }));

  const match = rankedItems.find((item) => item.isBusiness);
  const competitors: ParsedCompetitor[] = rankedItems
    .filter((item) => !item.isBusiness)
    .map((item) => ({ name: item.name, rank: item.rank }));

  if (match) {
    return {
      mentioned: true,
      rank: match.rank,
      competitors,
      sources,
    };
  }

  if (textIncludesName(textForNameMatch(text), businessName) || mentionsWebsite(text, options.websiteUrl, sources)) {
    return { mentioned: true, rank: null, competitors, sources };
  }

  return { mentioned: false, rank: null, competitors, sources };
}
