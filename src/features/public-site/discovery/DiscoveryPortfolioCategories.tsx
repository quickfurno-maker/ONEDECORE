import Image from "next/image";
import Link from "next/link";
import {
  PORTFOLIO_CATEGORIES,
  portfolioCategoryHref,
} from "@/features/portfolio/public/portfolio-categories";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { getDiscoveryAsset } from "./discovery-assets";
import {
  DISCOVERY_CATEGORIES_EYEBROW,
  DISCOVERY_CATEGORIES_HEADLINE,
} from "./discovery-copy";

/**
 * Portfolio category navigation, directly below the proof strip.
 *
 * This is the page's first interaction point: a visitor who already knows what
 * they want can leave for the work instead of scrolling past six sections of
 * argument first.
 *
 * The categories, their labels, their service mapping and their imagery all
 * come from `PORTFOLIO_CATEGORIES` — the same file the portfolio page reads —
 * so a chip here and a chip there can never disagree about what "Bedroom"
 * means or where it goes.
 *
 * `depictsCategory: false` marks the image decorative and lets the visible
 * title describe the card. Two of the four categories have no photograph of
 * their own; borrowing another room's would be a false depiction.
 */
export function DiscoveryPortfolioCategories() {
  return (
    <section
      className="od-disc-band od-disc-band--neutral od-disc-cats-nav"
      data-od-disc-section="portfolio-categories"
      aria-labelledby="od-disc-cats-title"
    >
      <div className="od-disc-shell">
        <Reveal as="header" className="od-disc-band__head">
          <p className="od-disc-kicker">{DISCOVERY_CATEGORIES_EYEBROW}</p>
          <h2 id="od-disc-cats-title" className="od-disc-display">
            <span>{DISCOVERY_CATEGORIES_HEADLINE}</span>
          </h2>
        </Reveal>
      </div>

      <ul
        className="od-disc-cats-nav__rail"
        data-od-category-rail=""
        aria-label="Portfolio categories"
      >
        {PORTFOLIO_CATEGORIES.map((category, index) => {
          const asset = getDiscoveryAsset(category.assetKey);
          return (
            <Reveal
              key={category.id}
              order={index}
              as="li"
              className="od-disc-cats-nav__item"
            >
              <Link
                href={portfolioCategoryHref(category)}
                className="od-disc-cats-nav__card"
                data-conversion-action={`portfolio-category-${category.id}`}
              >
                <span className="od-disc-cats-nav__media">
                  <Image
                    src={asset.path}
                    alt={category.depictsCategory ? asset.alt : ""}
                    fill
                    sizes="(max-width: 768px) 72vw, 25vw"
                    style={{ objectPosition: asset.focalPoint }}
                    loading="lazy"
                  />
                </span>
                <span className="od-disc-cats-nav__foot">
                  <span className="od-disc-cats-nav__label">{category.label}</span>
                  <span className="od-disc-cats-nav__arrow" aria-hidden="true">
                    →
                  </span>
                </span>
              </Link>
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}
