import { MetadataRoute } from "next";
import { getSitemapEntries } from "@/features/portfolio/public/public-portfolio-cache";
import { getPublicCommerceSitemap } from "@/features/commerce/public/public-cache";
import { isPublicCommerceReadFailure } from "@/features/commerce/public/public-errors";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";

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
      url: absoluteUrl("interiors"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("portfolio"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("shop"),
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.85,
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

  try {
    const commerce = await getPublicCommerceSitemap();
    for (const entry of commerce.categories) {
      routes.push({
        url: absoluteUrl(`shop/c/${entry.slug}`),
        lastModified: entry.updatedAt ? new Date(entry.updatedAt) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
    for (const entry of commerce.products) {
      routes.push({
        url: absoluteUrl(`shop/product/${entry.slug}`),
        lastModified: entry.updatedAt ? new Date(entry.updatedAt) : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch (error) {
    if (!isPublicCommerceReadFailure(error)) {
      throw error;
    }
    // Keep /shop and portfolio entries. Do not invent category/product URLs.
  }

  return routes;
}
