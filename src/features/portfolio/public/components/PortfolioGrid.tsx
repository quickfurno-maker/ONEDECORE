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
      {/* Service Filter Allowlist Tabs */}
      <div
        id="portfolio-filter-tabs"
        className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-4 dark:border-neutral-800"
      >
        <Link
          id="portfolio-filter-all"
          href={buildUrl(1, null)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            !activeService
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          }`}
        >
          All Projects
        </Link>
        {(Object.keys(PORTFOLIO_SERVICE_LABELS) as PortfolioServiceKey[]).map((code) => {
          const isActive = activeService === code;
          return (
            <Link
              key={code}
              id={`portfolio-filter-${code}`}
              href={buildUrl(1, code)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              }`}
            >
              {PORTFOLIO_SERVICE_LABELS[code]}
            </Link>
          );
        })}
      </div>

      {/* Cards Grid */}
      {cards.length > 0 ? (
        <div
          id="portfolio-cards-grid"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {cards.map((card, idx) => (
            <PortfolioCard key={card.slug} card={card} eagerImage={idx < 3} />
          ))}
        </div>
      ) : (
        <div
          id="portfolio-empty-state"
          className="rounded-xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-800"
        >
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            No projects found
          </h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            No published interior projects match the selected filter at this time.
          </p>
          <div className="mt-6">
            <Link
              id="portfolio-empty-reset-button"
              href="/portfolio"
              className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              View All Projects
            </Link>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {(page > 1 || hasNextPage) && (
        <nav
          id="portfolio-pagination"
          className="flex items-center justify-between border-t border-neutral-200 pt-6 dark:border-neutral-800"
          aria-label="Portfolio pagination"
        >
          {page > 1 ? (
            <Link
              id="portfolio-prev-page-button"
              href={buildUrl(page - 1, activeService)}
              className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              &larr; Previous Page
            </Link>
          ) : (
            <div />
          )}

          <span className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">
            Page {page}
          </span>

          {hasNextPage ? (
            <Link
              id="portfolio-next-page-button"
              href={buildUrl(page + 1, activeService)}
              className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
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
