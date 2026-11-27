import fs from "node:fs";
import path from "node:path";

import { parse } from "yaml";

export type SiteContent = {
  business_name: string;
  owner_name: string;
  email: string;
  url: string;
  phone: string;
  linkedin: string;
  service_area: string;
  hours: string;
  footer_place: string;
  photos: { logo: string; hero: string };
  seo: {
    title: string;
    description: string;
    social_title: string;
    social_description: string;
  };
  price: string;
  price_label: string;
  hero: {
    eyebrow: string;
    headline: string;
    highlight: string;
    intro: string;
    button_main: string;
    button_secondary: string;
    trust_points: string[];
    example_web_address: string;
    phone_button_label: string;
  };
  pricing: {
    eyebrow: string;
    heading: string;
    intro: string;
    items: { title: string; price: string; text: string }[];
  };
  included: {
    eyebrow: string;
    heading: string;
    items: { icon: string; title: string; text: string }[];
  };
  how: {
    eyebrow: string;
    heading: string;
    steps: { title: string; text: string; meta?: string }[];
  };
  why: {
    eyebrow: string;
    heading: string;
    paragraphs: string[];
    points: { lead: string; text: string }[];
  };
  concepts: {
    eyebrow: string;
    heading: string;
    note: string;
    items: { title: string; caption: string; photo: string }[];
  };
  faq: {
    eyebrow: string;
    heading: string;
    items: { question: string; answer: string }[];
  };
  contact_section: {
    eyebrow: string;
    heading: string;
    intro: string;
    form_button: string;
    form_error: string;
  };
};

let cached: SiteContent | null = null;

export function getSite(): SiteContent {
  if (cached) return cached;
  const file = path.join(process.cwd(), "_data", "site.yml");
  cached = parse(fs.readFileSync(file, "utf8")) as SiteContent;
  return cached;
}
