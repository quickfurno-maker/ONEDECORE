import type { NextConfig } from "next";

import { buildSecurityHeaders } from "./src/config/http-security.ts";

/*
 * The header set is decided in `src/config/http-security.ts`, a pure module the
 * test suite can assert against directly. This file only supplies the one fact
 * it cannot know: whether this is a production build.
 *
 * `next dev` gets the four baseline headers and no CSP — an enforced policy
 * breaks HMR, and the usual development escape hatch (`'unsafe-eval'`) is the
 * kind of thing that ships by accident. There is no development policy to leak.
 */
const securityHeaders = buildSecurityHeaders({
  isProduction: process.env.NODE_ENV === "production",
});

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lpurlfmpvriyvpkujvyl.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/portfolio-public/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "lpurlfmpvriyvpkujvyl.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/commerce-product-public/**",
        search: "",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/portfolio-public/**",
        search: "",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/commerce-product-public/**",
        search: "",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/storage/v1/object/public/portfolio-public/**",
        search: "",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/storage/v1/object/public/commerce-product-public/**",
        search: "",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
