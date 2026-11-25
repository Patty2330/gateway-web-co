export function normalizeWebsite(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();

  let url: URL;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      url = new URL(trimmed);
    } else if (trimmed.startsWith("//")) {
      url = new URL(`https:${trimmed}`);
    } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      // "user:pass@host" looks like a scheme. Treat it as a host with credentials.
      if (trimmed.includes("@") && !trimmed.includes("://")) {
        url = new URL(`https://${trimmed}`);
      } else {
        throw new Error("The website link needs to start with http or https.");
      }
    } else {
      url = new URL(`https://${trimmed}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The website link")) {
      throw error;
    }
    throw new Error("That website address doesn't look right.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The website link needs to start with http or https.");
  }
  if (url.username || url.password) {
    throw new Error("Take the username and password out of the website link.");
  }
  if (!url.hostname) {
    throw new Error("That website address doesn't look right.");
  }
  return url.toString();
}
