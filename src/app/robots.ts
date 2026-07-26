import { MetadataRoute } from "next";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/admin/", "/auth/"],
      },
    ],
    sitemap: absoluteUrl("sitemap.xml"),
    host: SITE_CONFIG.url,
  };
}
