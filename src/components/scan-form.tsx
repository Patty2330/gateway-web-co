"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { US_STATES } from "@/lib/states";

const fieldClass = "h-11 bg-card px-3 text-base md:text-base";

export function ScanForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("TN");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function fillExample() {
    setBusinessName("Harper's Plumbing");
    setCategory("plumber");
    setCity("Clarksville");
    setState("TN");
    setWebsiteUrl("");
    setError("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, category, city, state, websiteUrl }),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        setError(data.error || "The check didn't start. Try again.");
        setPending(false);
        return;
      }
      router.push(`/scans/${data.id}`);
    } catch {
      setError("The check didn't start. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" id="check">
      <div className="grid gap-2">
        <Label htmlFor="businessName">Business name</Label>
        <Input
          id="businessName"
          className={fieldClass}
          value={businessName}
          onChange={(event) => setBusinessName(event.target.value)}
          placeholder="Harper's Plumbing"
          autoComplete="organization"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="category">What you do</Label>
        <Input
          id="category"
          className={fieldClass}
          list="categories"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="plumber, salon, dentist…"
          required
        />
        <datalist id="categories">
          {["plumber", "electrician", "HVAC", "roofer", "salon", "barber", "dentist", "restaurant", "auto repair", "landscaper"].map(
            (item) => (
              <option key={item} value={item} />
            ),
          )}
        </datalist>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8.5rem]">
        <div className="grid gap-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            className={fieldClass}
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Clarksville"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="state">State</Label>
          <select
            id="state"
            value={state}
            onChange={(event) => setState(event.target.value)}
            className="h-11 rounded-lg border border-input bg-card px-3 text-base"
          >
            {US_STATES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="websiteUrl">Website, if you have one</Label>
        <Input
          id="websiteUrl"
          className={fieldClass}
          value={websiteUrl}
          onChange={(event) => setWebsiteUrl(event.target.value)}
          placeholder="https://yourbusiness.com"
          inputMode="url"
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? "Running the check…" : "Check my visibility"}
      </Button>
      {pending ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Writing the questions a customer would ask, then sending them to ChatGPT, Perplexity,
          and Gemini. A live check can take a minute. A sample check is quicker.
        </p>
      ) : (
        <button
          type="button"
          onClick={fillExample}
          className="text-left text-sm text-accent underline-offset-4 hover:underline"
        >
          Fill in an example: Harper&apos;s Plumbing in Clarksville
        </button>
      )}
    </form>
  );
}
