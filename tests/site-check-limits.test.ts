import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import {
  HTML_LIMIT_BYTES,
  PORT_NOT_ALLOWED_MESSAGE,
  checkWebsite,
  isPrivateAddress,
  readLimited,
} from "@/lib/site-check";

const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

async function serve(handler: http.RequestListener): Promise<string> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/`;
}

function get(url: string): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    http.get(url, resolve).on("error", reject);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`hung for ${ms}ms`)), ms)),
  ]);
}

describe("readLimited", () => {
  it("resolves promptly with the first 2 MB of a page that never ends", async () => {
    // An endless body: "end" never fires. Before the fix, destroy() left the
    // promise pending forever because only "end" resolved it.
    const url = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      const chunk = Buffer.alloc(64 * 1024, "a");
      const pump = () => {
        while (res.write(chunk)) {
          /* keep writing until backpressure */
        }
      };
      res.on("drain", pump);
      pump();
    });
    const response = await get(url);
    const started = Date.now();
    const body = await withTimeout(readLimited(response, HTML_LIMIT_BYTES), 5000);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(body.length).toBe(HTML_LIMIT_BYTES);
    expect(response.destroyed).toBe(true);
  });

  it("resolves a 3 MB page capped at 2 MB", async () => {
    const url = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "text/html", "content-length": String(3_000_000) });
      res.end(Buffer.alloc(3_000_000, "b"));
    });
    const body = await withTimeout(readLimited(await get(url), HTML_LIMIT_BYTES), 5000);
    expect(body.length).toBe(HTML_LIMIT_BYTES);
  });

  it("returns a small page whole", async () => {
    const url = await serve((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><title>Hi</title></html>");
    });
    expect(await withTimeout(readLimited(await get(url), HTML_LIMIT_BYTES), 5000)).toBe(
      "<html><title>Hi</title></html>",
    );
  });

  it("rejects (does not hang) when the server cuts the body off early", async () => {
    const url = await serve((req, res) => {
      res.writeHead(200, { "content-type": "text/html", "content-length": "100000" });
      res.write("partial");
      setTimeout(() => req.socket.destroy(), 20);
    });
    await expect(withTimeout(readLimited(await get(url), HTML_LIMIT_BYTES), 5000)).rejects.toThrow(
      /closed|aborted|socket hang up|ECONNRESET/i,
    );
  });
});

describe("SSRF reserved ranges", () => {
  it.each([
    "192.0.0.1",
    "192.0.0.170",
    "198.18.0.1",
    "198.19.255.254",
    "224.0.0.1",
    "239.255.255.250",
    "240.0.0.1",
    "255.255.255.255",
    "::ffff:198.18.0.1",
    "::ffff:224.0.0.1",
    "2002::1",
    "2002:c0a8:0101::1",
    "2002:7f00:0001::",
    "ff02::1",
  ])("blocks %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    "192.0.1.1",
    "192.1.0.1",
    "198.17.255.255",
    "198.20.0.1",
    "223.255.255.255",
    "8.8.8.8",
    "2001:4860:4860::8888",
    "2003::1",
  ])("still allows public %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("site check ports", () => {
  it.each([
    "http://93.184.215.14:8080/",
    "https://93.184.215.14:8443/",
    "http://93.184.215.14:22/",
    "http://93.184.215.14:6379/",
    "https://example.com:3000/",
  ])("refuses %s before any network call", async (url) => {
    const result = await checkWebsite(url, "Harper's Plumbing");
    expect(result.ok).toBe(false);
    expect(result.error).toBe(PORT_NOT_ALLOWED_MESSAGE);
  });

  it("lets explicit :80 and :443 past the port rule", async () => {
    // A private IP fails fast on the next rule, which proves the port rule passed.
    for (const url of ["http://10.0.0.1:80/", "https://10.0.0.1:443/", "http://10.0.0.1:443/", "https://10.0.0.1:80/"]) {
      const result = await checkWebsite(url, "Harper's Plumbing");
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).not.toBe(PORT_NOT_ALLOWED_MESSAGE);
    }
  });

  it("applies the port rule to redirect targets too", async () => {
    // Redirect hops go back through the same URL guard as the first request.
    const result = await checkWebsite("http://10.0.0.1:9000/", "Harper's Plumbing");
    expect(result.error).toBe(PORT_NOT_ALLOWED_MESSAGE);
  });
});
