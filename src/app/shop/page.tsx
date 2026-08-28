import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import { ShopPincodeChecker } from "@/features/commerce/public/components/ShopPincodeChecker";
import { ShopProductCard } from "@/features/commerce/public/components/ShopProductCard";
import { ShopRecentlyViewedList } from "@/features/commerce/public/components/ShopWishlistButton";
import { isPublicCommerceReadFailure } from "@/features/commerce/public/public-errors";
import { getPublicCommerceCategories, getPublicCommerceProducts } from "@/features/commerce/public/public-cache";
import type { PublicCommerceCategory } from "@/features/commerce/public/public-types";
import type { PublicCommerceProductCard, PublicCommerceProductPage } from "@/features/commerce/public/public-types";
import { buildCommercePublicUrl } from "@/features/commerce/public/public-url";
import { shopOpenGraph } from "@/features/commerce/public/shop-seo";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";

const SHOP_TITLE = `Furniture Shop — ${SITE_CONFIG.name}`;
const SHOP_DESCRIPTION =
  "Browse ONEDECORE ready-made furniture. GST-inclusive prices. Add to cart and checkout with cash on delivery.";

export async function generateMetadata(): Promise<Metadata> {
  if (!isShopPublicEnabled()) {
    return {
      title: "Furniture shop — ONEDECORE",
      robots: { index: false, follow: false },
    };
  }
  return {
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
}

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

/** Merchandising panel built only from a real published product. */
function HeroPanel({
  product,
  eyebrow,
  variant,
  priority,
}: {
  readonly product: PublicCommerceProductCard;
  readonly eyebrow: string;
  readonly variant: "feature" | "support";
  readonly priority: boolean;
}) {
  const imageUrl = buildCommercePublicUrl(product.primaryImagePath);
  return (
    <Link
      href={`/shop/product/${product.slug}`}
      className={`odc-hero__panel odc-hero__panel--${variant}`}
    >
      <div className="odc-hero__media">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.primaryImageAlt || product.name}
            fill
            priority={priority}
            sizes={variant === "feature" ? "(max-width: 900px) 100vw, 62vw" : "(max-width: 900px) 100vw, 32vw"}
          />
        ) : (
          <div className="odc-hero__mediaFallback" aria-hidden="true" />
        )}
      </div>
      <div className="odc-hero__overlay">
        <p className="odc-hero__eyebrow">{eyebrow}</p>
        <p className="odc-hero__title">{product.name}</p>
        <p className="odc-hero__meta">
          {formatInrFromPaise(product.startingPricePaise)}
          <span className="odc-hero__metaNote"> · GST inclusive</span>
        </p>
        <span className="odc-hero__cta">
          View product<span aria-hidden="true"> →</span>
        </span>
      </div>
    </Link>
  );
}

