import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

import { analyzeHtml } from "@/lib/site-html";
import type { SiteCheck } from "@/lib/types";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.internal",
]);

const HTML_LIMIT_BYTES = 2_000_000;

function hexPairToIpv4(left: string, right: string): string {
  const high = parseInt(left, 16);
  const low = parseInt(right, 16);
  return `${(high >> 8) & 255}.${high & 255}.${(low >> 8) & 255}.${low & 255}`;
}

/** Expand an IPv6 address into eight 4-digit hex groups, or null if it is invalid. */
export function expandIpv6(ip: string): string[] | null {
  let input = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const dotted = input.match(/^(.+):(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const parts = dotted[2].split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => part > 255)) return null;
    input = `${dotted[1]}:${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
  }
  if (input.includes("::")) {
    const [left, right] = input.split("::");
    const head = left ? left.split(":") : [];
    const tail = right ? right.split(":") : [];
    if (head.some((g) => !g) || tail.some((g) => !g)) return null;
    if (head.length + tail.length > 8) return null;
    const middle = Array(8 - head.length - tail.length).fill("0");
    return [...head, ...middle, ...tail].map((group) => group.padStart(4, "0"));
  }
  const groups = input.split(":");
  if (groups.length !== 8 || groups.some((group) => !group)) return null;
  return groups.map((group) => group.padStart(4, "0"));
}

/** Pull an IPv4 address out of IPv4-mapped, IPv4-compatible, or NAT64 IPv6 forms. */
export function ipv4FromMapped(ip: string): string | null {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIP(normalized) === 4) return normalized;
  const groups = expandIpv6(normalized);
  if (!groups) return null;
  const v4 = hexPairToIpv4(groups[6], groups[7]);
  const mapped =
    groups[0] === "0000" &&
    groups[1] === "0000" &&
    groups[2] === "0000" &&
    groups[3] === "0000" &&
    groups[4] === "0000" &&
    groups[5] === "ffff";
  const compatible =
    groups.slice(0, 6).every((group) => group === "0000") && v4 !== "0.0.0.0" && v4 !== "0.0.0.1";
  const nat64 =
    groups[0] === "0064" &&
    groups[1] === "ff9b" &&
    groups[2] === "0000" &&
    groups[3] === "0000" &&
    groups[4] === "0000" &&
    groups[5] === "0000";
  if (mapped || compatible || nat64) return v4;
  return null;
}

function isPrivateIpv4(ip: string): boolean {
  if (ip === "0.0.0.0") return true;
  const [a, b] = ip.split(".").map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const v4 = ipv4FromMapped(normalized);
  if (v4) return isPrivateIpv4(v4);

  if (normalized === "::1" || normalized === "::" || normalized === "0.0.0.0") return true;
  const groups = expandIpv6(normalized);
  if (!groups) return net.isIP(normalized) !== 4;
  const first = parseInt(groups[0], 16);
  if ((first & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((first & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  const full = groups.join(":");
  return full === "0000:0000:0000:0000:0000:0000:0000:0001" || full === "0000:0000:0000:0000:0000:0000:0000:0000";
}

export function friendlySiteError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("abort") || lower.includes("timeout") || lower.includes("timed out") || lower.includes("etimedout")) {
    return "The website took too long to respond.";
  }
  if (
    lower.includes("enotfound") ||
    lower.includes("getaddrinfo") ||
    lower.includes("nxdomain") ||
    lower.includes("not found") ||
    lower.includes("err_name_not_resolved")
  ) {
    return "We couldn't find that website. Check the address and try again.";
  }
  if (
    lower === "fetch failed" ||
    lower.includes("fetch failed") ||
    lower.includes("econnrefused") ||
    lower.includes("econnreset") ||
    lower.includes("enetunreach") ||
    lower.includes("eai_again") ||
    lower.includes("network")
  ) {
    return "We couldn't reach that website. It may be down or blocking the check.";
  }
  return message;
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

type PublicTarget = { url: URL; address: string; family: 4 | 6 };

async function assertPublicHttpUrl(raw: string): Promise<PublicTarget> {
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
    return { url, address: hostname, family: net.isIP(hostname) as 4 | 6 };
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0 || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("That address points at a private network, so we skipped it.");
  }
  const chosen = records[0];
  return { url, address: chosen.address, family: chosen.family === 6 ? 6 : 4 };
}

function readLimited(response: http.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    response.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total <= maxBytes) chunks.push(chunk);
      if (total >= maxBytes) {
        response.destroy();
      }
    });
    response.on("end", () => {
      resolve(Buffer.concat(chunks).subarray(0, maxBytes).toString("utf8"));
    });
    response.on("error", reject);
  });
}

type PinnedResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
};

function fetchPinned(target: PublicTarget, timeoutMs: number): Promise<PinnedResponse> {
  const { url, address, family } = target;
  const isHttps = url.protocol === "https:";
  const lib = isHttps ? https : http;
  const port = url.port ? Number(url.port) : isHttps ? 443 : 80;
  const path = `${url.pathname || "/"}${url.search}`;

  return new Promise((resolve, reject) => {
    const request = lib.request(
      {
        host: address,
        family,
        port,
        path,
        method: "GET",
        headers: {
          host: url.host,
          "user-agent": "AIVisibilityCheck/0.1 (local business visibility check)",
          accept: "text/html,application/xhtml+xml",
        },
        servername: isHttps ? url.hostname.replace(/^\[|\]$/g, "") : undefined,
        timeout: timeoutMs,
      },
      (response) => {
        const status = response.statusCode || 0;
        const headers = response.headers;
        if (status >= 300 && status < 400) {
          response.resume();
          resolve({ status, headers, body: "" });
          return;
        }
        readLimited(response, HTML_LIMIT_BYTES)
          .then((body) => resolve({ status, headers, body }))
          .catch(reject);
      },
    );
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("The website took too long to respond."));
    });
    request.on("error", (error) => {
      reject(error);
    });
    request.end();
  });
}

function header(headers: http.IncomingHttpHeaders, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export async function checkWebsite(rawUrl: string, businessName: string): Promise<SiteCheck> {
  const base = { url: rawUrl, ...emptySignals() };
  try {
    let current = await assertPublicHttpUrl(rawUrl);
    let response: PinnedResponse | null = null;
    for (let hop = 0; hop < 4; hop++) {
      response = await fetchPinned(current, 8000);
      if (response.status >= 300 && response.status < 400) {
        const location = header(response.headers, "location");
        if (!location) throw new Error("The website redirected without a destination.");
        current = await assertPublicHttpUrl(new URL(location, current.url).toString());
        continue;
      }
      break;
    }
    if (!response) throw new Error("The website didn't respond.");
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`The website returned status ${response.status}.`);
    }
    const type = header(response.headers, "content-type");
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      throw new Error("That address isn't an HTML page we can check.");
    }
    return {
      ...base,
      ok: true,
      finalUrl: current.url.toString(),
      ...analyzeHtml(response.body, businessName),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "We couldn't read that website.";
    return { ...base, ok: false, error: friendlySiteError(message) };
  }
}
