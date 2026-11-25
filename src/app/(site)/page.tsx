import type { Metadata } from "next";

import { GatewayHome } from "@/components/gateway-home";
import { getSite } from "@/lib/site";

const site = getSite();

export const metadata: Metadata = {
  title: site.seo.title,
  description: site.seo.description,
  applicationName: site.business_name,
  openGraph: {
    title: site.seo.social_title,
    description: site.seo.social_description,
    siteName: site.business_name,
    type: "website",
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
