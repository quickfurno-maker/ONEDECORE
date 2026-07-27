import Link from "next/link";
import { FEATURED_PORTFOLIO_COPY } from "../content/featured-portfolio";
import { PortfolioCard } from "./PortfolioCard";
import { getFeaturedProjects } from "../public-portfolio-cache";
import type { PublicPortfolioCard } from "../types";

export { FEATURED_PORTFOLIO_COPY };

function layoutClass(count: number): string {
  if (count <= 0) return "ps-featured-grid--empty";
  if (count === 1) return "ps-featured-grid--one";
  if (count === 2) return "ps-featured-grid--two";
  if (count === 3) return "ps-featured-grid--three";
  return "ps-featured-grid--many";
}

function FeaturedEmptyState() {
  return (
    <div id="featured-empty-state" className="ps-featured-empty">
      <h3 className="ps-type-heading-3 ps-featured-empty__title">
        {FEATURED_PORTFOLIO_COPY.emptyHeading}
      </h3>
      <p className="ps-type-body ps-featured-empty__body">{FEATURED_PORTFOLIO_COPY.emptyBody}</p>
      <Link
        id="featured-empty-cta-button"
        href="/portfolio"
        className="ps-featured-empty__cta"
      >
        {FEATURED_PORTFOLIO_COPY.exploreLabel}
        <span aria-hidden="true"> →</span>
      </Link>
    </div>
  );
}

function FeaturedGrid({ cards }: { cards: PublicPortfolioCard[] }) {
  return (
    <div
      id="featured-cards-grid"
      className={`ps-featured-grid ${layoutClass(cards.length)}`}
      data-count={cards.length}
    >
      {cards.map((card, idx) => (
        <div
          key={card.slug}
          className={`ps-featured-grid__item ps-featured-grid__item--${idx + 1}`}
        >
          <PortfolioCard
            card={card}
            eagerImage={idx < 3}
            variant="featuredEditorial"
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Homepage featured portfolio — editorial presentation only.
 * Data contract: single getFeaturedProjects() call; DTO/cache/repo unchanged.
 */
export async function FeaturedPortfolioSection() {
  const featuredCards = await getFeaturedProjects();

  return (
    <section
      id="featured-portfolio-section"
      className="ps-featured"
      aria-labelledby="featured-portfolio-heading"
    >
      <div className="ps-featured__inner">
        <header className="ps-featured__header">
          <div className="ps-featured__intro">
            <p className="ps-type-overline">{FEATURED_PORTFOLIO_COPY.overline}</p>
            <h2 id="featured-portfolio-heading" className="ps-type-heading-2">
              {FEATURED_PORTFOLIO_COPY.heading}
            </h2>
            <p className="ps-type-body ps-featured__description">
              {FEATURED_PORTFOLIO_COPY.description}
            </p>
          </div>
          <Link
            id="featured-view-all-link"
            href="/portfolio"
            className="ps-featured__explore"
          >
            {FEATURED_PORTFOLIO_COPY.exploreLabel}
            <span aria-hidden="true"> →</span>
          </Link>
        </header>

        {featuredCards.length > 0 ? (
          <FeaturedGrid cards={featuredCards} />
        ) : (
          <FeaturedEmptyState />
        )}
      </div>
    </section>
  );
}
