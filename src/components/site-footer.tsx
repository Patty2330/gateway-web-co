import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Gateway Web Co · Clarksville, Tennessee. The free check, a $49 report, or $19 a month.</p>
        <p>
          <Link href="/" className="underline underline-offset-4">
            Back to the website
          </Link>
        </p>
      </div>
    </footer>
  );
}
