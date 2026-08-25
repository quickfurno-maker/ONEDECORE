import type { Metadata } from "next";
import { SITE_CONFIG } from "@/config/site";
import { isPublicCommerceReadFailure } from "@/features/commerce/public/public-errors";
import {
  getPublicCommerceCategories,
  getPublicCommerceProducts,
} from "@/features/commerce/public/public-cache";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";
import { publicSiteFontVariables } from "@/features/public-site/fonts";
import {
  DiscoveryHomePage,
  type DiscoveryCommerceState,
} from "@/features/public-site/discovery/DiscoveryHomePage";

export const metadata: Metadata = {
  title: `ONEDECORE — Interiors, Modular Kitchens & Furniture in Pune`,
  description:
    "ONEDECORE is a complete-home brand in Pune for interiors, modular kitchens, and furniture. Design the home, then furnish it with the same team.",
  alternates: { canonical: SITE_CONFIG.url },
  robots: { index: true, follow: true },
  openGraph: {
    title: `ONEDECORE — Interiors, Modular Kitchens & Furniture in Pune`,
    description:
      "ONEDECORE is a complete-home brand in Pune for interiors, modular kitchens, and furniture. Design the home, then furnish it with the same team.",
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

export default async function HomePage() {
  const commerce = await loadDiscoveryCommerce();
  return (
    <div className={publicSiteFontVariables}>
      <DiscoveryHomePage commerce={commerce} />
    </div>
  );
}
