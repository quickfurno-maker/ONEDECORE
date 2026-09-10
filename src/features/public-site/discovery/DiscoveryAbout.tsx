import Link from "next/link";
import { Reveal } from "@/features/public-site/motion/Reveal";
import {
  DISCOVERY_ABOUT_EYEBROW,
  DISCOVERY_ABOUT_HEADLINE,
  DISCOVERY_ABOUT_LEDE,
  DISCOVERY_ABOUT_POINTS,
} from "./discovery-copy";

/**
 * Why interiors and furniture share one name — the `#about` destination.
 *
 * WHAT THIS IS NOT
 *
 * It is not the interior USP block again. That one, higher up the page, argues
 * that ONEDECORE can do interior work: own factory, direct manufacturing, free
 * consultation. Restating those here as brand values would be the same page
 * saying the same thing twice in a different font.
 *
 * This one answers a narrower question: why is furniture on the same site at
 * all? The honest answer is that they are two separate journeys kept
 * deliberately separate, run by one company with one view of material and
 * proportion — so that is what it says.
 *
 * WHAT IT DELIBERATELY DOES NOT CLAIM
 *
 * No bundling. Buying a piece of furniture does not come with a designer, and
 * an interior project does not come with the shop catalogue's delivery terms.
 * Implying either would be inventing a product that does not exist, and it is
 * the kind of implication a visitor only discovers is untrue after they have
 * paid.
 *
 * `#about` lands here from every public page. `scroll-margin-top` in
 * `discovery.css` keeps the heading clear of the sticky header.
 */
export function DiscoveryAbout({ shopLive }: { readonly shopLive: boolean }) {
  /*
   * The furniture half is dropped when the Shop gate is off, rather than shown
   * with a dead link. What remains still reads as a complete thought: the brand
   * paragraph does not depend on the second card existing.
   */
  const points = shopLive
    ? DISCOVERY_ABOUT_POINTS
    : DISCOVERY_ABOUT_POINTS.filter((point) => point.id !== "furniture");

  return (
    <section
      id="about"
      className="od-disc-band od-disc-band--ivory od-disc-about"
      data-od-disc-section="about"
      aria-labelledby="od-disc-about-title"
    >
      <div className="od-disc-shell">
        <Reveal as="header" className="od-disc-band__head">
          <p className="od-disc-kicker">{DISCOVERY_ABOUT_EYEBROW}</p>
          <h2 id="od-disc-about-title" className="od-disc-display">
            {DISCOVERY_ABOUT_HEADLINE.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          <p className="od-disc-lede od-disc-about__lede">
            {DISCOVERY_ABOUT_LEDE}
          </p>
        </Reveal>

        <div
          className={`od-disc-about__grid ${points.length === 1 ? "od-disc-about__grid--one" : ""}`}
        >
          {points.map((point, index) => (
            <Reveal
              key={point.id}
              order={index}
              as="article"
              className="od-disc-about__item"
            >
              <h3>{point.title}</h3>
              <p>{point.body}</p>
              <Link href={point.href} className="od-disc-about__link">
                {point.cta}
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
