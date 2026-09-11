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
    /*
     * DEVELOPMENT ONLY, AND NEVER TRUE IN A PRODUCTION BUILD.
     *
     * Next 16 refuses to optimize an upstream image whose hostname resolves to
     * a private IP, which is the right default: an open image optimizer that
     * will fetch `127.0.0.1` is an SSRF primitive.
     *
     * Local Supabase serves the Website Manager's banner bucket from
     * `http://127.0.0.1:54321`, so with the default the slider cannot be seen
     * working on a developer machine at all — every CMS banner returns 400 and
     * the homepage looks broken in exactly the way this flag is meant to
     * prevent someone shipping.
     *
     * The expression is the guard. `next build` sets NODE_ENV=production, so a
     * production bundle always gets `false`; there is no environment variable a
     * deployment could set to flip it on, and the production banner host
     * (`lpurlfmpvriyvpkujvyl.supabase.co`) is public anyway and never needed it.
     */
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
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
      /*
       * THE WEBSITE MANAGER'S BANNER BUCKET.
       *
       * This was missing, and its absence was invisible until a banner
       * actually had artwork. `next/image` refuses a remote host that is not
       * listed here, so every creative uploaded through the admin would have
       * rendered as a broken image on the live homepage while the admin's own
       * preview — which builds a plain <img> — looked perfectly fine.
       *
       * Nothing caught it because the six slots had been empty since the CMS
       * shipped: the rail was drawing placeholder frames, and a placeholder
       * frame does not ask `next/image` for anything.
       *
       * Mirrors the two buckets above exactly: the production project host
       * plus both local Supabase hostnames.
       */
      {
        protocol: "https",
        hostname: "lpurlfmpvriyvpkujvyl.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/website-banners/**",
        search: "",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/website-banners/**",
        search: "",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/storage/v1/object/public/website-banners/**",
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
