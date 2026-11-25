import { connection } from "next/server";

import { topBannerStyle } from "@/lib/banner-layout";
import { isPagesDemo } from "@/lib/pages";
import { anyProviderConfigured } from "@/lib/providers";

export async function SampleModeBanner() {
  if (isPagesDemo()) return null;
  await connection();
  if (anyProviderConfigured()) return null;
  return (
    <div data-sample-banner role="status" style={topBannerStyle}>
      Sample mode, not live results. Scores are stand-ins until a Perplexity key is added.
    </div>
  );
}

export async function sampleModeActive(): Promise<boolean> {
  await connection();
  return !anyProviderConfigured();
}
