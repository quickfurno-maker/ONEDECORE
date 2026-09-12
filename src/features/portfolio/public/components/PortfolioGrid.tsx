import Link from "next/link";
import { PortfolioCard } from "./PortfolioCard";
import { PublicPortfolioPaginatedCards } from "../types";
import { PORTFOLIO_PROJECTS_HREF } from "../portfolio-rooms";
import { PUBLIC_CONSULTATION } from "@/features/public-site/chrome/public-nav";

export interface PortfolioGridProps {
  data: PublicPortfolioPaginatedCards;
}

/**
 * The Projects listing: real published case studies, and nothing else.
 *
 * ONE PUBLIC NAVIGATION ROW, NOT TWO
 *
 * This component used to render its own category rail — `All Projects |
 * Complete Interiors | Kitchen | Living Room | Bedroom` — directly beneath the
 * `Kitchen | Living Room | Bedroom | Projects` tabs. Two rows, three shared
 * labels, and no way for a visitor to tell what the difference between the two
 * "Kitchen"s was, because there was not a meaningful one: the rooms are browsed
 * from the tabs above. The rail is gone from the page.
 *
 * Nothing behind it was deleted. `portfolio_category_code`, the classification
 * and `?category=` parsing all still work — an old link is still honoured and
 * still redirects to its canonical `?view=` address. What is gone is the second
 * visible control, not the data model underneath it.
 *
 * EVERY URL THIS BUILDS NAMES ITS VIEW
 *
 * `/portfolio` means Kitchen now. A pagination link that dropped back to the
 * bare path would therefore send a visitor on page 2 of the projects listing
 * into the kitchen photographs, so `view=projects` is set unconditionally
 * rather than only when some other parameter happens to be present.
 */
export function PortfolioGrid({ data }: PortfolioGridProps) {
  const { cards, page, hasNextPage, activeService, activeCategory } = data;

  const buildUrl = (
    targetPage: number,
    service?: string | null,
    category?: string | null
  ) => {
    const params = new URLSearchParams();
    params.set("view", "projects");
    if (service) {
      params.set("service", service);
    }
    if (category) {
      params.set("category", category);
    }
    if (targetPage > 1) {
      params.set("page", targetPage.toString());
    }
    return `/portfolio?${params.toString()}`;
  };

  return (
    <div id="portfolio-grid-container" className="space-y-8">
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
                  href={PORTFOLIO_PROJECTS_HREF}
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