function ProductRail({
  id,
  title,
  lede,
  items,
  emptyCopy,
  moreHref,
  moreLabel,
}: {
  readonly id: string;
  readonly title: string;
  readonly lede?: string;
  readonly items: readonly PublicCommerceProductCard[];
  readonly emptyCopy: string;
  readonly moreHref?: string;
  readonly moreLabel?: string;
}) {
  return (
    <section className="odc-band" aria-labelledby={id}>
      <div className="odc-band__inner">
        <header className="odc-band__head">
          <div>
            <h2 id={id} className="odc-band__title">
              {title}
            </h2>
            {lede ? <p className="odc-band__lede">{lede}</p> : null}
          </div>
          {moreHref && moreLabel && items.length > 0 ? (
            <Link href={moreHref} className="odc-band__more">
              {moreLabel}
              <span aria-hidden="true"> →</span>
            </Link>
          ) : null}
        </header>
        {items.length === 0 ? (
          <p className="od-shop__empty">{emptyCopy}</p>
        ) : (
          <div className="od-shop__grid">
            {items.map((card) => (
              <ShopProductCard key={card.slug} card={card} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default async function ShopPage() {
  // Fail closed before any catalogue read. The layout renders the inactive
  // boundary in place of these children while the gate is off.
  if (!isShopPublicEnabled()) {
    return null;
  }

  const loaded = await loadShopHome();
  if (!loaded.ok) {
    return (
      <main className="od-shop odc-retail">
        <h1 className="odc-retail__h1">Furniture for Pune homes</h1>
        <div className="odc-listing__body">
          <div className="od-shop__error" role="alert">
            The furniture catalogue is temporarily unavailable. Please try again shortly.
          </div>
        </div>
      </main>
    );
  }

  const roots = loaded.categories.filter((row) => row.isRoot);
  const featuredItems = loaded.featured.items;
  const newestItems = loaded.newest.items;

  // Hero merchandising is drawn from published products only. With no products
  // the mosaic is replaced by a typographic panel rather than invented imagery.
  const heroFeature = featuredItems[0] ?? newestItems[0] ?? null;
  const heroSupport = [featuredItems[1] ?? null, newestItems.find((row) => row.slug !== heroFeature?.slug) ?? null]
    .filter((row): row is PublicCommerceProductCard => row !== null)
    .filter((row, index, list) => list.findIndex((other) => other.slug === row.slug) === index)
    .slice(0, 2);

  return (
    <main className="od-shop odc-retail">
      <h1 className="odc-retail__h1">Furniture for Pune homes</h1>

      <section className="odc-hero" aria-label="Featured furniture">
        {heroFeature ? (
          <div className="odc-hero__mosaic">
            <HeroPanel product={heroFeature} eyebrow="Featured piece" variant="feature" priority />
            <div className="odc-hero__side">
              {heroSupport.map((product, index) => (
                <HeroPanel
                  key={product.slug}
                  product={product}
                  eyebrow={index === 0 ? "ONEDECORE picks" : "New arrival"}
                  variant="support"
                  priority={false}
                />
              ))}
              {heroSupport.length === 0 ? (
                <div className="odc-hero__panel odc-hero__panel--note">
                  <p className="odc-hero__eyebrow">Crafted for everyday living</p>
                  <p className="odc-hero__noteCopy">
                    Ready-made furniture finished to the same standard as our interior projects.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="odc-hero__intro">
            <p className="odc-hero__eyebrow">Made for Pune homes</p>
            <p className="odc-hero__introTitle">
              Furniture, prepared with the same care as our interiors.
            </p>
            <p className="odc-hero__introLede">
              The collection is being prepared. Published pieces will appear here with
              GST-inclusive pricing and cash on delivery.
            </p>
          </div>
        )}
      </section>

      <section className="odc-band odc-band--tint" aria-labelledby="shop-cats">
        <div className="odc-band__inner">
          <header className="odc-band__head">
            <div>
              <h2 id="shop-cats" className="odc-band__title">
                Shop by category
              </h2>
              <p className="odc-band__lede">
                Every category below is published from the ONEDECORE catalogue.
              </p>
            </div>
          </header>
          {roots.length === 0 ? (
            <p className="od-shop__empty">Categories are being prepared.</p>
          ) : (
            <div className="odc-cats">
              {roots.map((row) => (
                <Link key={row.slug} href={`/shop/c/${row.slug}`} className="odc-cat">
                  <span className="odc-cat__name">{row.name}</span>
                  {row.shortDescription ? (
                    <span className="odc-cat__desc">{row.shortDescription}</span>
                  ) : null}
                  <span className="odc-cat__arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <ProductRail
        id="shop-featured"
        title="ONEDECORE picks"
        lede="Pieces our design team currently features."
        items={featuredItems.slice(0, 4)}
        emptyCopy="The collection is being prepared. Published featured pieces will appear here."
        moreHref="/shop/search?sort=featured"
        moreLabel="See all featured"
      />

      <section className="odc-editorial" aria-labelledby="shop-editorial">
        <div className="odc-editorial__inner">
          <p className="odc-editorial__eyebrow">One brand, one standard</p>
          <h2 id="shop-editorial" className="odc-editorial__title">
            Furniture finished to interior-project standards.
          </h2>
          <p className="odc-editorial__lede">
            ONEDECORE builds complete home interiors and modular kitchens in its own
            manufacturing unit. The furniture collection is prepared by the same team, to the
            same tolerances.
          </p>
        </div>
      </section>

      <ProductRail
        id="shop-discover"
        title="New arrivals"
        lede="The most recently published pieces in the catalogue."
        items={newestItems}
        emptyCopy="No published products are available to browse yet."
        moreHref="/shop/search?sort=newest"
        moreLabel="Browse everything"
      />

      <ShopRecentlyViewedList />

      <section className="odc-band odc-band--tint" aria-labelledby="shop-pin">
        <div className="odc-band__inner odc-band__inner--split">
          <div>
            <h2 id="shop-pin" className="odc-band__title">
              Check delivery
            </h2>
            <p className="odc-band__lede">
              Enter a pincode to see whether it is on the current service list. Final cash-on-
              delivery availability is confirmed at checkout.
            </p>
          </div>
          <div className="odc-pinbox">
            <ShopPincodeChecker />
          </div>
        </div>
      </section>

      <section className="odc-band" aria-labelledby="shop-trust">
        <div className="odc-band__inner">
          <h2 id="shop-trust" className="odc-band__title">
            Why buy furniture from ONEDECORE
          </h2>
          <ul className="odc-trust">
            <li className="odc-trust__item">
              <span className="odc-trust__title">One brand end to end</span>
              <span className="odc-trust__body">
                Complete interiors and ready-made furniture from a single team.
              </span>
            </li>
            <li className="odc-trust__item">
              <span className="odc-trust__title">GST-inclusive display</span>
              <span className="odc-trust__body">
                Listed prices already include GST. Totals are confirmed on the server at
                checkout.
              </span>
            </li>
            <li className="odc-trust__item">
              <span className="odc-trust__title">Catalogue-backed labels</span>
              <span className="odc-trust__body">
                Made-to-order and ready-stock labels come from the catalogue, not invented
                urgency.
              </span>
            </li>
            <li className="odc-trust__item">
              <span className="odc-trust__title">Cash on delivery</span>
              <span className="odc-trust__body">
                Guest checkout with cash on delivery. No account required.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="odc-bridge" aria-labelledby="shop-interiors">
        <div className="odc-bridge__inner">
          <p className="odc-bridge__eyebrow">Interiors</p>
          <h2 id="shop-interiors" className="odc-bridge__title">
            Planning a complete home?
          </h2>
          <p className="odc-bridge__lede">
            Interiors and modular kitchens are planned on the homepage consultation path.
            Furniture browsing does not create a CRM lead.
          </p>
          <div className="odc-bridge__actions">
            <Link href="/" className="odc-btn odc-btn--primary">
              Explore interiors
            </Link>
            <Link href="/portfolio" className="odc-btn odc-btn--ghost">
              See finished homes
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
