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
  title: `ONEDECORE — Interiors & Furniture for Complete Homes in Pune`,
  description:
    "ONEDECORE brings complete home interiors, modular design and execution, and furniture discovery together under one home-focused brand in Pune.",
  alternates: { canonical: SITE_CONFIG.url },
  robots: { index: true, follow: true },
  openGraph: {
    title: `ONEDECORE — Interiors & Furniture for Complete Homes in Pune`,
    description:
      "ONEDECORE brings complete home interiors, modular design and execution, and furniture discovery together under one home-focused brand in Pune.",
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

/** Three curated projects: proof for the interiors path, not a contact sheet. */
async function loadPortfolioPreview(): Promise<readonly PublicPortfolioCard[]> {
  try {
    const featured = await getFeaturedProjects();
    return featured.slice(0, 3);
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
