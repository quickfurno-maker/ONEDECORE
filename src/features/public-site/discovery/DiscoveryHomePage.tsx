import Link from "next/link";
import { PortfolioCard } from "@/features/portfolio/public/components/PortfolioCard";
import type { PublicPortfolioCard } from "@/features/portfolio/public/types";
import { PublicSiteFooter } from "@/features/public-site/chrome/PublicSiteFooter";
import { PublicSiteHeader } from "@/features/public-site/chrome/PublicSiteHeader";
import { PUBLIC_CONSULTATION } from "@/features/public-site/chrome/public-nav";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { RevealRuntime } from "@/features/public-site/motion/RevealRuntime";
import { LeadConsultationHost } from "@/features/lead-intake/public/LeadConsultationHost";
import { DiscoveryAbout } from "./DiscoveryAbout";
import { DiscoveryConsultCta } from "./DiscoveryConsultCta";
import { DiscoveryHeroSlider } from "./DiscoveryHeroSlider";
import { DiscoveryStickyCta } from "./DiscoveryStickyCta";
import { DiscoveryWhatsAppFab } from "./DiscoveryWhatsAppFab";
import { DiscoveryWhy } from "./DiscoveryWhy";
import {
  DISCOVERY_CONTACT_EYEBROW,
  DISCOVERY_CONTACT_HEADLINE,
  DISCOVERY_CONTACT_LEDE,
  DISCOVERY_SECTION_ORDER,
} from "./discovery-copy";
import "./discovery.css";
import "@/features/commerce/public/shop.css";
import { ShopProductCard } from "@/features/commerce/public/components/ShopProductCard";
import type { PublicCommerceCategory } from "@/features/commerce/public/public-types";
import type { PublicCommerceProductCard } from "@/features/commerce/public/public-types";

export type DiscoveryCommerceState =
  | {
      readonly ok: true;
      readonly categories: readonly PublicCommerceCategory[];
      readonly featured: readonly PublicCommerceProductCard[];
    }
  | { readonly ok: false };

/**
 * The ONEDECORE homepage — one brand, two ways in.
 *
 * WHAT THIS PAGE IS
 *
 * A gateway. ONEDECORE designs and builds interiors, and sells furniture, and
 * a visitor arriving at `/` is choosing between those before they are reading
 * about either. So the page offers the choice in the first screen and then
 * gives each vertical enough proof to be credible — rather than arguing
 * interiors at length and mentioning furniture near the footer.
 *
 * The running order is `DISCOVERY_SECTION_ORDER`, and the reasoning for each
 * band being where it is lives there.
 *
 * WHAT LEFT THE HOMEPAGE
 *
 * The portfolio-category, manufacturing, design-library, process, quality and
 * areas-served bands, and one of the two closing consultation bands. Every one
 * of them answers a question a visitor asks after choosing interiors, and
 * `/interiors` is where that choice is made. None of the components was
 * deleted: they are used elsewhere and removing files is a different change
 * from reordering a page.
 *
 * ONE FORM, OPENED FROM EVERYWHERE
 *
 * This page has no form of its own. Every CTA opens the SAME guided sheet every
 * other public surface opens, mounted once by `LeadConsultationHost`, so there
 * is one journey and one submission path. The host also decides whether the
 * form is offered at all by asking the running server — a build-time flag used
 * to answer that, and a real enquiry was lost because the flag said yes while
 * the backend said no.
 *
 * SHOP IS FAIL-CLOSED THROUGHOUT
 *
 * `commerce.ok` is the gate. When it is false the hero drops its second button,
 * the shop band does not render, the About section drops its furniture half and
 * the header drops Shop from the menu — nothing is shown disabled, because a
 * link to a gated surface is a dead end wearing a menu item's clothes.
 */
