import { describe, expect, it } from "vitest";

import { databaseType, logMissingDatabaseUrl, missingDatabaseUrlWarning } from "@/lib/db";

describe("health database type", () => {
  it("reports postgres or sqlite and never returns the URL", () => {
    const secret = "postgres://gateway:super-secret-pass@db.example.com:5432/app";
    expect(databaseType(secret)).toBe("postgres");
    expect(databaseType("postgresql://localhost/app")).toBe("postgres");
    expect(databaseType(null)).toBe("sqlite");
    expect(databaseType("file:./data/visibility.db")).toBe("sqlite");
    expect(databaseType(secret)).not.toContain("super-secret-pass");
    expect(databaseType(secret)).not.toContain("db.example.com");
  });

  it("warns in production when DATABASE_URL is missing, without secrets", () => {
    const warning = missingDatabaseUrlWarning({ NODE_ENV: "production" });
    expect(warning).toMatch(/DATABASE_URL is not set/i);
    expect(warning).toMatch(/SQLite/i);
    expect(warning).not.toMatch(/postgres(ql)?:\/\//i);
    expect(warning).not.toMatch(/password/i);

    expect(
      missingDatabaseUrlWarning({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://gateway:super-secret-pass@db.example.com/app",
      }),
    ).toBeNull();
    expect(missingDatabaseUrlWarning({ NODE_ENV: "test" })).toBeNull();
  });

  it("prints the missing DATABASE_URL warning only once", () => {
    const flags = globalThis as unknown as { __gatewayMissingDatabaseUrlLogged?: boolean };
    flags.__gatewayMissingDatabaseUrlLogged = false;
    const messages: string[] = [];
    logMissingDatabaseUrl({ NODE_ENV: "production" }, (message) => messages.push(message));
    logMissingDatabaseUrl({ NODE_ENV: "production" }, (message) => messages.push(message));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/DATABASE_URL is not set/i);
  });
});
