"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { sitePath } from "@/lib/pages";
import { writeScanFormDraft } from "@/lib/scan-form-draft";

export function HomeCheckForm() {
  const router = useRouter();
  const [website, setWebsite] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = website.trim();
    if (value) writeScanFormDraft({ websiteUrl: value });
    const params = new URLSearchParams();
    if (value) params.set("website", value);
    const query = params.toString();
    router.push(query ? `${sitePath("/check")}?${query}` : sitePath("/check"));
  }

  return (
    <form className="field" onSubmit={onSubmit} action={sitePath("/check")} method="get">
      <input
        type="text"
        name="website"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        placeholder="yourbusiness.com"
        aria-label="Website address"
        autoComplete="url"
      />
      <button className="btn btn-primary" type="submit">
        Run my free check
      </button>
    </form>
  );
}
