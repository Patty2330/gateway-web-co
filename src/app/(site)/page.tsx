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
  },
  twitter: {
    card: "summary_large_image",
    title: site.seo.social_title,
    description: site.seo.social_description,
  },
  icons: { icon: "/assets/favicon.svg" },
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
