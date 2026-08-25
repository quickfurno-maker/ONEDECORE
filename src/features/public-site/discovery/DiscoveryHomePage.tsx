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
import { HOME_CLAIM_COPY, HOME_CLAIMS, HOME_PUNE_AREAS } from "@/features/public-site/home-r4/claims";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { RevealRuntime } from "@/features/public-site/motion/RevealRuntime";
import { DiscoveryPuneCoverage } from "./DiscoveryPuneCoverage";
import {
  DISCOVERY_INTERIOR_PREVIEWS,
  DISCOVERY_SECTION_ORDER,
  DISCOVERY_TRUST_LABELS,
} from "./discovery-copy";
import "./discovery.css";
import "@/features/commerce/public/shop.css";
import "@/features/public-site/home-r4/styles/home-foundation.css";

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

const HERO_LOCALITY_CHIP_KEYS = [
  "Kharadi",
  "Baner",
  "Viman Nagar",
  "Wakad",
  "Hinjewadi",
  "Koregaon Park",
] as const satisfies ReadonlyArray<(typeof HOME_PUNE_AREAS)[number]>;
const HERO_LOCALITY_CHIPS = HERO_LOCALITY_CHIP_KEYS;

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
  const shopLive = commerce.ok;

  return (
    <div className="od-discovery" data-public-dark-theme="" data-od-discovery="">
      <div data-od-discovery-order={DISCOVERY_SECTION_ORDER.join("|")} hidden />
      <a className="od-skip" href="#od-discovery-main">
        Skip to content
      </a>
      <PublicSiteHeader current="home" />
      <RevealRuntime />
      <main id="od-discovery-main">
        {/* Hero */}
        <section className="od-disc-hero" aria-labelledby="od-disc-hero-title">
          <div
            className="od-disc-hero__glow"
            aria-hidden="true"
            style={
              {
                "--od-hero-focal": PM_ASSETS.hero.focalPoint,
                "--od-hero-focal-mobile": PM_ASSETS.hero.mobileFocalPoint,
              } as CSSProperties
            }
          >
            <Image src={PM_ASSETS.hero.path} alt="" fill priority sizes="100vw" className="od-disc-hero__bg" />
          </div>
          <div className="od-disc-shell od-disc-hero__grid">
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
                <Link href="/interiors#consultation" className="od-disc-btn od-disc-btn--primary">
                  Book Free Consultation
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
            </div>
            <Reveal order={2} className="od-disc-hero__visual" as="div">
              <div className="od-disc-hero__portrait">
                <Image
                  src={PM_ASSETS.heroConsultant.path}
                  alt={PM_ASSETS.heroConsultant.alt}
                  fill
                  priority
                  sizes="(max-width: 900px) 92vw, 34vw"
                  style={{ objectPosition: PM_ASSETS.heroConsultant.focalPoint }}
                />
              </div>
              <div className="od-disc-hero__inset" aria-hidden="true">
                <Image
                  src={PM_ASSETS.completeHomeInteriors.path}
                  alt=""
                  fill
                  sizes="(max-width: 900px) 40vw, 18vw"
                  style={{ objectPosition: PM_ASSETS.completeHomeInteriors.focalPoint }}
                />
              </div>
              <p className="od-disc-hero__cue">
                Consultation · Design · Manufacture · Install
              </p>
            </Reveal>
            <div className="od-disc-hero__meta">
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
                  {HERO_LOCALITY_CHIPS.map((area) => (
                    <span key={area}>{area}</span>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
          <p className="od-disc-hero__scroll" aria-hidden="true">
            Explore
          </p>
        </section>

        {/* Pune service */}
        <section
          className="od-disc-band od-disc-band--surface od-disc-band--divided"
          aria-labelledby="od-disc-pune-title"
        >
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head">
              <h2 id="od-disc-pune-title">Designed for Pune homes.</h2>
              <p className="od-disc-lede">
                From Kharadi and Viman Nagar to Baner, Wakad and beyond, ONEDECORE plans complete
                interiors across Pune.
              </p>
            </Reveal>
            <div className="od-disc-marquee" aria-label="Pune service areas">
              <div className="od-disc-marquee__track">
                <ul>
                  {HOME_PUNE_AREAS.map((area) => (
                    <li key={area}>{area}</li>
                  ))}
                </ul>
                <ul aria-hidden="true">
                  {HOME_PUNE_AREAS.map((area) => (
                    <li key={`dup-${area}`}>{area}</li>
                  ))}
                </ul>
              </div>
            </div>
            <Reveal order={1}>
              <DiscoveryPuneCoverage />
            </Reveal>
          </div>
        </section>

        {/* Journeys */}
        <section className="od-disc-band od-disc-band--deep" aria-labelledby="od-disc-journeys-title">
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head">
              <h2 id="od-disc-journeys-title">Start with the way you need us.</h2>
            </Reveal>
            <div className="od-disc-paths">
              <Reveal order={0} as="div" className="od-disc-path-wrap od-disc-path-wrap--dominant">
                <Link href="/interiors" className="od-disc-path od-disc-path--wide">
                  <span className="od-disc-path__media" aria-hidden="true">
                    <Image
                      src={PM_ASSETS.completeHomeInteriors.path}
                      alt=""
                      fill
                      sizes="(max-width: 900px) 100vw, 62vw"
                      style={{ objectPosition: PM_ASSETS.completeHomeInteriors.focalPoint }}
                    />
                  </span>
                  <span className="od-disc-path__body">
                    <span className="od-disc-path__title">Plan Your Home</span>
                    <span className="od-disc-path__copy">
                      Full-home interiors, modular kitchens, wardrobes and renovation — one
                      continuous plan for Pune living.
                    </span>
                    <span className="od-disc-path__cta">Explore interiors</span>
                  </span>
                </Link>
              </Reveal>
              <Reveal order={1} as="div" className="od-disc-path-wrap">
                {shopLive ? (
                  <Link href="/shop" className="od-disc-path">
                    <span className="od-disc-path__media" aria-hidden="true">
                      <Image
                        src={PM_ASSETS.customWardrobes.path}
                        alt=""
                        fill
                        sizes="(max-width: 900px) 100vw, 38vw"
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
                ) : (
                  <a href="#furniture-teaser" className="od-disc-path od-disc-path--teaser">
                    <span className="od-disc-path__media" aria-hidden="true">
                      <Image
                        src={PM_ASSETS.customWardrobes.path}
                        alt=""
                        fill
                        sizes="(max-width: 900px) 100vw, 38vw"
                        style={{ objectPosition: PM_ASSETS.customWardrobes.focalPoint }}
                      />
                    </span>
                    <span className="od-disc-path__body">
                      <span className="od-disc-path__title">Furniture Collection</span>
                      <span className="od-disc-path__copy">
                        The furniture line is being prepared to match ONEDECORE interiors.
                      </span>
                      <span className="od-disc-path__cta">See what’s coming</span>
                    </span>
                  </a>
                )}
              </Reveal>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="od-disc-trust od-disc-band--divided" aria-label="ONEDECORE capabilities">
          <div className="od-disc-shell">
            <ul>
              {DISCOVERY_TRUST_LABELS.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Interiors showcase */}
        <section className="od-disc-band od-disc-band--surface" aria-labelledby="od-disc-int-title">
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head">
              <h2 id="od-disc-int-title">Complete interiors for the way Pune lives.</h2>
              <p className="od-disc-lede">
                Interiors, kitchens and storage planned together — not as separate purchases.
              </p>
            </Reveal>
            <div className="od-disc-gallery">
              {INTERIOR_VISUALS.map((item, index) => (
                <Reveal key={item.title} order={index} as="div" className={`od-disc-tile-wrap od-disc-tile-wrap--${item.size}`}>
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
            </p>
          </div>
        </section>

        {/* Kitchen */}
        <section className="od-disc-band od-disc-band--deep od-disc-kitchen" aria-labelledby="od-disc-kit-title">
          <div className="od-disc-shell od-disc-kitchen__grid">
            <Reveal as="figure" className="od-disc-kitchen__figure">
              <Image
                src={PM_ASSETS.modularKitchens.path}
                alt={PM_ASSETS.modularKitchens.alt}
                width={PM_ASSETS.modularKitchens.width}
                height={PM_ASSETS.modularKitchens.height}
                sizes="(max-width: 900px) 100vw, 52vw"
              />
            </Reveal>
            <Reveal order={1} className="od-disc-kitchen__copy">
              <p className="od-disc-kicker">Modular kitchens</p>
              <h2 id="od-disc-kit-title">Designed in Pune. Finished with factory precision.</h2>
              <p className="od-disc-lede">
                Storage, finishes and install kept inside the same interior plan — not a separate
                kitchen package.
              </p>
              <Link href="/interiors#modular-kitchen" className="od-disc-btn od-disc-btn--ghost">
                Explore Kitchens
              </Link>
            </Reveal>
          </div>
        </section>

        {/* Bridge */}
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
          <Reveal className="od-disc-shell od-disc-bridge__copy">
            <h2 id="od-disc-bridge-title">Design it. Furnish it. Keep it one complete look.</h2>
            <p>
              ONEDECORE brings planning, manufacturing and furnishing together so the home feels
              intentional from the first drawing to the final piece.
            </p>
          </Reveal>
        </section>

        {/* Why / craft */}
        <section id="about" className="od-disc-band od-disc-band--surface od-disc-craft" aria-labelledby="od-disc-why-title">
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head">
              <h2 id="od-disc-why-title">Why ONEDECORE</h2>
              <p className="od-disc-lede">One team. One standard. One complete home.</p>
            </Reveal>
            <div className="od-disc-materials" aria-hidden="true">
              <Reveal order={0} as="figure">
                <Image
                  src={PM_ASSETS.materialStone.path}
                  alt=""
                  width={PM_ASSETS.materialStone.width}
                  height={PM_ASSETS.materialStone.height}
                  sizes="(max-width: 900px) 33vw, 20vw"
                />
              </Reveal>
              <Reveal order={1} as="figure">
                <Image
                  src={PM_ASSETS.materialTimber.path}
                  alt=""
                  width={PM_ASSETS.materialTimber.width}
                  height={PM_ASSETS.materialTimber.height}
                  sizes="(max-width: 900px) 33vw, 20vw"
                />
              </Reveal>
              <Reveal order={2} as="figure">
                <Image
                  src={PM_ASSETS.materialTexture.path}
                  alt=""
                  width={PM_ASSETS.materialTexture.width}
                  height={PM_ASSETS.materialTexture.height}
                  sizes="(max-width: 900px) 33vw, 20vw"
                />
              </Reveal>
            </div>
            <ul className="od-disc-why">
              <li>In-house manufacturing for custom work</li>
              <li>Quality control through design, make and install</li>
              <li>Interiors, kitchens and furniture under one brand</li>
              <li>
                {HOME_CLAIMS.warrantyYears}-year warranty on approved scopes · {HOME_CLAIMS.rating}/5
                average client rating
              </li>
            </ul>
          </div>
        </section>

        {/* Portfolio */}
        <section className="od-disc-band od-disc-band--deep od-disc-homes" aria-labelledby="od-disc-homes-title">
          <div className="od-disc-shell od-disc-homes__grid">
            <Reveal>
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
              <h3 id="od-disc-rev-title">Client experience</h3>
              <p>
                Homeowners work with ONEDECORE on interiors across Pune. These are interior and
                project experiences — not furniture product reviews.
              </p>
              <p className="od-disc-review-note">
                Average client rating {HOME_CLAIMS.rating}/5 from approved interior project feedback.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Consultation gateway */}
        <section
          className="od-disc-band od-disc-band--surface od-disc-consult"
          aria-labelledby="od-disc-consult-title"
        >
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head">
              <h2 id="od-disc-consult-title">Ready to plan your Pune home?</h2>
              <p className="od-disc-lede">
                Tell us what you’re planning, your locality and timeline. Start with a free design
                consultation.
              </p>
            </Reveal>
            <ol className="od-disc-consult__steps">
              <Reveal order={0} as="li">
                <span className="od-disc-consult__num">01</span>
                <span>Choose your interior need</span>
              </Reveal>
              <Reveal order={1} as="li">
                <span className="od-disc-consult__num">02</span>
                <span>Add your Pune locality &amp; timeline</span>
              </Reveal>
              <Reveal order={2} as="li">
                <span className="od-disc-consult__num">03</span>
                <span>Start your design consultation</span>
              </Reveal>
            </ol>
            <Reveal order={3} className="od-disc-hero__ctas">
              <Link href="/interiors#consultation" className="od-disc-btn od-disc-btn--primary">
                Book Free Consultation
              </Link>
              <Link href="/interiors" className="od-disc-btn od-disc-btn--ghost">
                Start your home plan
              </Link>
            </Reveal>
          </div>
        </section>

        {/* Furniture */}
        <section
          id="furniture-teaser"
          className="od-disc-band od-disc-band--deep"
          aria-labelledby="od-disc-furn-title"
        >
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head">
              <h2 id="od-disc-furn-title">
                {shopLive ? "Furniture made for complete homes." : "Furniture Collection"}
              </h2>
            </Reveal>

            {!shopLive || (roots.length === 0 && featured.length === 0) ? (
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
                  <div className="od-disc-hero__ctas">
                    <Link href="/interiors#consultation" className="od-disc-btn od-disc-btn--primary">
                      Book Free Consultation
                    </Link>
                    <Link href="/portfolio" className="od-disc-text-link">
                      View Portfolio
                    </Link>
                  </div>
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
              </>
            )}
          </div>
        </section>

        {/* Process */}
        <section className="od-disc-band od-disc-process-band od-disc-band--divided" aria-labelledby="od-disc-process-title">
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

        {showPincode ? (
          <section className="od-disc-band od-disc-pin" aria-labelledby="od-disc-pin-title">
            <div className="od-disc-shell">
              <h2 id="od-disc-pin-title">Furniture pincode check</h2>
              <ShopPincodeChecker />
            </div>
          </section>
        ) : null}

        {/* Final CTA */}
        <section className="od-disc-final" aria-labelledby="od-disc-final-title">
          <div className="od-disc-shell">
            <Reveal>
              <h2 id="od-disc-final-title">Your Pune home deserves one complete vision.</h2>
              <p className="od-disc-lede">
                Interiors, kitchens, custom storage and furniture — planned with one coordinated
                design language.
              </p>
              <div className="od-disc-hero__ctas">
                <Link href="/interiors#consultation" className="od-disc-btn od-disc-btn--primary">
                  Book Free Consultation
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
