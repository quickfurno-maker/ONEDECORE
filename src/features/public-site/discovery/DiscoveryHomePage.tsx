import Image from "next/image";
import Link from "next/link";
import { ShopPincodeChecker } from "@/features/commerce/public/components/ShopPincodeChecker";
import { ShopProductCard } from "@/features/commerce/public/components/ShopProductCard";
import type { PublicCommerceCategory } from "@/features/commerce/public/public-types";
import type { PublicCommerceProductCard } from "@/features/commerce/public/public-types";
import { PublicSiteFooter } from "@/features/public-site/chrome/PublicSiteFooter";
import { PublicSiteHeader } from "@/features/public-site/chrome/PublicSiteHeader";
import { PM_ASSETS } from "@/features/public-site/home-r4/content";
import { HOME_CLAIMS } from "@/features/public-site/home-r4/claims";
import {
  DISCOVERY_INTERIOR_PREVIEWS,
  DISCOVERY_SECTION_ORDER,
  DISCOVERY_TRUST_LABELS,
} from "./discovery-copy";
import "./discovery.css";
import "@/features/commerce/public/shop.css";

export type DiscoveryCommerceState =
  | {
      readonly ok: true;
      readonly categories: readonly PublicCommerceCategory[];
      readonly featured: readonly PublicCommerceProductCard[];
    }
  | { readonly ok: false };

