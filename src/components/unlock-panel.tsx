"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UnlockPanel({
  scanId,
  email,
  tier,
}: {
  scanId: string;
  email: string | null;
  tier: "free" | "report" | "monitor";
}) {
  const router = useRouter();
  const [address, setAddress] = useState(email || "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"report" | "monitor" | null>(null);

  async function start(plan: "report" | "monitor") {
    setError("");
    setPending(plan);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId, plan, email: address }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error || "Checkout didn't start.");
        setPending(null);
        return;
      }
      if (data.url.startsWith("/")) {
        router.push(data.url);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Checkout didn't start. Try again.");
      setPending(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="pay-email">Email for the receipt{tier !== "monitor" ? " and monthly notes" : ""}</Label>
        <Input
          id="pay-email"
          type="email"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="you@business.com"
          className="h-11 bg-card px-3 text-base md:text-base"
          required
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-primary">
          {error}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {tier === "free" ? (
          <Button type="button" size="lg" className="h-12 text-base" disabled={pending !== null} onClick={() => start("report")}>
            {pending === "report" ? "Opening checkout…" : "Full report · $49"}
          </Button>
        ) : null}
        {tier !== "monitor" ? (
          <Button
            type="button"
            size="lg"
            variant={tier === "free" ? "outline" : "default"}
            className="h-12 text-base"
            disabled={pending !== null}
            onClick={() => start("monitor")}
          >
            {pending === "monitor" ? "Opening checkout…" : "Watch monthly · $19"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
