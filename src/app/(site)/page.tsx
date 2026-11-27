import type { Metadata } from "next";

import { GatewayHome } from "@/components/gateway-home";
import { siteUrl } from "@/lib/gateway";
import { getSite } from "@/lib/site";

const site = getSite();
const url = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: site.seo.title,
  description: site.seo.description,
  applicationName: site.business_name,
  alternates: { canonical: "/" },
  openGraph: {
    title: site.seo.social_title,
    description: site.seo.social_description,
    siteName: site.business_name,
    type: "website",
    url,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: site.business_name }],
  },
  twitter: {
    card: "summary_large_image",
    title: site.seo.social_title,
    description: site.seo.social_description,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/assets/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
};

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: site.business_name,
    url,
    areaServed: site.service_area,
    founder: site.owner_name,
    description: site.seo.description,
    priceRange: site.price,
    email: site.email,
    telephone: site.phone,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <GatewayHome site={site} />
    </>
  );
}
