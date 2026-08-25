import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShopPincodeChecker } from "@/features/commerce/public/components/ShopPincodeChecker";
import { ShopProductCard } from "@/features/commerce/public/components/ShopProductCard";
import type { PublicCommerceCategory } from "@/features/commerce/public/public-types";
import type { PublicCommerceProductCard } from "@/features/commerce/public/public-types";
import { PublicSiteFooter } from "@/features/public-site/chrome/PublicSiteFooter";
import { PublicSiteHeader } from "@/features/public-site/chrome/PublicSiteHeader";
import { PUBLIC_CONSULTATION } from "@/features/public-site/chrome/public-nav";
import { PM_ASSETS } from "@/features/public-site/home-r4/content";
import { HOME_CLAIM_COPY, HOME_CLAIMS, HOME_PUNE_AREAS } from "@/features/public-site/home-r4/claims";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { RevealRuntime } from "@/features/public-site/motion/RevealRuntime";
import {
  DISCOVERY_FURNITURE_PROCESS_STEPS,
  DISCOVERY_INTERIOR_PREVIEWS,
  DISCOVERY_PROCESS_STEPS,
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

/** Homepage hero uses completeHomeInteriors; tile uses a different approved interior. */
const HOMEPAGE_HERO = PM_ASSETS.completeHomeInteriors;

const INTERIOR_VISUALS = [
  {
    title: "Full Home Interiors",
    href: DISCOVERY_INTERIOR_PREVIEWS[0].href,
    asset: PM_ASSETS.hero,
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

const HERO_LOCALITY_CHIP_KEYS = [
  "Kharadi",
  "Baner",
  "Viman Nagar",
  "Wakad",
  "Hinjewadi",
  "Koregaon Park",
] as const satisfies ReadonlyArray<(typeof HOME_PUNE_AREAS)[number]>;

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
  const shopLive = commerce.ok;
  const showPincode = shopLive && (roots.length > 0 || featured.length > 0);
  const showLiveFurniture = shopLive && (roots.length > 0 || featured.length > 0);

  return (
    <div className="od-discovery" data-public-dark-theme="" data-od-discovery="">
      <div data-od-discovery-order={DISCOVERY_SECTION_ORDER.join("|")} hidden />
      <a className="od-skip" href="#od-discovery-main">
        Skip to content
      </a>
      <PublicSiteHeader current="home" showShopSearch={shopLive} />
      <RevealRuntime />
      <main id="od-discovery-main">
        <section
          className="od-disc-hero"
          data-od-disc-section="hero"
          aria-labelledby="od-disc-hero-title"
        >
          <div
            className="od-disc-hero__media"
            aria-hidden="true"
            style={
              {
                "--od-hero-focal": HOMEPAGE_HERO.focalPoint,
                "--od-hero-focal-mobile": HOMEPAGE_HERO.mobileFocalPoint,
              } as CSSProperties
            }
          >
            <Image
              src={HOMEPAGE_HERO.path}
              alt=""
              fill
              priority
              sizes="100vw"
              className="od-disc-hero__bg"
            />
          </div>
          <div className="od-disc-shell">
            <div className="od-disc-hero__copy">
              <Reveal order={0}>
                <p className="od-disc-kicker">Premium interiors for Pune homes</p>
              </Reveal>
              <Reveal order={1} as="header">
                <h1 id="od-disc-hero-title">Design the home. Furnish it beautifully.</h1>
                <p className="od-disc-hero__lede">
                  Complete interiors, modular kitchens and furniture for Pune homes — designed,
                  manufactured and delivered by one coordinated team.
                </p>
              </Reveal>
              <Reveal order={2} className="od-disc-hero__ctas">
                <Link href={PUBLIC_CONSULTATION.href} className="od-disc-btn od-disc-btn--primary">
                  {PUBLIC_CONSULTATION.label}
                </Link>
                {shopLive ? (
                  <Link href="/shop" className="od-disc-btn od-disc-btn--ghost">
                    Shop Furniture
                  </Link>
                ) : (
                  <Link href="/portfolio" className="od-disc-btn od-disc-btn--ghost">
                    View Portfolio
                  </Link>
                )}
              </Reveal>
              <Reveal order={3}>
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
              </Reveal>
              <Reveal order={4}>
                <div className="od-disc-hero__chips" aria-label="Sample Pune localities">
                  {HERO_LOCALITY_CHIP_KEYS.map((area) => (
                    <span key={area}>{area}</span>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section
          className="od-disc-band od-disc-band--surface od-disc-band--divided"
          data-od-disc-section="interiors"
          aria-labelledby="od-disc-int-title"
        >
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head">
              <p className="od-disc-kicker">Interiors</p>
              <h2 id="od-disc-int-title">Complete interiors for the way Pune lives.</h2>
              <p className="od-disc-lede">
                Interiors, kitchens and storage planned together — not as separate purchases.
                From Kharadi and Viman Nagar to Baner, Wakad and beyond.
              </p>
            </Reveal>
            <div className="od-disc-gallery">
              {INTERIOR_VISUALS.map((item, index) => (
                <Reveal
                  key={item.title}
                  order={index}
                  as="div"
                  className={`od-disc-tile-wrap od-disc-tile-wrap--${item.size}`}
                >
                  <Link href={item.href} className={`od-disc-tile od-disc-tile--${item.size}`}>
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
                </Reveal>
              ))}
            </div>
            <p className="od-disc-inline-cta">
              <Link href="/interiors" className="od-disc-text-link">
                Explore Interiors
              </Link>
              <span aria-hidden="true"> · </span>
              <Link href="/interiors#modular-kitchen" className="od-disc-text-link">
                Explore Kitchens
              </Link>
            </p>
          </div>
        </section>

        <section
          id="about"
          className="od-disc-band od-disc-band--deep od-disc-band--divided"
          data-od-disc-section="why"
          aria-labelledby="od-disc-why-title"
        >
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head">
              <p className="od-disc-kicker">Why ONEDECORE</p>
              <h2 id="od-disc-why-title">One team. One standard. One complete home.</h2>
              <p className="od-disc-lede">
                Trust, craft and a single process — from first conversation to installed home.
              </p>
            </Reveal>
            <ul className="od-disc-trust">
              {DISCOVERY_TRUST_LABELS.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <div className="od-disc-why-grid">
              <Reveal order={0} className="od-disc-process">
                <h3>How we work</h3>
                <ol>
                  {DISCOVERY_PROCESS_STEPS.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {shopLive ? (
                  <>
                    <h3>Furniture</h3>
                    <ol>
                      {DISCOVERY_FURNITURE_PROCESS_STEPS.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </>
                ) : null}
              </Reveal>
              <Reveal order={1}>
                <ul className="od-disc-why">
                  <li>In-house manufacturing for custom work</li>
                  <li>Quality control through design, make and install</li>
                  <li>Interiors, kitchens and furniture under one brand</li>
                  <li>
                    {HOME_CLAIMS.warrantyYears}-year warranty on approved scopes · {HOME_CLAIMS.rating}
                    /5 average client rating
                  </li>
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        <section
          className="od-disc-band od-disc-band--surface od-disc-band--divided"
          data-od-disc-section="real-homes"
          aria-labelledby="od-disc-homes-title"
        >
          <div className="od-disc-shell od-disc-homes">
            <Reveal>
              <p className="od-disc-kicker">Portfolio</p>
              <h2 id="od-disc-homes-title">Real homes. The complete ONEDECORE look.</h2>
              <p className="od-disc-lede">
                Explore finished ONEDECORE interiors and see how layouts, materials and details come
                together across complete homes.
              </p>
              <Link href="/portfolio" className="od-disc-btn od-disc-btn--ghost">
                View Portfolio
              </Link>
            </Reveal>
            <Reveal order={1} className="od-disc-homes__proof">
              <h3>Client experience</h3>
              <p>
                Homeowners across Pune work with ONEDECORE for coordinated interior design,
                manufacturing and installation.
              </p>
              <p className="od-disc-review-note">
                Average client rating {HOME_CLAIMS.rating}/5 across interior project feedback.
              </p>
            </Reveal>
          </div>
        </section>

        <section
          id="furniture-teaser"
          className="od-disc-band od-disc-band--deep od-disc-band--divided"
          data-od-disc-section="furniture"
          aria-labelledby="od-disc-furn-title"
        >
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head">
              <p className="od-disc-kicker">Furniture</p>
              <h2 id="od-disc-furn-title">
                {shopLive ? "Furniture made for complete homes." : "Furniture Collection"}
              </h2>
            </Reveal>

            {!showLiveFurniture ? (
              <Reveal className="od-disc-teaser">
                <div className="od-disc-teaser__media" aria-hidden="true">
                  <Image
                    src={PM_ASSETS.dusk.path}
                    alt=""
                    fill
                    sizes="(max-width: 900px) 100vw, 40vw"
                    style={{ objectPosition: PM_ASSETS.dusk.focalPoint }}
                  />
                </div>
                <div>
                  <p>The ONEDECORE furniture collection is being prepared.</p>
                  <p className="od-disc-teaser__note">
                    Interiors consultation is available now while we prepare the furniture
                    collection.
                  </p>
                </div>
              </Reveal>
            ) : (
              <>
                {roots.length > 0 ? (
                  <div className={`od-disc-cats ${roots.length === 1 ? "od-disc-cats--one" : ""}`}>
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
                {showPincode ? (
                  <div className="od-disc-pin">
                    <h3 className="od-disc-subhead">Furniture pincode check</h3>
                    <ShopPincodeChecker />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        <section
          className="od-disc-band od-disc-consult"
          data-od-disc-section="consultation"
          aria-labelledby="od-disc-consult-title"
        >
          <div className="od-disc-shell">
            <Reveal>
              <p className="od-disc-kicker">Consultation</p>
              <h2 id="od-disc-consult-title">Your Pune home deserves one complete vision.</h2>
              <p className="od-disc-lede">
                Interiors, kitchens, custom storage and furniture — planned with one coordinated
                design language. Start with a free consultation.
              </p>
              <div className="od-disc-hero__ctas">
                <Link href={PUBLIC_CONSULTATION.href} className="od-disc-btn od-disc-btn--primary">
                  {PUBLIC_CONSULTATION.label}
                </Link>
                {shopLive ? (
                  <Link href="/shop" className="od-disc-btn od-disc-btn--ghost">
                    Shop Furniture
                  </Link>
                ) : (
                  <Link href="/portfolio" className="od-disc-btn od-disc-btn--ghost">
                    View Portfolio
                  </Link>
                )}
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
