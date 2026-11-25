import { connection } from "next/server";

import { isPagesDemo } from "@/lib/pages";
import { anyProviderConfigured } from "@/lib/providers";

export async function SampleModeBanner() {
  if (isPagesDemo()) return null;
  await connection();
  if (anyProviderConfigured()) return null;
  return (
    <div
      data-sample-banner
      role="status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 80,
        background: "#7a1f1f",
        color: "#fff",
        textAlign: "center",
        fontWeight: 700,
        fontSize: "0.95rem",
        lineHeight: 1.4,
        padding: "0.6rem 1rem",
      }}
    >
      Sample mode, not live results. Scores are stand-ins until a Perplexity key is added.
    </div>
  );
}

export async function sampleModeActive(): Promise<boolean> {
  await connection();
  return !anyProviderConfigured();
}
