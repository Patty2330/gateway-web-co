const STEMS = [
  "Cumberland",
  "Maple Street",
  "Harbor Light",
  "North Bend",
  "Old Town",
  "Ridgeway",
];

const REASONS = [
  "Often mentioned for weekday calls.",
  "Shows up in local directory roundups.",
  "A smaller crew people name for straightforward jobs.",
  "Listed with a phone number and a service area.",
  "Comes up when people ask about reviews.",
];

export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function demoSeed(input: {
  businessName: string;
  category: string;
  city: string;
  state: string;
}): number {
  return hashString(
    [input.businessName, input.category, input.city, input.state].join("|").toLowerCase(),
  );
}

/** Rank to place the business, or null when the sample answer leaves them out. */
export function demoPlacement(seed: number, questionIndex: number): number | null {
  const n = (seed + questionIndex * 13 + 4) % 11;
  if (n % 3 !== 0) return null;
  return 2;
}

function tradeName(category: string): string {
  const trimmed = category.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Services";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function buildDemoAnswer(input: {
  businessName: string;
  category: string;
  city: string;
  state: string;
  questionIndex: number;
  seed?: number;
}): string {
  const seed =
    input.seed ??
    demoSeed({
      businessName: input.businessName,
      category: input.category,
      city: input.city,
      state: input.state,
    });
  const placement = demoPlacement(seed, input.questionIndex);
  const trade = tradeName(input.category);
  const competitors = STEMS.map((stem) => `${stem} ${trade}`).filter(
    (name) => name.toLowerCase() !== input.businessName.trim().toLowerCase(),
  );

  const slots: string[] = [];
  let competitorIndex = 0;
  for (let rank = 1; rank <= 5; rank++) {
    if (placement === rank) {
      slots.push(input.businessName.trim());
      continue;
    }
    slots.push(competitors[competitorIndex % competitors.length]);
    competitorIndex += 1;
  }

  const lines = slots.map(
    (name, index) => `${index + 1}. ${name} — ${REASONS[index % REASONS.length]}`,
  );
  const slug = input.city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return [
    `People looking for a ${input.category.trim()} in ${input.city.trim()}, ${input.state.trim()} usually get a short list like this:`,
    "",
    ...lines,
    "",
    `Sources: https://example.com/sample-${slug || "local"}`,
  ].join("\n");
}
