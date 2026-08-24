import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { ShopPincodeChecker } from "@/features/commerce/public/components/ShopPincodeChecker";
import { ShopProductCard } from "@/features/commerce/public/components/ShopProductCard";
import { ShopRecentlyViewedList } from "@/features/commerce/public/components/ShopWishlistButton";
import { isPublicCommerceReadFailure } from "@/features/commerce/public/public-errors";
import { getPublicCommerceCategories, getPublicCommerceProducts } from "@/features/commerce/public/public-cache";
import type { PublicCommerceCategory } from "@/features/commerce/public/public-types";
import type { PublicCommerceProductPage } from "@/features/commerce/public/public-types";
import { shopOpenGraph } from "@/features/commerce/public/shop-seo";

const SHOP_TITLE = `Furniture Shop — ${SITE_CONFIG.name}`;
const SHOP_DESCRIPTION =
  "Browse ONEDECORE ready-made furniture. GST-inclusive prices. Add to cart and checkout with cash on delivery.";

export const metadata: Metadata = {
  title: SHOP_TITLE,
  description: SHOP_DESCRIPTION,
  alternates: { canonical: absoluteUrl("shop") },
  robots: { index: true, follow: true },
  openGraph: shopOpenGraph({
    title: SHOP_TITLE,
    description: SHOP_DESCRIPTION,
    url: absoluteUrl("shop"),
  }),
};

async function loadShopHome(): Promise<
  | { ok: true; categories: PublicCommerceCategory[]; featured: PublicCommerceProductPage; newest: PublicCommerceProductPage }
  | { ok: false }
> {
  try {
    const [categories, featured, newest] = await Promise.all([
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
      getPublicCommerceProducts({
        categorySlug: null,
        query: null,
        sort: "newest",
        minPricePaise: null,
        maxPricePaise: null,
        availabilityMode: null,
        featuredOnly: false,
        limit: 8,
        offset: 0,
      }),
    ]);
    return { ok: true, categories, featured, newest };
  } catch (error) {
    if (isPublicCommerceReadFailure(error)) {
      return { ok: false };
    }
    throw error;
  }
}

export default async function ShopPage() {
  const loaded = await loadShopHome();
  if (!loaded.ok) {
    return (
      <main className="od-shop">
        <div className="od-shop__error" role="alert">
          The furniture catalogue is temporarily unavailable. Please try again shortly.
        </div>
      </main>
    );
  }

  const roots = loaded.categories.filter((row) => row.isRoot);

  return (
    <main className="od-shop">
      <header className="od-shop__hero">
        <p className="od-shop__kicker">Ready-made furniture</p>
        <h1>Shop furniture, prepared with the same care as our interiors.</h1>
        <p className="od-shop__lede">
          GST-inclusive prices. Browse published pieces and checkout with cash on delivery.
        </p>
      </header>

      <section className="od-shop__section" aria-labelledby="shop-cats">
        <h2 id="shop-cats">Furniture categories</h2>
        {roots.length === 0 ? (
          <p className="od-shop__empty">Categories are being prepared.</p>
        ) : (
          <div className="od-shop__cats">
            {roots.map((row) => (
              <Link key={row.slug} href={`/shop/c/${row.slug}`} className="od-shop__cat">
                {row.name}
                {row.shortDescription ? <span>{row.shortDescription}</span> : null}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="od-shop__section" aria-labelledby="shop-featured">
        <h2 id="shop-featured">Featured furniture</h2>
        {loaded.featured.items.length === 0 ? (
          <p className="od-shop__empty">
            The collection is being prepared. Published featured pieces will appear here.
          </p>
        ) : (
          <div className="od-shop__grid">
            {loaded.featured.items.map((card) => (
              <ShopProductCard key={card.slug} card={card} />
            ))}
          </div>
        )}
      </section>

      <section className="od-shop__section" aria-labelledby="shop-discover">
        <h2 id="shop-discover">Discover</h2>
        {loaded.newest.items.length === 0 ? (
          <p className="od-shop__empty">No published products are available to browse yet.</p>
        ) : (
          <div className="od-shop__grid">
            {loaded.newest.items.map((card) => (
              <ShopProductCard key={card.slug} card={card} />
            ))}
          </div>
        )}
        <p>
          <Link href="/shop/search">Search furniture</Link>
        </p>
      </section>

      <section className="od-shop__section" aria-labelledby="shop-pin">
        <h2 id="shop-pin">Pincode check</h2>
        <ShopPincodeChecker />
      </section>

      <section className="od-shop__section od-shop-trust" aria-labelledby="shop-trust">
        <h2 id="shop-trust">Why buy furniture from ONEDECORE</h2>
        <p>One brand for complete interiors and ready-made furniture. GST-inclusive display.</p>
        <p>Made-to-order and ready-stock labels come from the catalogue, not invented urgency.</p>
      </section>

      <ShopRecentlyViewedList />

      <section className="od-shop__section" aria-labelledby="shop-interiors">
        <h2 id="shop-interiors">Planning a complete home?</h2>
        <p>
          Interiors and modular kitchens live on a dedicated conversion path. Furniture browsing
          does not create a CRM lead.
        </p>
        <p>
          <Link href="/interiors">Explore interiors</Link>
          {" · "}
          See finished homes in our <Link href="/portfolio">portfolio</Link>.
        </p>
      </section>
    </main>
  );
}
