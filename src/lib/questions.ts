import type { Question } from "@/lib/types";

function extraQuestion(category: string, city: string, state: string): string {
  const kind = category.toLowerCase();
  if (/plumb|hvac|electric|roof|locksmith|garage|towing/.test(kind)) {
    return `Who can handle an emergency ${category} call in ${city}, ${state}?`;
  }
  if (/salon|barber|spa|nail|dentist|doctor|clinic|chiro|vet/.test(kind)) {
    return `Where can I book a ${category} appointment in ${city} this week?`;
  }
  if (/restaurant|cafe|coffee|pizza|diner|bakery/.test(kind)) {
    return `What's a good locally owned ${category} in ${city}, ${state}?`;
  }
  return `Who is a trusted ${category} for a first-time customer in ${city}?`;
}

export function buildQuestions(input: {
  category: string;
  city: string;
  state: string;
}): Question[] {
  const category = input.category.trim();
  const city = input.city.trim();
  const state = input.state.trim();
  const texts = [
    `What is the best ${category} in ${city}, ${state}?`,
    `Who is the most affordable ${category} in ${city}?`,
    `Which ${category} in ${city}, ${state} has the best reviews?`,
    `I need a ${category} near ${city}, ${state} this week. Who should I call?`,
    `Who are the top-rated ${category} businesses in ${city}?`,
    `Which ${category} do local people in ${city} recommend?`,
    extraQuestion(category, city, state),
    `Can you compare ${category} options in ${city}, ${state}?`,
  ];

  return texts.map((text, index) => ({
    id: `q${index + 1}`,
    text,
    index,
  }));
}
