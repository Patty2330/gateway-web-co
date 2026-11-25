import type { ZodError } from "zod";

const RAW_TYPE = /^(Invalid input: expected |Invalid type|Required$)/i;

const PATH_MESSAGES: Record<string, string> = {
  businessName: "Add the business name.",
  category: "Add the kind of business.",
  city: "Add the city.",
  state: "Pick a state.",
  websiteUrl: "Check the website address.",
  email: "Add an email so we know where to send updates.",
  name: "Add your name.",
  message: "Add a short note.",
  scanId: "Open a check before you pay.",
  plan: "Pick a plan.",
  phone: "Check the phone number.",
};

function isRawZodMessage(message: string): boolean {
  return RAW_TYPE.test(message);
}

/** First form error, never the raw Zod "expected string, received undefined" wording. */
export function zodErrorMessage(error: ZodError, fallback = "Check the form and try again."): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  if (issue.message && !isRawZodMessage(issue.message)) return issue.message;
  const key = issue.path[0];
  if (typeof key === "string" && PATH_MESSAGES[key]) return PATH_MESSAGES[key];
  return fallback;
}
