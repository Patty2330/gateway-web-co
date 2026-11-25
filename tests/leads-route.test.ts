import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStore } from "@/lib/db";
import { hashIp, leadsDailyLimitReachedMessage, rateLimitDay } from "@/lib/request";

let store: Awaited<ReturnType<typeof createStore>>;

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getStore: async () => store };
});

async function postLead(name = "Pat Owner") {
  const { POST } = await import("@/app/api/leads/route");
  return POST(
    new Request("http://127.0.0.1/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email: "pat@example.com",
        message: "Please take a look at my site.",
      }),
    }),
  );
}

describe("POST /api/leads", () => {
  beforeEach(async () => {
    store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    vi.resetModules();
  });

  it("returns a neutral 429 message that does not name Jalen", async () => {
    const key = `${hashIp("local")}:lead`;
    const day = rateLimitDay();
    for (let index = 0; index < 10; index++) {
      expect(await store.consumeRateLimit(key, day)).toBe(index + 1);
    }

    const blocked = await postLead("Overflow Owner");
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body).toEqual({ error: leadsDailyLimitReachedMessage() });
    expect(body.error).not.toMatch(/Jalen/);
    expect(body.error).toMatch(/Two Forks Studio|us/i);
    expect(JSON.stringify(body)).not.toContain("gatewaywebco@gmail.com");
  });
});
