import Image from "next/image";
import Link from "next/link";
import { PM_ASSETS } from "@/features/public-site/home-r4/content";
import { R5_PORTFOLIO_COPY, REFERENCE_IMAGERY_NOTE } from "../content";

/**
 * Portfolio — one door, not a second gallery.
 *
 * WHY THERE ARE NO THUMBNAILS HERE
 *
 * The obvious version of this section is a rail of project cards. It would have
 * been wrong twice over: it duplicates `/portfolio`, so the two drift the first
 * time a project is added to one of them; and every thumbnail would have been
 * category-C marketing artwork standing in for work that genuinely exists and
 * genuinely has approved photography — on the portfolio page.
 *
 * So this is a single visual that says "the real work is through here", and the
 * caption is honest about what the visual itself is.
 *
 * The whole card is the link. One target, one focus stop, one thing to announce
 * — rather than an image, a heading and a button that all go to the same place.
 */
export function R5Portfolio() {
  return (
    <section className="r5-section r5-section--tinted" aria-labelledby="r5-portfolio-title">
      <div className="dc-container">
        <header className="r5-head">
          <p className="r5-eyebrow">{R5_PORTFOLIO_COPY.eyebrow}</p>
          <h2 id="r5-portfolio-title" className="r5-heading">
            {R5_PORTFOLIO_COPY.heading}
          </h2>
          <p className="r5-supporting">{R5_PORTFOLIO_COPY.supporting}</p>
        </header>

        <Link
          href={R5_PORTFOLIO_COPY.href}
          className="r5-portfolio"
          data-conversion-action="portfolio-view"
        >
          <div className="r5-portfolio__media">
            <Image
              src={PM_ASSETS.dusk.path}
              alt=""
              width={1440}
              height={900}
              sizes="(min-width: 1240px) 1200px, 92vw"
              loading="lazy"
              quality={75}
            />
            {/*
              The scrim carries the call to action, so the link has a visible
              label without a second control sitting beside it.
            */}
            <span className="r5-portfolio__scrim">
              <span className="r5-portfolio__cta">
                {R5_PORTFOLIO_COPY.cta}
                <span className="r5-portfolio__arrow" aria-hidden="true">
                  &rarr;
                </span>
              </span>
            </span>
          </div>
        </Link>

        <p className="r5-note">{REFERENCE_IMAGERY_NOTE}</p>
      </div>
    </section>
  );
}
