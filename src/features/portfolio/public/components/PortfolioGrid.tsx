import Link from "next/link";
import { PortfolioCard } from "./PortfolioCard";
import { PublicPortfolioPaginatedCards } from "../types";
import { PORTFOLIO_CATEGORIES } from "../portfolio-categories";
import { PUBLIC_CONSULTATION } from "@/features/public-site/chrome/public-nav";

export interface PortfolioGridProps {
  data: PublicPortfolioPaginatedCards;
}

export function PortfolioGrid({ data }: PortfolioGridProps) {
  const { cards, page, hasNextPage, activeService, activeCategory } = data;

  const buildUrl = (
    targetPage: number,
    service?: string | null,
    category?: string | null
  ) => {
    const params = new URLSearchParams();
    if (service) {
      params.set("service", service);
    }
    if (category) {
      params.set("category", category);
    }
    if (targetPage > 1) {
      params.set("page", targetPage.toString());
    }
    const query = params.toString();
    return query ? `/portfolio?${query}` : "/portfolio";
  };

  return (
    <div id="portfolio-grid-container" className="space-y-8">
      {/*
        * The four owner-approved categories, from the same config the homepage
        * cards read, filtering on the real `portfolio_category_code` column.
        *
        * "All Projects" stays first. It is the unfiltered canonical URL, the
        * reset target of the empty state, and — until every project has been
        * classified — the only view that shows unclassified work. Removing it
        * would hide projects rather than organise them.
        */}
      <nav
        id="portfolio-filter-tabs"
        className="od-portfolio-filters"
        aria-label="Filter Portfolio by category"
      >
        <Link
          id="portfolio-filter-all"
          href={buildUrl(1, null)}
          className="od-filter"
          data-active={!activeService ? "" : undefined}
          aria-current={!activeService ? "page" : undefined}
        >
          All Projects
        </Link>
        {PORTFOLIO_CATEGORIES.map((category) => {
          const isActive = activeCategory === category.id;
          return (
            <Link
              key={category.id}
              id={`portfolio-filter-${category.id}`}
              href={buildUrl(1, null, category.id)}
              className="od-filter"
              data-active={isActive ? "" : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              {category.label}
            </Link>
          );
        })}
      </nav>

      {cards.length > 0 ? (
        <div id="portfolio-cards-grid" className="od-portfolio-grid">
          {cards.map((card, idx) => (
            <PortfolioCard key={card.slug} card={card} eagerImage={idx < 3} />
          ))}
        </div>
      ) : (
        <div id="portfolio-empty-state" className="od-empty">
          {/*
            * Two different emptinesses, and only one of them has a way out.
            *
            * A filter that matched nothing is fixed by clearing the filter. An
            * unfiltered portfolio with nothing in it is not — sending that
            * visitor to /portfolio returns them to the page they are already
            * on. They arrived wanting to see work; the honest next step is the
            * consultation, not a link that changes nothing.
            */}
          {activeService ? (
            <>
              <h3>No projects found</h3>
              <p>
                No published interior projects match the selected filter at this
                time.
              </p>
              <div>
                <Link
                  id="portfolio-empty-reset-button"
                  href="/portfolio"
                  className="od-empty__action"
                >
                  View All Projects
                </Link>
              </div>
            </>
          ) : (
            <>
              <h3>Project photography is on its way</h3>
              <p>
                Completed ONEDECORE homes are published here as their
                photography is finished. In the meantime, the fastest way to see
                what we would do with your home is to talk to us about it.
              </p>
              <div>
                <Link
                  id="portfolio-empty-consultation-button"
                  href={PUBLIC_CONSULTATION.href}
                  className="od-empty__action"
                >
                  {PUBLIC_CONSULTATION.label}
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {(page > 1 || hasNextPage) && (
        <nav
          id="portfolio-pagination"
          className="od-pagination"
          aria-label="Portfolio pagination"
        >
          {page > 1 ? (
            <Link
              id="portfolio-prev-page-button"
              href={buildUrl(page - 1, activeService, activeCategory)}
              className="od-page-btn"
            >
              &larr; Previous Page
            </Link>
          ) : (
            <div />
          )}

          <span className="od-page-num">Page {page}</span>

          {hasNextPage ? (
            <Link
              id="portfolio-next-page-button"
              href={buildUrl(page + 1, activeService, activeCategory)}
              className="od-page-btn"
            >
              Next Page &rarr;
            </Link>
          ) : (
            <div />
          )}
        </nav>
      )}
    </div>
  );
}
