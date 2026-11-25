import type { NextConfig } from "next";

const pagesExport = process.env.PAGES_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(pagesExport
    ? {
        output: "export",
        basePath: "/gateway-web-co",
        assetPrefix: "/gateway-web-co",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        cacheComponents: true,
        partialPrefetching: true,
        serverExternalPackages: ["pdfkit", "pg"],
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
