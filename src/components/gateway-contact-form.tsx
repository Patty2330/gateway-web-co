"use client";

import { useState } from "react";

import { isPagesDemo } from "@/lib/pages";

export function GatewayContactForm({
  button,
  errorMessage,
}: {
  button: string;
  errorMessage: string;
}) {
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState<"ok" | "error" | "">("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    let ok = true;
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[required]").forEach((input) => {
      const bad = !input.value.trim();
      input.classList.toggle("invalid", bad);
      input.parentElement?.classList.toggle("invalid", bad);
      if (bad) ok = false;
    });
    if (!ok) {
      setStatus(errorMessage);
      setKind("error");
      return;
    }

    if (isPagesDemo()) {
      setStatus("Thanks. This demo preview does not send the note. Nothing was saved.");
      setKind("ok");
      form.reset();
      return;
    }

    const reach = String(data.get("reach") || "").trim();
    const email = reach.includes("@") ? reach : "";
    const phone = email ? "" : reach;
    setPending(true);
    setStatus("");
    setKind("");
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
        setKind("error");
        setPending(false);
        return;
      }
      setStatus("Thanks. Jalen will follow up about your website.");
      setKind("ok");
      form.reset();
    } catch {
      setStatus("The note didn't send. Please email or call Jalen.");
      setKind("error");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="quote-form" id="contact-form" noValidate onSubmit={onSubmit}>
      <h3>Get a free quote</h3>
      <p className="hint">Takes about a minute. No pressure, no spam.</p>
      <div className="in">
        <label htmlFor="quote-name">Your name</label>
        <input id="quote-name" name="name" required autoComplete="name" />
      </div>
      <div className="in">
        <label htmlFor="quote-business">Business name</label>
        <input id="quote-business" name="business" required autoComplete="organization" />
      </div>
      <div className="in">
        <label htmlFor="quote-reach">Phone or email</label>
        <input id="quote-reach" name="reach" required autoComplete="email" />
      </div>
      <div className="in">
        <label htmlFor="quote-current">Do you have a website now?</label>
        <select id="quote-current" name="current" defaultValue="No website yet">
          <option>No website yet</option>
          <option>Yes, but it needs work</option>
          <option>Only a Facebook page</option>
        </select>
      </div>
      <div className="in">
        <label htmlFor="quote-msg">What do you need?</label>
        <textarea id="quote-msg" name="msg" rows={3} placeholder="A new site, or fix my old one" />
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Sending…" : button}
      </button>
      <p className="form-status" role="status" aria-live="polite" data-kind={kind}>
        {status}
      </p>
    </form>
  );
}
