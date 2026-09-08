import type { Metadata } from "next";
import { SITE_CONFIG } from "@/config/site";
import { isPublicCommerceReadFailure } from "@/features/commerce/public/public-errors";
import {
  getPublicCommerceCategories,
  getPublicCommerceProducts,
} from "@/features/commerce/public/public-cache";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";
import { getFeaturedProjects } from "@/features/portfolio/public/public-portfolio-cache";
import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import {
  DiscoveryHomePage,
  type DiscoveryCommerceState,
} from "@/features/public-site/discovery/DiscoveryHomePage";

/**
 * Public marketing HTML must not be cacheable for a year by a shared cache.
 *
 * Next.js requires this to be a literal: a route segment config is read by
 * static analysis rather than by running the module, so an imported constant is
 * rejected outright. The decision therefore lives in
 * `PUBLIC_HTML_REVALIDATE_SECONDS` and a test asserts every public page's
 * literal still equals it. See `src/config/public-cache.ts`.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: `ONEDECORE — Home Interiors, Modular Kitchens & Wardrobes in Pune`,
  description:
    "ONEDECORE designs and delivers complete home interiors, modular kitchens and custom wardrobes across Pune — from consultation to installation.",
  alternates: { canonical: SITE_CONFIG.url },
  robots: { index: true, follow: true },
  openGraph: {
    title: `ONEDECORE — Home Interiors, Modular Kitchens & Wardrobes in Pune`,
    description:
      "ONEDECORE designs and delivers complete home interiors, modular kitchens and custom wardrobes across Pune — from consultation to installation.",
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    locale: SITE_CONFIG.locale,
    type: "website",
  },
};

async function loadDiscoveryCommerce(): Promise<DiscoveryCommerceState> {
  if (!isShopPublicEnabled()) {
    return { ok: false };
  }

  try {
    const [categories, featured] = await Promise.all([
      getPublicCommerceCategories(),
      getPublicCommerceProducts({
        categorySlug: null,
        query: null,
        sort: "featured",
        minPricePaise: null,
        maxPricePaise: null,
        availabilityMode: null,
        featuredOnly: true,
        limit: 8,
        offset: 0,
      }),
    ]);
    return { ok: true, categories, featured: featured.items };
  } catch (error) {
    if (isPublicCommerceReadFailure(error)) {
      return { ok: false };
    }
    throw error;
  }
}

async function loadPortfolioPreview(): Promise<readonly PublicPortfolioCard[]> {
  try {
    const featured = await getFeaturedProjects();
    return featured.slice(0, 6);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [commerce, portfolioPreview] = await Promise.all([
    loadDiscoveryCommerce(),
    loadPortfolioPreview(),
  ]);

  return (
    <div className={publicSiteFontVariables}>
      <DiscoveryHomePage
        commerce={commerce}
        portfolioPreview={portfolioPreview}
      />
    </div>
  );
}
