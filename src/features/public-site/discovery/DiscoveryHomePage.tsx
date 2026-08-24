import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShopPincodeChecker } from "@/features/commerce/public/components/ShopPincodeChecker";
import { ShopProductCard } from "@/features/commerce/public/components/ShopProductCard";
import type { PublicCommerceCategory } from "@/features/commerce/public/public-types";
import type { PublicCommerceProductCard } from "@/features/commerce/public/public-types";
import { PublicSiteFooter } from "@/features/public-site/chrome/PublicSiteFooter";
import { PublicSiteHeader } from "@/features/public-site/chrome/PublicSiteHeader";
import { PM_ASSETS } from "@/features/public-site/home-r4/content";
import { HOME_CLAIM_COPY, HOME_CLAIMS } from "@/features/public-site/home-r4/claims";
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

const INTERIOR_VISUALS = [
  {
    title: "Full Home Interiors",
    href: DISCOVERY_INTERIOR_PREVIEWS[0].href,
    asset: PM_ASSETS.completeHomeInteriors,
    size: "large" as const,
  },
  {
    title: "Modular Kitchens",
    href: DISCOVERY_INTERIOR_PREVIEWS[1].href,
    asset: PM_ASSETS.modularKitchens,
    size: "stack" as const,
  },
  {
    title: "Wardrobes",
    href: DISCOVERY_INTERIOR_PREVIEWS[2].href,
    asset: PM_ASSETS.customWardrobes,
    size: "stack" as const,
  },
] as const;

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
  const showPincode = commerce.ok && (roots.length > 0 || featured.length > 0);

  return (
    <div className="od-discovery" data-public-dark-theme="" data-od-discovery="">
      <div data-od-discovery-order={DISCOVERY_SECTION_ORDER.join("|")} hidden />
      <a className="od-skip" href="#od-discovery-main">
        Skip to content
      </a>
      <PublicSiteHeader current="home" />
      <main id="od-discovery-main">
        {/* A — Hero */}
        <section className="od-disc-hero" aria-labelledby="od-disc-hero-title">
          <div
            className="od-disc-hero__media"
            aria-hidden="true"
            style={
              {
                "--od-hero-focal": PM_ASSETS.hero.focalPoint,
                "--od-hero-focal-mobile": PM_ASSETS.hero.mobileFocalPoint,
              } as CSSProperties
            }
          >
            <Image src={PM_ASSETS.hero.path} alt="" fill priority sizes="100vw" />
          </div>
          <div className="od-disc-hero__copy">
            <h1 id="od-disc-hero-title">Design the home. Furnish it beautifully.</h1>
            <p className="od-disc-hero__lede">
              Complete interiors, modular kitchens and furniture — planned with one design
              language and delivered by one team in Pune.
            </p>
            <div className="od-disc-hero__ctas">
              <Link href="/interiors" className="od-disc-btn od-disc-btn--primary">
                Design My Home
              </Link>
              <Link href="/shop" className="od-disc-btn od-disc-btn--ghost">
                Shop Furniture
              </Link>
            </div>
            <ul className="od-disc-proof" aria-label="ONEDECORE at a glance">
              <li>
                <strong>{HOME_CLAIMS.projectsDelivered}+</strong>
                <span>Projects Delivered</span>
              </li>
              <li>
                <strong>{HOME_CLAIMS.rating}/5</strong>
                <span>Average Rating</span>
              </li>
              <li>
                <strong>{HOME_CLAIM_COPY.manufacturing}</strong>
              </li>
            </ul>
          </div>
        </section>

        {/* B — Two starting paths */}
        <section className="od-disc-band" aria-labelledby="od-disc-journeys-title">
          <div className="od-disc-shell">
            <h2 id="od-disc-journeys-title">Start with the way you need us.</h2>
            <div className="od-disc-paths">
              <Link href="/interiors" className="od-disc-path od-disc-path--wide">
                <span className="od-disc-path__media" aria-hidden="true">
                  <Image
                    src={PM_ASSETS.completeHomeInteriors.path}
                    alt=""
                    fill
                    sizes="(max-width: 900px) 100vw, 58vw"
                    style={{ objectPosition: PM_ASSETS.completeHomeInteriors.focalPoint }}
                  />
                </span>
                <span className="od-disc-path__body">
                  <span className="od-disc-path__title">Plan Your Home</span>
                  <span className="od-disc-path__copy">
                    Full-home interiors, modular kitchens, wardrobes and renovation — one
                    continuous plan.
                  </span>
                  <span className="od-disc-path__cta">Explore interiors</span>
                </span>
              </Link>
              <Link href="/shop" className="od-disc-path">
                <span className="od-disc-path__media" aria-hidden="true">
                  <Image
                    src={PM_ASSETS.customWardrobes.path}
                    alt=""
                    fill
                    sizes="(max-width: 900px) 100vw, 42vw"
                    style={{ objectPosition: PM_ASSETS.customWardrobes.focalPoint }}
                  />
                </span>
                <span className="od-disc-path__body">
                  <span className="od-disc-path__title">Furnish Your Home</span>
                  <span className="od-disc-path__copy">
                    Ready-made furniture shaped to sit with the same design language.
                  </span>
                  <span className="od-disc-path__cta">Shop furniture</span>
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* C — Trust strip */}
        <section className="od-disc-trust" aria-label="ONEDECORE capabilities">
          <div className="od-disc-shell">
            <ul>
              {DISCOVERY_TRUST_LABELS.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* D — Interiors visual story */}
        <section className="od-disc-band" aria-labelledby="od-disc-int-title">
          <div className="od-disc-shell">
            <header className="od-disc-band__head">
              <h2 id="od-disc-int-title">Spaces designed as one complete home.</h2>
              <p className="od-disc-lede">
                Interiors, kitchens and storage planned together — not as separate purchases.
              </p>
            </header>
            <div className="od-disc-gallery">
              {INTERIOR_VISUALS.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className={`od-disc-tile od-disc-tile--${item.size}`}
                >
                  <span className="od-disc-tile__media" aria-hidden="true">
                    <Image
                      src={item.asset.path}
                      alt=""
                      fill
                      sizes={
                        item.size === "large"
                          ? "(max-width: 900px) 100vw, 62vw"
                          : "(max-width: 900px) 100vw, 36vw"
                      }
                      style={{ objectPosition: item.asset.focalPoint }}
                    />
                  </span>
                  <span className="od-disc-tile__label">{item.title}</span>
                </Link>
              ))}
            </div>
            <p className="od-disc-inline-cta">
              <Link href="/interiors" className="od-disc-text-link">
                Explore Interiors
              </Link>
            </p>
          </div>
        </section>

        {/* E — Signature bridge */}
        <section className="od-disc-bridge" aria-labelledby="od-disc-bridge-title">
          <div className="od-disc-bridge__media" aria-hidden="true">
            <Image
              src={PM_ASSETS.materialTexture.path}
              alt=""
              fill
              sizes="100vw"
              style={{ objectPosition: PM_ASSETS.materialTexture.focalPoint }}
            />
          </div>
          <div className="od-disc-shell od-disc-bridge__copy">
            <h2 id="od-disc-bridge-title">Design it. Furnish it. Keep it one complete look.</h2>
            <p>
              ONEDECORE brings planning, manufacturing and furnishing together so the home feels
              intentional from the first drawing to the final piece.
            </p>
          </div>
        </section>

        {/* F — Modular kitchen */}
        <section className="od-disc-band od-disc-kitchen" aria-labelledby="od-disc-kit-title">
          <div className="od-disc-shell od-disc-kitchen__grid">
            <figure className="od-disc-kitchen__figure">
              <Image
                src={PM_ASSETS.modularKitchens.path}
                alt={PM_ASSETS.modularKitchens.alt}
                width={PM_ASSETS.modularKitchens.width}
                height={PM_ASSETS.modularKitchens.height}
                sizes="(max-width: 900px) 100vw, 52vw"
              />
            </figure>
            <div className="od-disc-kitchen__copy">
              <p className="od-disc-kicker">Modular kitchens</p>
              <h2 id="od-disc-kit-title">Layouts finished with factory precision</h2>
              <p className="od-disc-lede">
                Storage, finishes and install kept inside the same interior plan — not a separate
                kitchen package.
              </p>
              <Link href="/interiors#modular-kitchen" className="od-disc-btn od-disc-btn--ghost">
                Explore Kitchens
              </Link>
            </div>
          </div>
        </section>

        {/* G — Furniture / commerce (fail-closed graceful) */}
        <section className="od-disc-band" aria-labelledby="od-disc-furn-title">
          <div className="od-disc-shell">
            <header className="od-disc-band__head">
              <h2 id="od-disc-furn-title">Furniture made for complete homes.</h2>
            </header>

            {!commerce.ok || (roots.length === 0 && featured.length === 0) ? (
              <div className="od-disc-teaser">
                <p>The ONEDECORE furniture collection is being prepared.</p>
                <p className="od-disc-teaser__note">
                  Interiors consultation is available now while we prepare the furniture
                  collection.
                </p>
                <Link href="/shop" className="od-disc-text-link">
                  Visit the furniture shop
                </Link>
              </div>
            ) : (
              <>
                {roots.length > 0 ? (
                  <div
                    className={`od-disc-cats ${roots.length === 1 ? "od-disc-cats--one" : ""}`}
                  >
                    {roots.map((row) => (
                      <Link key={row.slug} href={`/shop/c/${row.slug}`} className="od-disc-cat">
                        <strong>{row.name}</strong>
                        {row.shortDescription ? <span>{row.shortDescription}</span> : null}
                      </Link>
                    ))}
                  </div>
                ) : null}

                {featured.length > 0 ? (
                  <>
                    <h3 className="od-disc-subhead">Featured furniture</h3>
                    <div className="od-disc-featured od-shop__grid">
                      {featured.map((card) => (
                        <ShopProductCard key={card.slug} card={card} showWishlist={false} />
                      ))}
                    </div>
                    <p className="od-disc-viewall">
                      <Link href="/shop">View All</Link>
                    </p>
                  </>
                ) : null}
              </>
            )}
          </div>
        </section>

        {/* H — Craft / manufacturing */}
        <section id="about" className="od-disc-band od-disc-craft" aria-labelledby="od-disc-why-title">
          <div className="od-disc-shell">
            <header className="od-disc-band__head">
              <h2 id="od-disc-why-title">Why ONEDECORE</h2>
              <p className="od-disc-lede">One team. One standard. One complete home.</p>
            </header>
            <div className="od-disc-materials" aria-hidden="true">
              <figure>
                <Image
                  src={PM_ASSETS.materialStone.path}
                  alt=""
                  width={PM_ASSETS.materialStone.width}
                  height={PM_ASSETS.materialStone.height}
                  sizes="(max-width: 900px) 33vw, 20vw"
                />
              </figure>
              <figure>
                <Image
                  src={PM_ASSETS.materialTimber.path}
                  alt=""
                  width={PM_ASSETS.materialTimber.width}
                  height={PM_ASSETS.materialTimber.height}
                  sizes="(max-width: 900px) 33vw, 20vw"
                />
              </figure>
              <figure>
                <Image
                  src={PM_ASSETS.materialTexture.path}
                  alt=""
                  width={PM_ASSETS.materialTexture.width}
                  height={PM_ASSETS.materialTexture.height}
                  sizes="(max-width: 900px) 33vw, 20vw"
                />
              </figure>
            </div>
            <ul className="od-disc-why">
              <li>In-house manufacturing for custom work</li>
              <li>Quality control through design, make and install</li>
              <li>Interiors, kitchens and furniture under one brand</li>
            </ul>
          </div>
        </section>

        {/* I — Portfolio + client proof */}
        <section className="od-disc-band od-disc-homes" aria-labelledby="od-disc-homes-title">
          <div className="od-disc-shell od-disc-homes__grid">
            <div>
              <h2 id="od-disc-homes-title">Real homes. The complete ONEDECORE look.</h2>
              <p className="od-disc-lede">
                See finished interiors on the portfolio. Showcased homes are not claimed as
                product placements unless that link exists.
              </p>
              <Link href="/portfolio" className="od-disc-btn od-disc-btn--ghost">
                View Portfolio
              </Link>
            </div>
            <aside className="od-disc-homes__proof" aria-labelledby="od-disc-rev-title">
              <h3 id="od-disc-rev-title">Client experience</h3>
              <p>
                Homeowners work with ONEDECORE on interiors across Pune. These are interior and
                project experiences — not furniture product reviews.
              </p>
              <p className="od-disc-review-note">
                Average client rating {HOME_CLAIMS.rating}/5 from approved interior project
                feedback.
              </p>
            </aside>
          </div>
        </section>

        {/* J — Simple process */}
        <section className="od-disc-band od-disc-process-band" aria-labelledby="od-disc-process-title">
          <div className="od-disc-shell">
            <h2 id="od-disc-process-title">Two ways we work with you</h2>
            <div className="od-disc-process">
              <div>
                <h3>Interiors</h3>
                <ol>
                  <li>Consult</li>
                  <li>Design</li>
                  <li>Manufacture</li>
                  <li>Install</li>
                </ol>
              </div>
              <div>
                <h3>Furniture</h3>
                <ol>
                  <li>Browse</li>
                  <li>Explore Details</li>
                  <li>Check Serviceability</li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Pincode — only when commerce is useful */}
        {showPincode ? (
          <section className="od-disc-band od-disc-pin" aria-labelledby="od-disc-pin-title">
            <div className="od-disc-shell">
              <h2 id="od-disc-pin-title">Furniture pincode check</h2>
              <ShopPincodeChecker />
            </div>
          </section>
        ) : null}

        {/* K — Final CTA */}
        <section className="od-disc-final" aria-labelledby="od-disc-final-title">
          <div className="od-disc-shell">
            <h2 id="od-disc-final-title">Design your home. Furnish it beautifully.</h2>
            <div className="od-disc-hero__ctas">
              <Link href="/interiors#consultation" className="od-disc-btn od-disc-btn--primary">
                Book Free Consultation
              </Link>
              <Link href="/shop" className="od-disc-btn od-disc-btn--ghost">
                Shop Furniture
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
