"use client";

import { useState } from "react";

export function GatewayContactForm({
  button,
  errorMessage,
}: {
  button: string;
  errorMessage: string;
}) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    let ok = true;
    form.querySelectorAll<HTMLInputElement>("[required]").forEach((input) => {
      const bad = !input.value.trim();
      input.classList.toggle("invalid", bad);
      if (bad) ok = false;
    });
    if (!ok) {
      setStatus(errorMessage);
      return;
    }

    const reach = String(data.get("reach") || "").trim();
    const email = reach.includes("@") ? reach : "";
    const phone = email ? "" : reach;
    setPending(true);
    setStatus("");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") || ""),
          businessName: String(data.get("business") || ""),
          email,
          phone,
          message: [
            `Website now: ${String(data.get("current") || "")}`,
            String(data.get("msg") || "").trim(),
            `Reach: ${reach}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus(body.error || "The note didn't send. Please email or call Jalen.");
        setPending(false);
        return;
      }
      setStatus("Thanks. Jalen will follow up about your website.");
      form.reset();
    } catch {
      setStatus("The note didn't send. Please email or call Jalen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form" id="contact-form" noValidate onSubmit={onSubmit}>
      <label>
        Your name
        <input name="name" required autoComplete="name" />
      </label>
      <label>
        Business name
        <input name="business" required />
      </label>
      <label>
        Email or phone
        <input name="reach" required />
      </label>
      <label>
        Do you have a website now?
        <select name="current" defaultValue="No website yet">
          <option>No website yet</option>
          <option>Yes, but it needs work</option>
          <option>Only a Facebook page</option>
        </select>
      </label>
      <label>
        Anything else?
        <textarea name="msg" rows={3} />
      </label>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Sending…" : button}
      </button>
      <p className="form-status" role="status" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
