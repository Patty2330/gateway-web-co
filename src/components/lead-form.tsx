"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const fieldClass = "h-11 bg-card px-3 text-base md:text-base";

export function LeadForm({
  scanId,
  businessName,
}: {
  scanId?: string;
  businessName?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    businessName
      ? `I'd like help fixing the AI visibility issues for ${businessName}.`
      : "I'd like help getting my business named when people ask AI who to hire.",
  );
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          message,
          businessName: businessName || "",
          scanId: scanId || "",
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "The note didn't send. Try again.");
        setPending(false);
        return;
      }
      setDone(true);
    } catch {
      setError("The note didn't send. Check your connection and try again.");
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-secondary px-4 py-5 text-secondary-foreground">
        <p className="font-serif text-2xl">Got it.</p>
        <p className="mt-2 text-sm leading-6">
          Jalen will see your note. Gateway Web Co builds the website. The first 10 local
          clients are $500, and you pay only when you&apos;re 100% happy.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="lead-name">Your name</Label>
          <Input id="lead-name" className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lead-email">Email</Label>
          <Input id="lead-email" type="email" className={fieldClass} value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="lead-phone">Phone, if you want a call</Label>
        <Input id="lead-phone" className={fieldClass} value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="lead-message">What you want help with</Label>
        <Textarea
          id="lead-message"
          className="min-h-28 bg-card text-base md:text-base"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-primary">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? "Sending…" : "Send a note to Jalen"}
      </Button>
    </form>
  );
}
