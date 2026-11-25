import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { gateway } from "@/lib/gateway";

import "../globals.css";

export const metadata: Metadata = {
  title: `Free AI visibility check · ${gateway.name}`,
  description:
    "See whether Perplexity recommends your Clarksville business, and what to fix.",
  openGraph: {
    title: `Free AI visibility check · ${gateway.name}`,
    description:
      "See whether Perplexity recommends your Clarksville business, and what to fix.",
    siteName: gateway.name,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Free AI visibility check · ${gateway.name}`,
    description:
      "See whether Perplexity recommends your Clarksville business, and what to fix.",
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