export function DiscoveryHomePage({
  commerce,
}: {
  readonly commerce: DiscoveryCommerceState;
}) {
  const roots = commerce.ok
    ? commerce.categories
        .filter((row) => row.isRoot)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, 6)
    : [];
  const featured = commerce.ok ? commerce.featured.slice(0, 8) : [];

  return (
    <div className="od-discovery" data-public-dark-theme="" data-od-discovery="">
      <div data-od-discovery-order={DISCOVERY_SECTION_ORDER.join("|")} hidden />
      <a className="od-skip" href="#od-discovery-main">
        Skip to content
      </a>
      <PublicSiteHeader current="home" />
      <main id="od-discovery-main">
        <section className="od-disc-hero" aria-labelledby="od-disc-hero-title">
          <div className="od-disc-hero__media" aria-hidden="true">
            <Image
              src={PM_ASSETS.hero.path}
              alt=""
              fill
              priority
              sizes="100vw"
              style={{ objectPosition: PM_ASSETS.hero.focalPoint }}
            />
          </div>
          <div className="od-disc-hero__copy">
            <p className="od-disc-kicker">ONE VISION. COMPLETE INTERIORS.</p>
            <h1 id="od-disc-hero-title">One complete home. Designed and furnished together.</h1>
            <p>
              ONEDECORE plans interiors, modular kitchens, and furniture for homes in Pune —
              one team, one standard.
            </p>
            <div className="od-disc-hero__ctas">
              <Link href="/interiors" className="od-disc-btn od-disc-btn--primary">
                Design My Home
              </Link>
              <Link href="/shop" className="od-disc-btn od-disc-btn--ghost">
                Shop Furniture
              </Link>
            </div>
          </div>
        </section>

        <section className="od-disc-section" aria-labelledby="od-disc-journeys-title">
          <h2 id="od-disc-journeys-title">How would you like to begin?</h2>
          <div className="od-disc-journeys">
            <article>
              <h3>Plan Your Home</h3>
              <ul>
                <li>Full Home Interiors</li>
                <li>Modular Kitchens</li>
                <li>Wardrobes</li>
                <li>Renovation</li>
              </ul>
              <Link href="/interiors">Explore Interior Services</Link>
            </article>
            <article>
              <h3>Shop Your Home</h3>
              <ul>
                {roots.length > 0 ? (
                  roots.map((row) => <li key={row.slug}>{row.name}</li>)
                ) : (
                  <>
                    <li>Ready-made furniture</li>
                    <li>Browse published pieces</li>
                  </>
                )}
              </ul>
              <Link href="/shop">Shop Furniture</Link>
            </article>
          </div>
        </section>

        <section className="od-disc-section od-disc-trust" aria-label="ONEDECORE capabilities">
          <ul>
            {DISCOVERY_TRUST_LABELS.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </section>

        <section className="od-disc-section" aria-labelledby="od-disc-int-title">
          <h2 id="od-disc-int-title">Spaces designed around your life.</h2>
          <div className="od-disc-preview">
            {DISCOVERY_INTERIOR_PREVIEWS.map((item) => (
              <Link key={item.title} href={item.href}>
                {item.title}
              </Link>
            ))}
          </div>
          <p>
            <Link href="/interiors">Explore Interiors</Link>
          </p>
        </section>

        <section className="od-disc-section" aria-labelledby="od-disc-cats-title">
          <h2 id="od-disc-cats-title">Furniture made for complete homes.</h2>
          {!commerce.ok ? (
            <p className="od-disc-error" role="alert">
              Furniture categories are temporarily unavailable. Please try again shortly.
            </p>
          ) : roots.length === 0 ? (
            <p className="od-disc-empty">
              Furniture categories are being prepared.
              <Link href="/shop"> Shop Furniture</Link>
            </p>
          ) : (
            <div className={`od-disc-cats ${roots.length === 1 ? "od-disc-cats--one" : ""}`}>
              {roots.map((row) => (
                <Link key={row.slug} href={`/shop/c/${row.slug}`} className="od-disc-cat">
                  <strong>{row.name}</strong>
                  {row.shortDescription ? <span>{row.shortDescription}</span> : null}
                </Link>
              ))}
            </div>
          )}
          <p>
            <Link href="/shop">Explore Furniture</Link>
          </p>
        </section>

        <section className="od-disc-section od-disc-bridge" aria-labelledby="od-disc-bridge-title">
          <h2 id="od-disc-bridge-title">Design it / Furnish it.</h2>
          <p>ONEDECORE can design the home and furnish it as one complete look.</p>
        </section>

        <section className="od-disc-section od-disc-kitchen" aria-labelledby="od-disc-kit-title">
          <div>
            <p className="od-disc-kicker">Modular kitchens</p>
            <h2 id="od-disc-kit-title">Custom layouts, finished with factory precision</h2>
            <p>Smart storage and end-to-end installation, kept with the interior plan.</p>
            <Link href="/interiors#modular-kitchen">Explore Kitchens</Link>
          </div>
          <figure>
            <Image
              src={PM_ASSETS.modularKitchens.path}
              alt={PM_ASSETS.modularKitchens.alt}
              width={PM_ASSETS.modularKitchens.width}
              height={PM_ASSETS.modularKitchens.height}
              sizes="(max-width: 800px) 100vw, 48vw"
            />
          </figure>
        </section>

        <section className="od-disc-section" aria-labelledby="od-disc-feat-title">
          <h2 id="od-disc-feat-title">Featured furniture</h2>
          {!commerce.ok ? (
            <p className="od-disc-error" role="alert">
              Featured furniture is temporarily unavailable. Please try again shortly.
            </p>
          ) : featured.length === 0 ? (
            <p className="od-disc-empty">
              Our furniture collection is being prepared.
              <Link href="/shop"> Explore Furniture</Link>
            </p>
          ) : (
            <div className="od-disc-featured od-shop__grid">
              {featured.map((card) => (
                <ShopProductCard key={card.slug} card={card} showWishlist={false} />
              ))}
            </div>
          )}
          {featured.length > 0 ? (
            <p className="od-disc-viewall">
              <Link href="/shop">View All</Link>
            </p>
          ) : null}
        </section>

        <section className="od-disc-section" aria-labelledby="od-disc-homes-title">
          <h2 id="od-disc-homes-title">Real homes. The complete ONEDECORE look.</h2>
          <p>
            See finished interiors on the portfolio. Showcased homes are not claimed as product
            placements unless that link exists.
          </p>
          <Link href="/portfolio">View Portfolio</Link>
        </section>

        <section id="about" className="od-disc-section" aria-labelledby="od-disc-why-title">
          <h2 id="od-disc-why-title">Why ONEDECORE</h2>
          <p>One team. One standard. One complete home.</p>
          <ul className="od-disc-why">
            <li>Interiors, kitchens, and furniture under one brand</li>
            <li>In-house manufacturing for custom work</li>
            <li>Quality control through design, make, and install</li>
          </ul>
        </section>

        <section className="od-disc-section" aria-labelledby="od-disc-process-title">
          <h2 id="od-disc-process-title">Two ways we work with you</h2>
          <div className="od-disc-process">
            <article>
              <h3>Design</h3>
              <p>Consult → Design → Manufacture → Install</p>
            </article>
            <article>
              <h3>Furniture</h3>
              <p>Browse → Explore Details → Check Serviceability</p>
            </article>
          </div>
        </section>

        <section className="od-disc-section" aria-labelledby="od-disc-pin-title">
          <h2 id="od-disc-pin-title">Furniture pincode check</h2>
          <ShopPincodeChecker />
        </section>

        <section className="od-disc-section" aria-labelledby="od-disc-rev-title">
          <h2 id="od-disc-rev-title">Client experience</h2>
          <p>
            Homeowners work with ONEDECORE on interiors across Pune. These are interior and
            project experiences — not furniture product reviews.
          </p>
          <p className="od-disc-review-note">
            Average client rating {HOME_CLAIMS.rating}/5 from approved interior project feedback.
          </p>
        </section>

        <section className="od-disc-section od-disc-final" aria-labelledby="od-disc-final-title">
          <h2 id="od-disc-final-title">Design your home. Furnish it beautifully.</h2>
          <div className="od-disc-hero__ctas">
            <Link href="/interiors#consultation" className="od-disc-btn od-disc-btn--primary">
              Book Free Consultation
            </Link>
            <Link href="/shop" className="od-disc-btn od-disc-btn--ghost">
              Shop Furniture
            </Link>
          </div>
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
