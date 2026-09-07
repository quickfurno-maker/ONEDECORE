import { MetadataRoute } from "next";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        /*
         * `/manager` redirects rather than renders, and `/q/` is a customer's
         * own quotation behind a capability token. Neither is a page a crawler
         * has any business fetching, and a redirect chain in an index is a
         * crawl budget spent on nothing.
         */
        disallow: ["/admin/", "/api/admin/", "/auth/", "/manager/", "/q/"],
      },
    ],
    sitemap: absoluteUrl("sitemap.xml"),
    host: SITE_CONFIG.url,
  };
}
