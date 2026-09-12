import Image from "next/image";
import Link from "next/link";
import { PORTFOLIO_VIEWS } from "@/features/portfolio/public/portfolio-rooms";
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
 * The four views, their labels and their URLs all come from `PORTFOLIO_VIEWS`
 * — the same file the portfolio page reads — so a chip here and a tab there can
 * never disagree about what "Bedroom" means or where it goes.
 *
 * KITCHEN | LIVING ROOM | BEDROOM | PROJECTS
 *
 * There is no Hall. It read as "Hall / Living Room", which asked a visitor to
 * decide which word described their own room; Living Room is now the single
 * public term, in the database allowlists as well as here.
 *
 * THE IMAGES ARE ART DIRECTION, NOT EVIDENCE
 *
 * These tiles are navigation. The artwork on them is ONEDECORE marketing
 * artwork and is marked decorative, so the visible title does the describing —
 * a card must never imply that its picture is a delivered project. The real
 * photographs live behind the link.
 */
/**
 * Which artwork sits behind each navigation tile.
 *
 * Kept here rather than in `portfolio-rooms.ts` because it is a homepage
 * presentation choice, not part of the portfolio vocabulary — the portfolio
 * page renders the same four views with no artwork at all.
 */
const VIEW_ARTWORK = {
  projects: "completeHomeInteriors",
  "living-room": "hero",
  bedroom: "oakJoinery",
  kitchen: "modularKitchens",
} as const;

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
        {PORTFOLIO_VIEWS.map((view, index) => {
          const asset = getDiscoveryAsset(VIEW_ARTWORK[view.id]);
          return (
            <Reveal
              key={view.id}
              order={index}
              as="li"
              className="od-disc-cats-nav__item"
            >
              <Link
                href={view.href}
                className="od-disc-cats-nav__card"
                data-conversion-action={`portfolio-view-${view.id}`}
                data-od-portfolio-view={view.id}
              >
                <span className="od-disc-cats-nav__media">
                  {/*
                    Always decorative. This is marketing artwork behind a
                    navigation label, and captioning it as the room would state
                    that ONEDECORE delivered the pictured room, which is exactly
                    the claim the asset register forbids.
                  */}
                  <Image
                    src={asset.path}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 72vw, 25vw"
                    style={{ objectPosition: asset.focalPoint }}
                    loading="lazy"
                  />
                </span>
                <span className="od-disc-cats-nav__foot">
                  <span className="od-disc-cats-nav__label">{view.label}</span>
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
