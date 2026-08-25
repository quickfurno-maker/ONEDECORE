import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShopPincodeChecker } from "@/features/commerce/public/components/ShopPincodeChecker";
import { ShopProductCard } from "@/features/commerce/public/components/ShopProductCard";
import type { PublicCommerceCategory } from "@/features/commerce/public/public-types";
import type { PublicCommerceProductCard } from "@/features/commerce/public/public-types";
import type { LeadFormMode } from "@/features/lead-intake/public/lead-form-mode";
import { PortfolioCard } from "@/features/portfolio/public/components/PortfolioCard";
import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import { PublicSiteFooter } from "@/features/public-site/chrome/PublicSiteFooter";
import { PublicSiteHeader } from "@/features/public-site/chrome/PublicSiteHeader";
import { PUBLIC_CONSULTATION } from "@/features/public-site/chrome/public-nav";
import { PM_ASSETS } from "@/features/public-site/home-r4/content";
import { HOME_CLAIM_COPY, HOME_CLAIMS, HOME_PUNE_AREAS } from "@/features/public-site/home-r4/claims";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { RevealRuntime } from "@/features/public-site/motion/RevealRuntime";
import { HomeConsultationCapture } from "./HomeConsultationCapture";
import {
  DISCOVERY_FURNITURE_PROCESS_STEPS,
  DISCOVERY_PROCESS_STEPS,
  DISCOVERY_SECTION_ORDER,
  DISCOVERY_SERVICE_SECTIONS,
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

/** Owner-supplied cohesive homepage set (hero + three service images). No hero reuse on services. */
const HOMEPAGE_HERO = PM_ASSETS.hero;

const SERVICE_ASSETS = {
  "complete-home": PM_ASSETS.completeHomeInteriors,
  "modular-kitchen": PM_ASSETS.modularKitchens,
  wardrobes: PM_ASSETS.customWardrobes,
} as const;

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
  portfolioPreview,
  leadFormMode,
}: {
  readonly commerce: DiscoveryCommerceState;
  readonly portfolioPreview: readonly PublicPortfolioCard[];
  readonly leadFormMode: LeadFormMode;
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
  const showLeadForm = leadFormMode === "active" || leadFormMode === "preview";

  return (
    <div className="od-discovery" data-public-dark-theme="" data-od-discovery="">
      <div data-od-discovery-order={DISCOVERY_SECTION_ORDER.join("|")} hidden />
      <a className="od-skip" href="#od-discovery-main">
        Skip to content
      </a>
      <PublicSiteHeader current="home" showShopSearch={shopLive} shopEnabled={shopLive} />
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
                <h1 id="od-disc-hero-title">Complete home interiors, designed and delivered.</h1>
                <p className="od-disc-hero__lede">
                  Modular kitchens, custom wardrobes and full-home interiors — planned, manufactured
                  and installed by one coordinated ONEDECORE team across Pune.
                </p>
              </Reveal>
              <Reveal order={2} className="od-disc-hero__ctas">
                <Link href={PUBLIC_CONSULTATION.href} className="od-disc-btn od-disc-btn--primary">
                  {PUBLIC_CONSULTATION.label}
                </Link>
                <Link href="/portfolio" className="od-disc-btn od-disc-btn--ghost">
                  View Portfolio
                </Link>
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

        {DISCOVERY_SERVICE_SECTIONS.map((service, index) => {
          const asset = SERVICE_ASSETS[service.id];
          const imageLeft = index % 2 === 1;
          return (
            <section
              key={service.id}
              id={service.id === "modular-kitchen" ? "modular-kitchen" : undefined}
              className={`od-disc-band od-disc-band--divided ${
                index % 2 === 0 ? "od-disc-band--surface" : "od-disc-band--deep"
              }`}
              data-od-disc-section={service.id}
              aria-labelledby={`od-disc-${service.id}-title`}
            >
              <div
                className={`od-disc-shell od-disc-service ${
                  imageLeft ? "od-disc-service--flip" : ""
                }`}
              >
                <Reveal className="od-disc-service__copy">
                  <p className="od-disc-kicker">{service.kicker}</p>
                  <h2 id={`od-disc-${service.id}-title`}>{service.title}</h2>
                  <p className="od-disc-lede">{service.lede}</p>
                  <ul className="od-disc-service__points">
                    {service.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <Link href={service.href} className="od-disc-btn od-disc-btn--primary">
                    {PUBLIC_CONSULTATION.label}
                  </Link>
                </Reveal>
                <Reveal order={1} className="od-disc-service__media">
                  <Image
                    src={asset.path}
                    alt={asset.alt}
                    fill
                    sizes="(max-width: 900px) 100vw, 48vw"
                    style={{ objectPosition: asset.focalPoint }}
                  />
                </Reveal>
              </div>
            </section>
          );
        })}

        <section
          id="about"
          className="od-disc-band od-disc-band--surface od-disc-band--divided"
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
                  <li>Interiors and kitchens under one brand</li>
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
          className="od-disc-band od-disc-band--deep od-disc-band--divided"
          data-od-disc-section="real-homes"
          aria-labelledby="od-disc-homes-title"
        >
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head">
              <p className="od-disc-kicker">Portfolio</p>
              <h2 id="od-disc-homes-title">Real homes. Finished ONEDECORE work.</h2>
              <p className="od-disc-lede">
                See how layouts, materials and details come together across complete homes.
              </p>
            </Reveal>
            {portfolioPreview.length > 0 ? (
              <div className="od-disc-homes__grid" data-od-portfolio-preview="">
                {portfolioPreview.map((card, index) => (
                  <PortfolioCard key={card.slug} card={card} eagerImage={index < 3} />
                ))}
              </div>
            ) : (
              <Reveal>
                <p className="od-disc-lede od-disc-homes__empty">
                  Published project photography will appear here as the portfolio is curated.
                </p>
              </Reveal>
            )}
            <Reveal order={1} className="od-disc-homes__actions">
              <Link href="/portfolio" className="od-disc-btn od-disc-btn--ghost">
                View Portfolio
              </Link>
            </Reveal>
          </div>
        </section>

        {shopLive ? (
          <section
            id="furniture-teaser"
            className="od-disc-band od-disc-band--surface od-disc-band--divided"
            data-od-disc-section="furniture"
            aria-labelledby="od-disc-furn-title"
          >
            <div className="od-disc-shell">
              <Reveal as="header" className="od-disc-band__head">
                <p className="od-disc-kicker">Furniture</p>
                <h2 id="od-disc-furn-title">Furniture made for complete homes.</h2>
              </Reveal>
              {showLiveFurniture ? (
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
              ) : (
                <Reveal>
                  <p className="od-disc-lede">Browse furniture categories when products are listed.</p>
                  <Link href="/shop" className="od-disc-btn od-disc-btn--ghost">
                    Shop Furniture
                  </Link>
                </Reveal>
              )}
            </div>
          </section>
        ) : null}

        <section
          id="consultation"
          className="od-disc-band od-disc-consult"
          data-od-disc-section="consultation"
          aria-labelledby="od-disc-consult-title"
        >
          <div className="od-disc-shell od-disc-consult__layout">
            <Reveal>
              <p className="od-disc-kicker">Consultation</p>
              <h2 id="od-disc-consult-title">Ready to plan your home with ONEDECORE?</h2>
              <p className="od-disc-lede">
                Start with a free consultation. Tell us what you need — complete interiors, a
                kitchen, or custom wardrobes — and we will take it from there.
              </p>
              {!showLeadForm ? (
                <div className="od-disc-hero__ctas">
                  <Link href="/portfolio" className="od-disc-btn od-disc-btn--ghost">
                    View Portfolio
                  </Link>
                </div>
              ) : null}
            </Reveal>
            {showLeadForm ? (
              <Reveal order={1}>
                <HomeConsultationCapture mode={leadFormMode} />
              </Reveal>
            ) : null}
          </div>
        </section>
      </main>
      <PublicSiteFooter shopEnabled={shopLive} />
    </div>
  );
}
