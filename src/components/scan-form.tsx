"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoScanRecord } from "@/lib/demo-scan";
import { isPagesDemo } from "@/lib/pages";
import { savePagesScan } from "@/lib/pages-store";
import { readScanFormDraft, writeScanFormDraft } from "@/lib/scan-form-draft";
import { US_STATES } from "@/lib/states";

const fieldClass = "h-11 bg-card px-3 text-base md:text-base";

export function ScanForm({
  sampleMode: sampleModeProp,
  initialWebsite,
}: {
  sampleMode?: boolean;
  initialWebsite?: string;
} = {}) {
  const router = useRouter();
  const seededWebsite = initialWebsite?.trim() ?? "";
  const initial = readScanFormDraft();
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [category, setCategory] = useState(initial.category);
  const [city, setCity] = useState(initial.city);
  const [state, setState] = useState(initial.state);
  const [websiteUrl, setWebsiteUrl] = useState(seededWebsite || initial.websiteUrl);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [fetchedSampleMode, setFetchedSampleMode] = useState<boolean | null>(null);
  const sampleMode = sampleModeProp ?? (isPagesDemo() ? true : Boolean(fetchedSampleMode));

  useEffect(() => {
    const fromQuery =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("website")?.trim() || ""
        : "";
    const next = seededWebsite || fromQuery;
    if (next) setDraft({ websiteUrl: next });
  }, [seededWebsite]);

  useEffect(() => {
    if (sampleModeProp != null || isPagesDemo()) return;
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ mode?: string }>)
      .then((data) => {
        if (!cancelled) setFetchedSampleMode(data.mode !== "live");
      })
      .catch(() => {
        // Keep the last known mode if the health check fails.
      });
    return () => {
      cancelled = true;
    };
  }, [sampleModeProp]);

  function setDraft(update: Parameters<typeof writeScanFormDraft>[0]) {
    const next = writeScanFormDraft(update);
    if (update.businessName != null) setBusinessName(next.businessName);
    if (update.category != null) setCategory(next.category);
    if (update.city != null) setCity(next.city);
    if (update.state != null) setState(next.state);
    if (update.websiteUrl != null) setWebsiteUrl(next.websiteUrl);
  }

  function fillExample() {
    setDraft({
      businessName: "Harper's Plumbing",
      category: "plumber",
      city: "Clarksville",
      state: "TN",
      websiteUrl: "",
    });
    setError("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    if (isPagesDemo()) {
      const website = websiteUrl.trim();
      savePagesScan(
        demoScanRecord(
          {
            businessName: businessName.trim(),
            category: category.trim(),
            city: city.trim(),
            state,
            websiteUrl: website ? (website.startsWith("http") ? website : `https://${website}`) : null,
          },
          crypto.randomUUID(),
        ),
      );
      router.push("/scans/preview");
      return;
    }
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
          onChange={(event) => setDraft({ businessName: event.target.value })}
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
          onChange={(event) => setDraft({ category: event.target.value })}
          placeholder="plumber, salon, dentist…"
          required
        />
        <datalist id="categories">
          {["plumber", "electrician", "HVAC", "roofer", "salon", "barber", "dentist", "restaurant", "auto repair", "landscaper", "motorcycle dealer", "Harley-Davidson dealer"].map(
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
            onChange={(event) => setDraft({ city: event.target.value })}
            placeholder="Clarksville"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="state">State</Label>
          <select
            id="state"
            value={state}
            onChange={(event) => setDraft({ state: event.target.value })}
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
          onChange={(event) => setDraft({ websiteUrl: event.target.value })}
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
          {sampleMode
            ? "Sample mode, not live results. This run uses stand-in answers so you can click through the check."
            : "Writing eight questions a customer would ask, then sending them to Perplexity, ChatGPT, and Gemini. A live check can take a couple of minutes."}
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
