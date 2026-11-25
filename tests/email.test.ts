import { describe, expect, it, vi } from "vitest";

import { createStore } from "@/lib/db";
import { deliverEmail, mailConfig, postResendEmail } from "@/lib/email";

const message = {
  to: "owner@example.com",
  subject: "New Two Forks Studio note from Sam",
  text: "Sam wants a website.",
  scanId: null,
};

describe("mail config", () => {
  it("sends only when both the key and the from address are set", () => {
    expect(mailConfig({})).toBeNull();
    expect(mailConfig({ RESEND_API_KEY: "re_test", EMAIL_FROM: "  " })).toBeNull();
    expect(mailConfig({ RESEND_API_KEY: "", EMAIL_FROM: "notes@example.com" })).toBeNull();
    expect(mailConfig({ RESEND_API_KEY: "re_test", EMAIL_FROM: "notes@example.com" })).toEqual({
      apiKey: "re_test",
      from: "notes@example.com",
    });
  });
});

describe("outbox email", () => {
  it("stores the note and does not call Resend when either setting is missing", async () => {
    const store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    const fetchImpl = vi.fn();
    const stored = await deliverEmail(store, message, {
      apiKey: "re_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(stored.status).toBe("stored");
    expect(fetchImpl).not.toHaveBeenCalled();
    const row = await store.getEmail(stored.id);
    expect(row?.status).toBe("stored");
    expect(row?.error).toBeNull();
    expect(row?.body).toBe(message.text);
  });

  it("sends through Resend and marks the row sent", async () => {
    const store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const sent = await deliverEmail(store, message, {
      apiKey: "re_test_key",
      from: "Two Forks Studio <onboarding@resend.dev>",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(sent.status).toBe("sent");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: "Two Forks Studio <onboarding@resend.dev>",
      to: ["owner@example.com"],
      subject: message.subject,
      text: message.text,
    });
    const row = await store.getEmail(sent.id);
    expect(row?.status).toBe("sent");
    expect(row?.error).toBeNull();
  });

  it("records a Resend failure and does not throw", async () => {
    const store = await createStore({ sqlitePath: ":memory:", databaseUrl: null });
    const fetchImpl = vi.fn(
      async () => new Response('{"message":"domain is not verified","name":"validation_error"}', { status: 403 }),
    );
    const failed = await deliverEmail(store, message, {
      apiKey: "re_secret",
      from: "notes@example.com",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(failed.status).toBe("failed");
    const row = await store.getEmail(failed.id);
    expect(row?.status).toBe("failed");
    expect(row?.error).toContain("403");
    expect(row?.error).not.toContain("re_secret");
  });
});

describe("postResendEmail", () => {
  it("scrubs a key if Resend echoes one", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("bad key re_live_example", { status: 401 }),
    );
    await expect(
      postResendEmail(
        {
          apiKey: "re_live_example",
          from: "onboarding@resend.dev",
          to: "a@example.com",
          subject: "Hi",
          text: "Hello",
        },
        fetchImpl as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/\[key\]/);
  });
});
