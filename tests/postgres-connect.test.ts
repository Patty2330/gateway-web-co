import net from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cachedStore,
  createStore,
  describeDbError,
  isRenderInternalHost,
  PG_CONNECT_TIMEOUT_MS,
  pgConnectionString,
  pgSslConfig,
  resetStoreCacheForTests,
} from "@/lib/db";

const internal = "postgresql://u:secret-pass@dpg-dc3gdklg1s2s73ddbi90-a/gateway_db";
const external = "postgresql://u:secret-pass@dpg-abc-a.oregon-postgres.render.com/db";

describe("postgres TLS settings", () => {
  it("recognizes Render internal hosts", () => {
    expect(isRenderInternalHost(internal)).toBe(true);
    expect(isRenderInternalHost(external)).toBe(false);
    expect(isRenderInternalHost("postgres://localhost/app")).toBe(false);
  });

  it("keeps TLS on but skips verification for Render internal URLs with PGSSL=require", () => {
    expect(pgSslConfig(internal, { PGSSL: "require" })).toEqual({ rejectUnauthorized: false });
  });

  it("verifies certificates for external hosts unless told not to", () => {
    expect(pgSslConfig(external, {})).toEqual({ rejectUnauthorized: true });
    expect(pgSslConfig(external, { PGSSL_NO_VERIFY: "1" })).toEqual({ rejectUnauthorized: false });
    expect(pgSslConfig(external, { PGSSL: "no-verify" })).toEqual({ rejectUnauthorized: false });
  });

  it("keeps verification on for Render external hosts with PGSSL=require", () => {
    const ext = "postgresql://u:p@dpg-x-a.oregon-postgres.render.com/db";
    expect(isRenderInternalHost(ext)).toBe(false);
    expect(pgSslConfig(ext, { PGSSL: "require" })).toEqual({ rejectUnauthorized: true });
  });

  it("keeps verification on for lookalike hosts with PGSSL=require", () => {
    for (const url of [
      "postgresql://u:p@dpg-evil.attacker.com/db",
      "postgresql://u:p@dpg-abc-a.attacker.com/db",
      "postgresql://u:p@example.com/db",
    ]) {
      expect(isRenderInternalHost(url)).toBe(false);
      expect(pgSslConfig(url, { PGSSL: "require" })).toEqual({ rejectUnauthorized: true });
    }
  });

  it("accepts PGSSL_NO_VERIFY=true as well as 1", () => {
    expect(pgSslConfig(external, { PGSSL_NO_VERIFY: "true" })).toEqual({ rejectUnauthorized: false });
    expect(pgSslConfig(external, { PGSSL_NO_VERIFY: "0" })).toEqual({ rejectUnauthorized: true });
  });

  it("drops ssl params from internal URLs only, so they cannot turn verification back on", () => {
    expect(pgConnectionString(`${internal}?sslmode=require`)).toBe(internal);
    expect(pgConnectionString(`${internal}?sslmode=verify-full&application_name=x`)).toBe(
      `${internal}?application_name=x`,
    );
    expect(pgConnectionString(internal)).toBe(internal);
    expect(pgConnectionString(`${external}?sslmode=require`)).toBe(`${external}?sslmode=require`);
  });

  it("turns TLS off when PGSSL says so, and stays off for plain local URLs", () => {
    expect(pgSslConfig(internal, { PGSSL: "disable" })).toBeUndefined();
    expect(pgSslConfig("postgres://localhost/app", {})).toBeUndefined();
  });
});

describe("store cache", () => {
  afterEach(() => resetStoreCacheForTests());

  it("retries after a failed connection instead of caching the failure forever", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const fake = {} as Awaited<ReturnType<typeof createStore>>;
    const factory = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error(`self-signed certificate ${internal}`), { code: "DEPTH_ZERO_SELF_SIGNED_CERT" }))
      .mockResolvedValueOnce(fake);
    await expect(cachedStore(factory)).rejects.toThrow();
    await Promise.resolve();
    expect(await cachedStore(factory)).toBe(fake);
    expect(await cachedStore(factory)).toBe(fake);
    expect(factory).toHaveBeenCalledTimes(2);
    const logged = err.mock.calls.flat().join(" ");
    expect(logged).toMatch(/DEPTH_ZERO_SELF_SIGNED_CERT/);
    expect(logged).not.toContain("secret-pass");
    err.mockRestore();
  });

  it("fails fast when the database cannot be reached", async () => {
    const started = Date.now();
    await expect(createStore({ databaseUrl: "postgres://u:p@127.0.0.1:1/db" })).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(11_000);
  }, 15_000);

  it("uses a 10 second connect timeout by default", () => {
    expect(PG_CONNECT_TIMEOUT_MS).toBe(10_000);
  });

  it("times out a server that accepts TCP but never answers", async () => {
    const sockets: net.Socket[] = [];
    const server = net.createServer((socket) => {
      sockets.push(socket); // accept and stay silent
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as net.AddressInfo).port;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const started = Date.now();
      await expect(
        createStore({ databaseUrl: `postgres://u:p@127.0.0.1:${port}/db`, connectTimeoutMs: 300 }),
      ).rejects.toThrow(/timeout/i);
      expect(Date.now() - started).toBeLessThan(3_000);
      expect(sockets.length).toBeGreaterThan(0);
    } finally {
      err.mockRestore();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 8_000);

  it("never puts the URL in error descriptions", () => {
    expect(describeDbError(new Error(`bad ${internal}`))).not.toContain("secret-pass");
  });
});
