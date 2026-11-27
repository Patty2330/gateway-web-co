import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { DM_Mono, Fraunces, Instrument_Sans } from "next/font/google";

import { PagesBanner } from "@/components/pages-banner";
import { SampleModeBanner } from "@/components/sample-mode-banner";
import { siteUrl } from "@/lib/gateway";
import { isPagesDemo } from "@/lib/pages";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-instrument",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

const url = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(url),
  applicationName: "Two Forks Studio",
  icons: {
    icon: [
      { url: "/assets/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  openGraph: {
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Two Forks Studio" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${instrument.variable} ${fraunces.variable} ${dmMono.variable} ${instrument.className}`}
    >
      <body>
        <Suspense fallback={null}>{isPagesDemo() ? <PagesBanner /> : <SampleModeBanner />}</Suspense>
        {children}
      </body>
    </html>
  );
}
