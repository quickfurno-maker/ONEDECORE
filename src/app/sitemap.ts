import { MetadataRoute } from "next";
import { getSitemapEntries } from "@/features/portfolio/public/public-portfolio-cache";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projectEntries = await getSitemapEntries();

  const routes: MetadataRoute.Sitemap = [
    {
      url: SITE_CONFIG.url,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: absoluteUrl("portfolio"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  for (const entry of projectEntries) {
    routes.push({
      url: absoluteUrl(`portfolio/${entry.slug}`),
      lastModified: entry.lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return routes;
}
