import { randomUUID } from "node:crypto";

import { getStore } from "@/lib/db";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  scanId?: string | null;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<{ id: string }>;
}

/**
 * Saves the message in the database instead of delivering it.
 * Swap this class for a provider (Resend, Postmark, SES) when you want real mail.
 * The monthly watch and the lead form both call EmailSender, so only this file changes.
 */
export class OutboxEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<{ id: string }> {
    const id = randomUUID();
    const store = await getStore();
    await store.insertEmail({
      id,
      to: message.to,
      subject: message.subject,
      body: message.text,
      scanId: message.scanId ?? null,
      createdAt: new Date().toISOString(),
    });
    console.info(`[email outbox] to=${message.to} subject=${message.subject}`);
    return { id };
  }
}

export function getEmailSender(): EmailSender {
  return new OutboxEmailSender();
}
