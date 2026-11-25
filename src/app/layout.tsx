import type { ReactNode } from "react";
import { Suspense } from "react";
import { Fraunces, Outfit } from "next/font/google";

import { PagesBanner } from "@/components/pages-banner";
import { SampleModeBanner } from "@/components/sample-mode-banner";
import { isPagesDemo } from "@/lib/pages";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable}`}>
      <body>
        <Suspense fallback={null}>{isPagesDemo() ? <PagesBanner /> : <SampleModeBanner />}</Suspense>
        {children}
      </body>
    </html>
  );
}
