"use client";

import { useState } from "react";

import { isPagesDemo, sitePath } from "@/lib/pages";

export function GatewayNav({ businessName, logo }: { businessName: string; logo?: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const [first, rest] = businessName.split(/ (?=Web Co$)/);

  return (
    <header className="nav" id="top" style={isPagesDemo() ? { top: 44 } : undefined}>
      <div className="wrap nav-inner">
        <a className="brand" href="#top" aria-label={`${businessName} home`}>
          {logo ? (
            <img src={logo} alt="" width={34} height={34} />
          ) : (
          <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#7a1f1f" />
            <path d="M8 40c10-10 18 6 28-4s18-6 20-4" stroke="#f3c9a8" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M8 50c10-10 18 6 28-4s18-6 20-4" stroke="#fff" strokeOpacity=".55" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M18 30V16h28v14" stroke="#fff" strokeWidth="4" fill="none" strokeLinejoin="round" />
          </svg>
          )}
          <span>
            {rest ? (
              <>
                {first} <b>{rest}</b>
              </>
            ) : (
              businessName
            )}
          </span>
        </a>
        <button
          className="menu-btn"
          aria-expanded={open}
          aria-controls="menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav id="menu" className={open ? "menu open" : "menu"}>
          <a href="#pricing" onClick={close}>Pricing</a>
          <a href="#included" onClick={close}>What&apos;s included</a>
          <a href="#how" onClick={close}>How it works</a>
          <a href="#work" onClick={close}>Concepts</a>
          <a href="#faq" onClick={close}>FAQ</a>
          <a href={sitePath("/check")} onClick={close}>Free AI check</a>
          <a className="btn btn-sm" href="#contact" onClick={close}>Get a quote</a>
        </nav>
      </div>
    </header>
  );
}
