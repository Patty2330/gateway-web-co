import Image from "next/image";
import Link from "next/link";

import { FooterYear } from "@/components/footer-year";
import { gateway } from "@/lib/gateway";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-foreground text-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/images/logo-riverbend-dark.svg" alt="Two Forks Studio" width={36} height={36} unoptimized />
          <span>
            <span className="block font-serif text-lg leading-none tracking-tight">{gateway.name}</span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.28em] text-[#E2A23B]">
              Where the Cumberland meets the Red
            </span>
          </span>
        </Link>
        <p className="text-[#C9D6CF]">
          The free check, a $49 report, or $19 a month. © <FooterYear /> {gateway.name}.{" "}
          <Link href="/" className="underline underline-offset-4 text-background">
            Back to the website
          </Link>
        </p>
      </div>
    </footer>
  );
}
