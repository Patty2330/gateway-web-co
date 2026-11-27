import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { GatewayContactForm } from "@/components/gateway-contact-form";
import { GatewayHome } from "@/components/gateway-home";
import { HomeCheckForm } from "@/components/home-check-form";
import { getSite } from "@/lib/site";

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      className,
    }: {
      href: string;
      children?: React.ReactNode;
      className?: string;
    }) => React.createElement("a", { href, className }, children),
  };
});

vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    default: ({
      src,
      alt,
      className,
    }: {
      src: string;
      alt?: string;
      className?: string;
    }) => React.createElement("img", { src, alt: alt ?? "", className }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "--font-fraunces", className: "font-fraunces" }),
  Instrument_Sans: () => ({ variable: "--font-instrument", className: "font-instrument" }),
  DM_Mono: () => ({ variable: "--font-dm-mono", className: "font-dm-mono" }),
}));

const conceptA = [
  /logos\/export/i,
  /mark-a-(?:light|dark)/i,
  /concept-a/i,
  /The Confluence/,
  /M40 38 L57 38/,
];

const riverbendFiles = [
  "public/images/logo-riverbend-light.svg",
  "public/images/logo-riverbend-dark.svg",
  "assets/favicon.svg",
  "public/favicon.svg",
  "public/favicon.ico",
  "public/favicon-32x32.png",
  "public/apple-touch-icon.png",
  "public/icon-192.png",
  "public/icon-512.png",
  "public/og-image.png",
  "public/images/hero-owner.jpg",
  "public/images/river-confluence.jpg",
  "public/images/work-coffee.jpg",
  "public/images/work-barber.jpg",
  "public/images/work-contractor.jpg",
];

function walk(rel: string): string[] {
  const abs = path.join(process.cwd(), rel);
  if (!existsSync(abs)) return [];
  const st = statSync(abs);
  if (st.isFile()) return [rel];
  const out: string[] = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    out.push(...walk(path.join(rel, entry.name)));
  }
  return out;
}

describe("Riverbend redesign assets", () => {
  it("ships Concept B Riverbend marks, generated icons, and the five photos", () => {
    for (const file of riverbendFiles) {
      expect(existsSync(path.join(process.cwd(), file)), file).toBe(true);
    }
    const light = readFileSync(path.join(process.cwd(), "public/images/logo-riverbend-light.svg"), "utf8");
    const dark = readFileSync(path.join(process.cwd(), "public/images/logo-riverbend-dark.svg"), "utf8");
    const fav = readFileSync(path.join(process.cwd(), "assets/favicon.svg"), "utf8");
    for (const svg of [light, dark, fav]) {
      expect(svg).toContain("circle cx=\"126\" cy=\"58\"");
      expect(svg).toContain("#E2A23B");
      expect(svg).not.toMatch(/M40 38 L57 38/);
    }
    expect(light).toContain("#B4442A");
    expect(dark).toContain("#DB6B4C");
  });

  it("does not ship Concept A export assets or leftover confluence favicon artwork", () => {
    const roots = ["public", "assets", "src", "styles.css"];
    const hits: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        if (/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|map)$/i.test(file)) continue;
        const contents = readFileSync(path.join(process.cwd(), file), "utf8");
        for (const pattern of conceptA) {
          if (pattern.test(contents) || pattern.test(file)) hits.push(`${file}: ${pattern}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("homepage markup", () => {
  it("labels every sample work card as a sample site and keeps the live contact details", () => {
    const html = renderToStaticMarkup(createElement(GatewayHome, { site: getSite() }));
    expect(html).toContain("Sample site · Coffee shop");
    expect(html).toContain("Sample site · Barbershop");
    expect(html).toContain("Sample site · Contractor");
    expect(html).toContain("These are sample sites we designed for made-up local businesses");
    expect(html).toContain("not real clients");
    expect(html).toContain("hello@twoforksstudio.com");
    expect(html).toContain("mailto:hello@twoforksstudio.com");
    expect(html).toContain("/images/logo-riverbend-light.svg");
    expect(html).toContain("/images/logo-riverbend-dark.svg");
    expect(html).toContain("/images/hero-owner.jpg");
    expect(html).toContain("/images/work-coffee.jpg");
    expect(html).toContain("/images/work-barber.jpg");
    expect(html).toContain("/images/work-contractor.jpg");
    expect(html).not.toContain("Gateway Web Co");
    expect(html).not.toContain("Red River Sites");
    expect(html).not.toContain("gatewaywebco@gmail.com");
    expect(html.match(/Sample site/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("wires the quote form to /api/leads and the AI check box toward /check", () => {
    const quote = readFileSync(path.join(process.cwd(), "src/components/gateway-contact-form.tsx"), "utf8");
    const check = readFileSync(path.join(process.cwd(), "src/components/home-check-form.tsx"), "utf8");
    const scan = readFileSync(path.join(process.cwd(), "src/components/scan-form.tsx"), "utf8");
    const page = readFileSync(path.join(process.cwd(), "src/app/(check)/check/page.tsx"), "utf8");
    expect(quote).toContain('fetch("/api/leads"');
    expect(quote).toContain('name="name"');
    expect(quote).toContain('name="business"');
    expect(quote).toContain('name="reach"');
    expect(quote).toContain('name="current"');
    expect(quote).toContain('name="msg"');
    expect(check).toContain('sitePath("/check")');
    expect(check).toContain("params.set(\"website\", value)");
    expect(check).toContain("writeScanFormDraft({ websiteUrl: value })");
    expect(scan).toContain('fetch("/api/scans"');
    expect(scan).toContain("window.location.search");
    expect(scan).toContain("initialWebsite");
    expect(page).toMatch(/<ScanForm(?:\s[^>]*)?\s*\/>/);
    expect(page).not.toMatch(/<Suspense/);
    renderToStaticMarkup(createElement(GatewayContactForm, { button: "Send it over", errorMessage: "Please fill this in." }));
    renderToStaticMarkup(createElement(HomeCheckForm));
  });
});
