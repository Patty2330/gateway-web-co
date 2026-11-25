import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getStore } from "@/lib/db";
import { getEmailSender } from "@/lib/email";
import { clientIp, hashIp } from "@/lib/request";

const schema = z
  .object({
    name: z.string().trim().min(2, "Add your name.").max(80),
    email: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    businessName: z.string().trim().max(80).optional(),
    message: z.string().trim().min(5, "Add a short note.").max(2000),
    scanId: z.string().uuid().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const email = value.email?.trim() || "";
    const phone = value.phone?.trim() || "";
    if (!email && !phone) {
      ctx.addIssue({ code: "custom", message: "Add an email or a phone number." });
    }
    if (email && !z.email().safeParse(email).success) {
      ctx.addIssue({ code: "custom", message: "That email doesn't look right." });
    }
  });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the note as JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message || "Check the form and try again." },
      { status: 400 },
    );
  }

  const store = await getStore();
  const count = await store.consumeRateLimit(
    `${hashIp(clientIp(request))}:lead`,
    new Date().toISOString().slice(0, 10),
  );
  if (count > 10) {
    return Response.json(
      { error: "That's enough notes for today. Jalen will see the ones you already sent." },
      { status: 429 },
    );
  }

  const id = randomUUID();
  const scanId = parsed.data.scanId || null;
  await store.insertLead(
    id,
    {
      scanId,
      name: parsed.data.name,
      email: parsed.data.email?.trim() || "",
      phone: parsed.data.phone || null,
      businessName: parsed.data.businessName || null,
      message: parsed.data.message,
    },
    new Date().toISOString(),
  );

  const notify = process.env.LEADS_NOTIFY_EMAIL;
  if (notify) {
    await getEmailSender().send({
      to: notify,
      subject: `New Gateway Web Co note from ${parsed.data.name}`,
      text: [
        `${parsed.data.name} <${parsed.data.email}>`,
        parsed.data.phone ? `Phone: ${parsed.data.phone}` : "",
        parsed.data.businessName ? `Business: ${parsed.data.businessName}` : "",
        scanId ? `Check: /scans/${scanId}` : "",
        "",
        parsed.data.message,
      ]
        .filter(Boolean)
        .join("\n"),
      scanId,
    });
  }

  return Response.json({ id });
}
