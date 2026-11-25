import Link from "next/link";

import { gateway } from "@/lib/gateway";
import { isPagesDemo } from "@/lib/pages";
import { anyProviderConfigured } from "@/lib/providers";

export function SiteHeader({ offset }: { offset?: boolean } = {}) {
  const raise = offset ?? (isPagesDemo() || !anyProviderConfigured());
  return (
    <header
      className={`sticky z-20 border-b border-border/80 bg-background/90 backdrop-blur ${raise ? "top-11" : "top-0"}`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#7a1f1f" />
            <path d="M8 40c10-10 18 6 28-4s18-6 20-4" stroke="#f3c9a8" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M18 30V16h28v14" stroke="#fff" strokeWidth="4" fill="none" strokeLinejoin="round" />
          </svg>
          <span>
          <span className="block font-serif text-lg leading-none tracking-tight text-foreground">
            {gateway.name}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Free AI visibility check · Clarksville, TN
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
            className="rounded-full bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Get a website
          </Link>
        </nav>
      </div>
    </header>
  );
}
