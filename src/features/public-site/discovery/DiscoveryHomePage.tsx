import Link from "next/link";
import { PortfolioCard } from "@/features/portfolio/public/components/PortfolioCard";
import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import { PublicSiteFooter } from "@/features/public-site/chrome/PublicSiteFooter";
import { PublicSiteHeader } from "@/features/public-site/chrome/PublicSiteHeader";
import { PUBLIC_CONSULTATION } from "@/features/public-site/chrome/public-nav";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { RevealRuntime } from "@/features/public-site/motion/RevealRuntime";
import { HomeConsultationCapture } from "./HomeConsultationCapture";
import { DiscoveryBenefitCards } from "./DiscoveryBenefitCards";
import { DiscoveryBrowseTiles } from "./DiscoveryBrowseTiles";
import { DiscoveryHeroSlider } from "./DiscoveryHeroSlider";
import { DiscoveryStickyCta } from "./DiscoveryStickyCta";
import { DiscoveryTrustStrip } from "./DiscoveryTrustStrip";
import {
  DISCOVERY_FURNITURE_PROCESS_STEPS,
  DISCOVERY_PROCESS_STEPS,
  DISCOVERY_PROOF_PILLARS,
  DISCOVERY_SECTION_ORDER,
} from "./discovery-copy";
import "./discovery.css";
import "@/features/commerce/public/shop.css";
import { ShopPincodeChecker } from "@/features/commerce/public/components/ShopPincodeChecker";
import { ShopProductCard } from "@/features/commerce/public/components/ShopProductCard";
import type { PublicCommerceCategory } from "@/features/commerce/public/public-types";
import type { PublicCommerceProductCard } from "@/features/commerce/public/public-types";
import type { LeadFormMode } from "@/features/lead-intake/public/lead-form-mode";

export type DiscoveryCommerceState =
  | {
      readonly ok: true;
      readonly categories: readonly PublicCommerceCategory[];
      readonly featured: readonly PublicCommerceProductCard[];
    }
  | { readonly ok: false };

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
      <PublicSiteHeader
        current="home"
        showConsultation={false}
        showShopSearch={shopLive}
        shopEnabled={shopLive}
      />
      <RevealRuntime />
      <main id="od-discovery-main">
        <DiscoveryHeroSlider />
        <DiscoveryTrustStrip />
        <DiscoveryBenefitCards />
        <DiscoveryBrowseTiles />

        <section
          className="od-disc-band od-disc-band--deep od-disc-band--divided"
          data-od-disc-section="real-homes"
          aria-labelledby="od-disc-homes-title"
        >
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head od-disc-band__head--row">
              <div>
                <p className="od-disc-kicker">Featured collection</p>
                <h2 id="od-disc-homes-title">Recently completed homes</h2>
                <p className="od-disc-lede">
                  Real ONEDECORE interiors — curated like a premium collection, built from published
                  project work.
                </p>
              </div>
              <Link href="/portfolio" className="od-disc-btn od-disc-btn--ghost od-disc-homes__head-cta">
                View Full Portfolio
              </Link>
            </Reveal>
            {portfolioPreview.length > 0 ? (
              <div className="od-disc-homes__rail od-disc-homes__rail--collection" data-od-portfolio-preview="">
                {portfolioPreview.map((card) => (
                  <PortfolioCard key={card.slug} card={card} />
                ))}
              </div>
            ) : (
              <Reveal>
                <p className="od-disc-lede od-disc-homes__empty">
                  Published project photography will appear here as the portfolio is curated.
                </p>
              </Reveal>
            )}
          </div>
        </section>

        <section
          id="about"
          className="od-disc-band od-disc-band--surface od-disc-band--divided"
          data-od-disc-section="about"
          aria-labelledby="od-disc-about-title"
        >
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head">
              <p className="od-disc-kicker">Why ONEDECORE</p>
              <h2 id="od-disc-about-title">One team. One standard. One complete home.</h2>
              <p className="od-disc-lede">
                Trust, craft and a single process — from first conversation to installed home.
              </p>
            </Reveal>
            <ul className="od-disc-proof-grid">
              {DISCOVERY_PROOF_PILLARS.map((pillar, index) => (
                <Reveal key={pillar.id} order={index} as="li" className="od-disc-proof-card">
                  <h3>{pillar.title}</h3>
                  <p>{pillar.body}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        <section
          className="od-disc-band od-disc-band--deep od-disc-band--divided"
          data-od-disc-section="process"
          aria-labelledby="od-disc-process-title"
        >
          <div className="od-disc-shell">
            <Reveal as="header" className="od-disc-band__head">
              <p className="od-disc-kicker">Process</p>
              <h2 id="od-disc-process-title">Four steps to your finished home</h2>
            </Reveal>
            <ol className="od-disc-process-steps">
              {DISCOVERY_PROCESS_STEPS.map((step, index) => (
                <Reveal key={step} order={index} as="li" className="od-disc-process-step">
                  <span className="od-disc-process-step__num">{index + 1}</span>
                  <span className="od-disc-process-step__label">{step}</span>
                </Reveal>
              ))}
            </ol>
            {shopLive ? (
              <Reveal order={1} className="od-disc-process-furniture">
                <h3>Furniture</h3>
                <ol>
                  {DISCOVERY_FURNITURE_PROCESS_STEPS.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </Reveal>
            ) : null}
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
              <h2 id="od-disc-consult-title">Get your free design consultation</h2>
              <p className="od-disc-lede">
                Tell us what you are planning — complete interiors, a kitchen, or custom wardrobes.
                We review every enquiry and follow up with next steps.
              </p>
              <ul className="od-disc-consult__benefits">
                <li>{PUBLIC_CONSULTATION.label}</li>
                <li>10-Year warranty on approved scopes</li>
                <li>Own manufacturing for custom work</li>
              </ul>
              {!showLeadForm ? (
                <div className="od-disc-cta-row">
                  <Link href={PUBLIC_CONSULTATION.href} className="od-disc-btn od-disc-btn--primary od-disc-btn--sheen">
                    {PUBLIC_CONSULTATION.label}
                  </Link>
                  <Link href="/portfolio" className="od-disc-btn od-disc-btn--ghost">
                    View Portfolio
                  </Link>
                </div>
              ) : null}
            </Reveal>
            {showLeadForm ? (
              <Reveal order={1}>
                <div className="od-disc-consult__panel">
                  <HomeConsultationCapture mode={leadFormMode} />
                </div>
              </Reveal>
            ) : null}
          </div>
        </section>
      </main>
      <DiscoveryStickyCta />
      <PublicSiteFooter shopEnabled={shopLive} />
    </div>
  );
}
