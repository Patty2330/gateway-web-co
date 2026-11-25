import { randomUUID } from "node:crypto";

import { getStore } from "@/lib/db";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  scanId?: string | null;
};

export type MailStatus = "stored" | "sent" | "failed";

export interface EmailSender {
  send(message: EmailMessage): Promise<{ id: string }>;
}

type MailStore = {
  insertEmail(input: {
    id: string;
    to: string;
    subject: string;
    body: string;
    scanId: string | null;
    createdAt: string;
  }): Promise<void>;
  markEmail(id: string, status: "sent" | "failed", error: string | null): Promise<void>;
};

export function mailConfig(env?: {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}): { apiKey: string; from: string } | null {
  const source = env ?? process.env;
  const apiKey = source.RESEND_API_KEY?.trim() || "";
  const from = source.EMAIL_FROM?.trim() || "";
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

function scrub(value: string): string {
  return value.replace(/re_[A-Za-z0-9_]+/g, "[key]").replace(/\s+/g, " ").trim().slice(0, 300);
}

/** POST one message to Resend. Throws a short error when Resend rejects it. */
export async function postResendEmail(
  input: { apiKey: string; from: string; to: string; subject: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = scrub(body);
    throw new Error(detail ? `Resend returned ${response.status}. ${detail}` : `Resend returned ${response.status}.`);
  }
}

/**
 * Always writes the outbox row. Sends through Resend only when both
 * RESEND_API_KEY and EMAIL_FROM are set. A send failure is stored on the row
 * and is not thrown.
 */
export async function deliverEmail(
  store: MailStore,
  message: EmailMessage,
  options: {
    apiKey?: string;
    from?: string;
    fetchImpl?: typeof fetch;
    now?: Date;
    id?: string;
  } = {},
): Promise<{ id: string; status: MailStatus }> {
  const id = options.id ?? randomUUID();
  const createdAt = (options.now ?? new Date()).toISOString();
  await store.insertEmail({
    id,
    to: message.to,
    subject: message.subject,
    body: message.text,
    scanId: message.scanId ?? null,
    createdAt,
  });

  const config = mailConfig({
    RESEND_API_KEY: options.apiKey,
    EMAIL_FROM: options.from,
  });
  if (!config) {
    console.info(`[email outbox] to=${message.to} subject=${message.subject}`);
    return { id, status: "stored" };
  }

  try {
    await postResendEmail(
      {
        apiKey: config.apiKey,
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      },
      options.fetchImpl ?? fetch,
    );
    await store.markEmail(id, "sent", null);
    console.info(`[email sent] to=${message.to} subject=${message.subject}`);
    return { id, status: "sent" };
  } catch (error) {
    const detail = scrub(error instanceof Error ? error.message : "Email failed.");
    try {
      await store.markEmail(id, "failed", detail || "Email failed.");
    } catch (markError) {
      console.error("[email] could not record the send failure", markError);
    }
    console.error(`[email failed] to=${message.to} subject=${message.subject}`);
    return { id, status: "failed" };
  }
}

export class OutboxEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<{ id: string }> {
    const store = await getStore();
    const result = await deliverEmail(store, message, {
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
    });
    return { id: result.id };
  }
}

export function getEmailSender(): EmailSender {
  return new OutboxEmailSender();
}
