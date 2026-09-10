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
  /*
   * `/interiors` moved to `/`, permanently.
   *
   * The Interiors experience is the homepage now, and it must exist at exactly
   * one URL. Two routes rendering the same page would compete for the same
   * queries and split whatever authority the old path has earned.
   *
   * This is config, not a page, on purpose. Next checks redirects BEFORE the
   * filesystem, so `/interiors` never reaches a component: no render, no
   * flash of content, no `useEffect` bouncing a visitor who has already begun
   * reading. `permanent: true` is a 308 rather than a 301 so the request
   * method survives the hop.
   */
  async redirects() {
    return [
      {
        source: "/interiors",
        destination: "/",
        permanent: true,
      },
    ];
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
