"use client";

import { useState } from "react";

import { BrandLockup } from "@/components/brand-mark";
import { sitePath } from "@/lib/pages";

const links = [
  { href: "#work", label: "Our work" },
  { href: "#pricing", label: "Pricing" },
  { href: "#ai-check", label: "Free AI check" },
  { href: "#contact", label: "Questions" },
];

export function GatewayNav({ businessName }: { businessName: string; logo?: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="wrap" id="top">
      <nav className="site-nav" aria-label="Primary">
        <BrandLockup name="Two Forks" kicker="Studio · Clarksville" href="#top" />
        <div className="links">
          {links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </div>
        <a className="btn btn-primary nav-cta" href="#contact">
          Get a free quote
        </a>
        <button
          className="burger"
          type="button"
          aria-expanded={open}
          aria-controls="menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>
      <div id="menu" className={open ? "mobile-menu open" : "mobile-menu"} hidden={!open}>
        {links.map((link) => (
          <a key={link.href} href={link.href} onClick={close}>
            {link.label}
          </a>
        ))}
        <a className="btn btn-primary" href={sitePath("/check")} onClick={close}>
          Free AI Visibility Check
        </a>
        <a className="btn btn-ghost" href="#contact" onClick={close}>
          Get a free quote
        </a>
        <span className="sr-only">{businessName}</span>
      </div>
    </header>
  );
}
