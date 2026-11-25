import type { NextConfig } from "next";

const pagesExport = process.env.PAGES_EXPORT === "1";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const noStoreHeader = { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" };

const nextConfig: NextConfig = {
  ...(pagesExport
    ? {
        output: "export" as const,
        basePath: "/gateway-web-co",
        assetPrefix: "/gateway-web-co",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        cacheComponents: true,
        partialPrefetching: true,
        serverExternalPackages: ["pdfkit", "pg"],
        async headers() {
          return [
            { source: "/:path*", headers: securityHeaders },
            { source: "/api/health", headers: [noStoreHeader] },
            { source: "/api/checkout/:path*", headers: [noStoreHeader] },
            { source: "/checkout/:path*", headers: [noStoreHeader] },
            { source: "/check", headers: [noStoreHeader] },
            { source: "/", headers: [noStoreHeader] },
          ];
        },
      }),
  // The dev server allows localhost and 0.0.0.0. Browsers that open 127.0.0.1
  // are a different host, and Next blocks their scripts unless we allow it.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
