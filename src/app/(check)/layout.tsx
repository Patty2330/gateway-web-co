import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { gateway, siteUrl } from "@/lib/gateway";

import "../globals.css";

const url = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: `Free AI visibility check · ${gateway.name}`,
  description:
    "See whether Perplexity, ChatGPT, and Gemini recommend your Clarksville business, and what to fix.",
  openGraph: {
    title: `Free AI visibility check · ${gateway.name}`,
    description:
      "See whether Perplexity, ChatGPT, and Gemini recommend your Clarksville business, and what to fix.",
    siteName: gateway.name,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Free AI visibility check · ${gateway.name}`,
    description:
      "See whether Perplexity, ChatGPT, and Gemini recommend your Clarksville business, and what to fix.",
  },
  icons: { icon: "/assets/favicon.svg" },
};

export default function CheckLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col antialiased">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
