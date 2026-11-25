import { lookup } from "node:dns/promises";
import net from "node:net";

import { fetchWithTimeout } from "@/lib/http";
import { analyzeHtml } from "@/lib/site-html";
import type { SiteCheck } from "@/lib/types";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.internal",
]);

export function isPrivateAddress(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "0.0.0.0") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (net.isIP(normalized) !== 4) return false;
  const [a, b] = normalized.split(".").map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function emptySignals(): Omit<SiteCheck, "url" | "ok" | "error" | "finalUrl"> {
  return {
    title: null,
    metaDescription: null,
    hasViewport: false,
    hasLocalBusinessSchema: false,
    schemaTypes: [],
    hasBusinessName: false,
    hasPhone: false,
    hasAddress: false,
    hasFaq: false,
  };
}

async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That website address isn't a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The website link needs to start with http or https.");
  }
  if (url.username || url.password) {
    throw new Error("Take the username and password out of the website link.");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    BLOCKED_HOSTS.has(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost")
  ) {
    throw new Error("That address points at a private network, so we skipped it.");
  }
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("That address points at a private network, so we skipped it.");
    }
    return url;
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("That address points at a private network, so we skipped it.");
  }
  return url;
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Buffer[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    chunks.push(Buffer.from(value));
  }
  await reader.cancel().catch(() => undefined);
  return Buffer.concat(chunks).subarray(0, maxBytes).toString("utf8");
}

export async function checkWebsite(rawUrl: string, businessName: string): Promise<SiteCheck> {
  const base = { url: rawUrl, ...emptySignals() };
  try {
    let current = await assertPublicHttpUrl(rawUrl);
    let response: Response | null = null;
    for (let hop = 0; hop < 4; hop++) {
      response = await fetchWithTimeout(
        current.toString(),
        {
          method: "GET",
          redirect: "manual",
          headers: {
            "user-agent": "AIVisibilityCheck/0.1 (local business visibility check)",
            accept: "text/html,application/xhtml+xml",
          },
        },
        8000,
      );
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("The website redirected without a destination.");
        current = await assertPublicHttpUrl(new URL(location, current).toString());
        continue;
      }
      break;
    }
    if (!response) throw new Error("The website didn't respond.");
    if (!response.ok) {
      throw new Error(`The website returned status ${response.status}.`);
    }
    const type = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      throw new Error("That address isn't an HTML page we can check.");
    }
    const html = await readLimited(response, 500_000);
    return {
      ...base,
      ok: true,
      finalUrl: current.toString(),
      ...analyzeHtml(html, businessName),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "We couldn't read that website.";
    const friendly = message.includes("abort")
      ? "The website took too long to respond."
      : message;
    return { ...base, ok: false, error: friendly };
  }
}
