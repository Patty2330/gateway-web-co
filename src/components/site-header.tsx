import Image from "next/image";
import Link from "next/link";

import { stickyHeaderTopClass } from "@/lib/banner-layout";
import { gateway } from "@/lib/gateway";

export function SiteHeader() {
  return (
    <header
      className={`sticky z-20 border-b border-border/80 bg-background/90 backdrop-blur ${stickyHeaderTopClass}`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image
            src="/images/logo-riverbend-light.svg"
            alt="Two Forks Studio"
            width={40}
            height={40}
            unoptimized
            priority
          />
          <span>
            <span className="block font-serif text-[22px] leading-none tracking-tight text-foreground">
              {gateway.name}
            </span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.28em] text-primary">
              Free AI check · Clarksville
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/check" className="text-muted-foreground hover:text-foreground">
            Free check
          </Link>
          <Link href="/#pricing" className="hidden text-muted-foreground hover:text-foreground sm:inline">
            Website pricing
          </Link>
          <Link
            href="/#contact"
            className="rounded-full bg-primary px-3 py-2 font-semibold text-primary-foreground shadow-[0_2px_0_#6F2816] hover:bg-primary/90"
          >
            Get a website
          </Link>
        </nav>
      </div>
    </header>
  );
}
