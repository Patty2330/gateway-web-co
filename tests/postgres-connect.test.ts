import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cachedStore,
  createStore,
  describeDbError,
  isRenderInternalHost,
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

  it("never puts the URL in error descriptions", () => {
    expect(describeDbError(new Error(`bad ${internal}`))).not.toContain("secret-pass");
  });
});