export function DiscoveryHomePage({
  commerce,
  portfolioPreview,
}: {
  readonly commerce: DiscoveryCommerceState;
  readonly portfolioPreview: readonly PublicPortfolioCard[];
}) {
  const shopLive = commerce.ok;

  /*
   * Compact on purpose. This is a teaser for the Shop journey, not a second
   * copy of the Shop homepage: up to four root categories and four featured
   * pieces, and never an empty slot padded out to fill a grid.
   */
  const roots = commerce.ok
    ? commerce.categories
        .filter((row) => row.isRoot)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, 4)
    : [];
  const featured = commerce.ok ? commerce.featured.slice(0, 4) : [];
  const hasShopContent = shopLive && (roots.length > 0 || featured.length > 0);

  /*
   * Fewer, larger, quieter. Three is the shape that reads as curated proof at
   * every breakpoint; six read as a contact sheet.
   */
  const projects = portfolioPreview.slice(0, 3);

  return (
    <LeadConsultationHost>
      <div
        className="od-discovery"
        data-public-dark-theme=""
        data-od-discovery=""
      >
        <div
          data-od-discovery-order={DISCOVERY_SECTION_ORDER.join("|")}
          hidden
        />
        <a className="od-skip" href="#od-discovery-main">
          Skip to content
        </a>
        <PublicSiteHeader
          current="home"
          showShopSearch={shopLive}
          shopEnabled={shopLive}
        />
        <RevealRuntime />
        <main id="od-discovery-main">
          <DiscoveryHeroSlider shopLive={shopLive} />

          {/* Why the interiors path is credible — four points, not the whole
              of /interiors. */}
          <DiscoveryWhy />

          {/* Proof for the claim just made. Interior projects only: this
              preview reads from the portfolio publication path and shows
              nothing else. */}
          <section
            className="od-disc-band od-disc-band--deep od-disc-homes"
            data-od-disc-section="featured-interiors"
            aria-labelledby="od-disc-homes-title"
          >
            <div className="od-disc-shell">
              <Reveal
                as="header"
                className="od-disc-band__head od-disc-band__head--row"
              >
                <div>
                  <p className="od-disc-kicker">Portfolio</p>
                  <h2 id="od-disc-homes-title" className="od-disc-display">
                    <span>Homes we&rsquo;ve transformed across Pune.</span>
                  </h2>
                </div>
                <Link
                  href="/portfolio"
                  className="od-disc-btn od-disc-btn--ghost od-disc-homes__head-cta"
                >
                  View Portfolio
                </Link>
              </Reveal>
              {projects.length > 0 ? (
                <div
                  className="od-disc-homes__rail od-disc-homes__rail--collection"
                  data-od-portfolio-preview=""
                >
                  {projects.map((card) => (
                    <PortfolioCard key={card.slug} card={card} />
                  ))}
                </div>
              ) : (
                /*
                 * Honest empty state. No stock photography and no placeholder
                 * that could be mistaken for completed customer work.
                 */
                <Reveal>
                  <p className="od-disc-lede od-disc-homes__empty">
                    Published project photography will appear here as the
                    portfolio is curated.
                  </p>
                </Reveal>
              )}
            </div>
          </section>

          {/* The second vertical, at full size rather than as an afterthought.
              The pincode checker moved to the Shop journey, where a
              serviceability question actually belongs. */}
          {shopLive ? (
            <section
              id="furniture-teaser"
              className="od-disc-band od-disc-band--surface od-disc-band--divided"
              data-od-disc-section="shop"
              aria-labelledby="od-disc-furn-title"
            >
              <div className="od-disc-shell">
                <Reveal
                  as="header"
                  className="od-disc-band__head od-disc-band__head--row"
                >
                  <div>
                    <p className="od-disc-kicker">Furniture</p>
                    <h2 id="od-disc-furn-title" className="od-disc-display">
                      <span>Furniture made for complete homes.</span>
                    </h2>
                  </div>
                  <Link
                    href="/shop"
                    className="od-disc-btn od-disc-btn--ghost od-disc-homes__head-cta"
                  >
                    Explore Shop
                  </Link>
                </Reveal>

                {hasShopContent ? (
                  <>
                    {roots.length > 0 ? (
                      <div
                        className={`od-disc-cats ${roots.length === 1 ? "od-disc-cats--one" : ""}`}
                      >
                        {roots.map((row) => (
                          <Link
                            key={row.slug}
                            href={`/shop/c/${row.slug}`}
                            className="od-disc-cat"
                          >
                            <strong>{row.name}</strong>
                            {row.shortDescription ? (
                              <span>{row.shortDescription}</span>
                            ) : null}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    {featured.length > 0 ? (
                      <div className="od-disc-featured od-shop__grid">
                        {featured.map((card) => (
                          <ShopProductCard
                            key={card.slug}
                            card={card}
                            showWishlist={false}
                          />
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <Reveal>
                    <p className="od-disc-lede">
                      Furniture categories appear here as products are listed.
                    </p>
                  </Reveal>
                )}
              </div>
            </section>
          ) : null}

          {/* Why both verticals share one name. Owns `#about`. */}
          <DiscoveryAbout shopLive={shopLive} />

          {/*
            ONE CLOSING BAND.

            The page used to end with a consultation band AND a final CTA, which
            asked the same thing twice and made neither feel like the decision
            point. This is the single closing invitation, and it is the `#contact`
            destination for every public page's menu.

            `#consultation` stays as an alias on the same section: `/portfolio/
            [slug]` and the Shop nav link to it, and breaking a working anchor to
            save a word is a poor trade.
          */}
          <section
            id="contact"
            className="od-disc-band od-disc-consult od-disc-consult--compact"
            data-od-disc-section="contact"
            aria-labelledby="od-disc-consult-title"
          >
            <span id="consultation" className="od-disc-anchor-alias" aria-hidden="true" />
            <div className="od-disc-shell">
              <Reveal className="od-disc-consult__compact">
                <p className="od-disc-kicker">{DISCOVERY_CONTACT_EYEBROW}</p>
                <h2 id="od-disc-consult-title" className="od-disc-display">
                  <span>{DISCOVERY_CONTACT_HEADLINE}</span>
                </h2>
                <p className="od-disc-lede">{DISCOVERY_CONTACT_LEDE}</p>
                <ul className="od-disc-consult__benefits">
                  <li>Free design consultation</li>
                  <li>Own modular factory</li>
                  <li>Design, manufacturing and installation coordinated</li>
                </ul>
                <div className="od-disc-cta-row">
                  <DiscoveryConsultCta
                    className="od-disc-btn od-disc-btn--primary od-disc-btn--sheen"
                    conversionAction="consultation-band"
                  >
                    {PUBLIC_CONSULTATION.label}
                  </DiscoveryConsultCta>
                  <Link
                    href="/portfolio"
                    className="od-disc-btn od-disc-btn--ghost"
                  >
                    View Portfolio
                  </Link>
                </div>
              </Reveal>
            </div>
          </section>
        </main>
        <DiscoveryWhatsAppFab />
        <DiscoveryStickyCta />
        <PublicSiteFooter shopEnabled={shopLive} />
      </div>
    </LeadConsultationHost>
  );
}
