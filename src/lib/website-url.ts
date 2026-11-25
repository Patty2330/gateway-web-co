import net from "node:net";

function stripHostname(host: string): string {
  return host.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

/** Hostnames we accept on a business website field. Junk like "!!!" is rejected. */
export function isValidHostname(host: string): boolean {
  const hostname = stripHostname(host);
  if (!hostname || hostname.length > 253) return false;
  if (hostname === "localhost") return true;
  if (net.isIP(hostname) === 4 || net.isIP(hostname) === 6) return true;
  const labels = hostname.split(".");
  if (labels.length < 2) return false;
  // Allow underscores so names like joes_pizza.com are not rejected.
  // A label still needs a letter or digit, so "_" or "_.com" is not a host.
  const labelRe = /^(?!-)[a-z0-9_-]{1,63}(?<!-)$/;
  return labels.every((label) => labelRe.test(label) && /[a-z0-9]/.test(label));
}

/** host:port or [ipv6]:port, with an optional path, query, or hash. */
function looksLikeHostPort(value: string): boolean {
  return /^(?:\[[0-9a-fA-F:]+\]|(?:localhost)|(?:(?:[a-zA-Z0-9_-]+\.)+[a-zA-Z]{2,})|(?:\d{1,3}\.){3}\d{1,3}):\d{1,5}(?:[/?#].*)?$/.test(
    value,
  );
}

export function normalizeWebsite(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();

  let url: URL;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      url = new URL(trimmed);
    } else if (trimmed.startsWith("//")) {
      url = new URL(`https:${trimmed}`);
    } else if (looksLikeHostPort(trimmed) || trimmed.startsWith("[")) {
      url = new URL(`https://${trimmed}`);
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
  if (!url.hostname || !isValidHostname(url.hostname)) {
    throw new Error("That website address doesn't look right.");
  }
  const port = url.port;
  if (port) {
    const portNumber = Number(port);
    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
      throw new Error("That website address doesn't look right.");
    }
  }
  const hostname = stripHostname(url.hostname);
  if (hostname !== url.hostname) {
    url.hostname = hostname.includes(":") && !hostname.startsWith("[") ? hostname : hostname;
  }
  // Drop a trailing DNS dot so https://example.com. and https://example.com share a cache key.
  if (url.hostname.endsWith(".")) {
    url.hostname = url.hostname.slice(0, -1);
  }
  return url.toString();
}
