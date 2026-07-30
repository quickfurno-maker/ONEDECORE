import Link from "next/link";
import { PortfolioCard } from "./PortfolioCard";
import { PublicPortfolioPaginatedCards } from "../types";
import { PORTFOLIO_SERVICE_LABELS, PortfolioServiceKey } from "../constants";

export interface PortfolioGridProps {
  data: PublicPortfolioPaginatedCards;
}

export function PortfolioGrid({ data }: PortfolioGridProps) {
  const { cards, page, hasNextPage, activeService } = data;

  const buildUrl = (targetPage: number, service?: string | null) => {
    const params = new URLSearchParams();
    if (service) {
      params.set("service", service);
    }
    if (targetPage > 1) {
      params.set("page", targetPage.toString());
    }
    const query = params.toString();
    return query ? `/portfolio?${query}` : "/portfolio";
  };

  return (
    <div id="portfolio-grid-container" className="space-y-8">
      <nav
        id="portfolio-filter-tabs"
        className="od-portfolio-filters"
        aria-label="Filter Portfolio by service"
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
        {(Object.keys(PORTFOLIO_SERVICE_LABELS) as PortfolioServiceKey[]).map(
          (code) => {
            const isActive = activeService === code;
            return (
              <Link
                key={code}
                id={`portfolio-filter-${code}`}
                href={buildUrl(1, code)}
                className="od-filter"
                data-active={isActive ? "" : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                {PORTFOLIO_SERVICE_LABELS[code]}
              </Link>
            );
          }
        )}
      </nav>

      {cards.length > 0 ? (
        <div id="portfolio-cards-grid" className="od-portfolio-grid">
          {cards.map((card, idx) => (
            <PortfolioCard key={card.slug} card={card} eagerImage={idx < 3} />
          ))}
        </div>
      ) : (
        <div id="portfolio-empty-state" className="od-empty">
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
              href={buildUrl(page - 1, activeService)}
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
              href={buildUrl(page + 1, activeService)}
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
