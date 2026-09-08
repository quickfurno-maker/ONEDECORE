import { PORTFOLIO_SERVICE_LABELS, SLUG_GRAMMAR_REGEX } from "./constants.ts";
import type { PortfolioServiceKey } from "./constants.ts";
import {
  isPortfolioCategoryId,
  type PortfolioCategoryId,
} from "./portfolio-categories.ts";
import {
  PORTFOLIO_DEFAULT_VIEW,
  isPortfolioViewCode,
  isPortfolioRoomCode,
  type PortfolioViewCode,
} from "./portfolio-rooms.ts";

export type PortfolioListingParams = {
  page: number;
  service: PortfolioServiceKey | null;
  category: PortfolioCategoryId | null;
  /** Resolved browse view. Absent `?view=` resolves to `projects`. */
  view: PortfolioViewCode;
};

/**
 * Public request validation for the Portfolio routes.
 *
 * These helpers are intentionally pure and live outside the Proxy so the 404
 * contract is enforced by the routes themselves and stays testable without a
 * running server.
 */

export function parsePageParam(raw: string | undefined): number | null {
  if (raw === undefined) {
    return 1;
  }

  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const page = Number.parseInt(raw, 10);

  return page >= 1 ? page : null;
}

export function parseServiceParam(
  raw: string | undefined
): PortfolioServiceKey | null | "invalid" {
  if (raw === undefined || raw.trim().length === 0) {
    return null;
  }

  // Object.hasOwn, not `in`: `in` walks the prototype chain and would accept
  // "__proto__", "constructor" and "toString" as service codes.
  return Object.hasOwn(PORTFOLIO_SERVICE_LABELS, raw)
    ? (raw as PortfolioServiceKey)
    : "invalid";
}

export function parseCategoryParam(
  raw: string | undefined
): PortfolioCategoryId | null | "invalid" {
  if (raw === undefined || raw.trim().length === 0) {
    return null;
  }
  return isPortfolioCategoryId(raw) ? raw : "invalid";
}

/**
 * `?view=` is the canonical public navigation.
 *
 * Absent means Projects, which is why the default view carries no query
 * parameter at all — one canonical URL for the default listing rather than
 * `/portfolio` and `/portfolio?view=projects` both answering.
 */
export function parseViewParam(
  raw: string | undefined
): PortfolioViewCode | "invalid" {
  if (raw === undefined || raw.trim().length === 0) {
    return PORTFOLIO_DEFAULT_VIEW;
  }
  return isPortfolioViewCode(raw) ? raw : "invalid";
}

export function isValidPortfolioSlug(slug: string | undefined): boolean {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= 120 &&
    SLUG_GRAMMAR_REGEX.test(slug)
  );
}

/**
 * Returns null when either parameter is unusable so the caller can render a
 * 404 instead of silently falling back to page 1 or an unfiltered listing.
 */
export function parseListingParams(params: {
  page?: string;
  service?: string;
  category?: string;
  view?: string;
}): PortfolioListingParams | null {
  const page = parsePageParam(params.page);
  if (page === null) {
    return null;
  }

  const service = parseServiceParam(params.service);
  if (service === "invalid") {
    return null;
  }

  /*
   * `?category=` is the room taxonomy and `?service=` is the sold service. Both
   * are accepted and both 404 on an unknown value; nothing stops a caller
   * combining them, and combining them simply intersects.
   */
  const category = parseCategoryParam(params.category);
  if (category === "invalid") {
    return null;
  }

  const view = parseViewParam(params.view);
  if (view === "invalid") {
    return null;
  }

  /*
   * `?category=` PREDATES `?view=` and is kept working, but the two must not
   * disagree. `?view=bedroom&category=kitchen` states two different intentions
   * about the same listing and there is no defensible way to pick one, so it is
   * refused rather than silently resolved in whichever order the code happens
   * to read them.
   *
   * A legacy `?category=` on its own is normalised onto the view it means. The
   * page then redirects to the canonical `?view=` URL, so the old links keep
   * working without becoming a second address for the same content.
   */
  if (category !== null) {
    const legacyView = legacyCategoryAsView(category);
    if (view !== PORTFOLIO_DEFAULT_VIEW && view !== legacyView) {
      return null;
    }
    return { page, service, category, view: legacyView ?? view };
  }

  return { page, service, category, view };
}

/**
 * The view a legacy `?category=` value meant.
 *
 * `complete-interiors` was the whole-home facet, which is what Projects is, so
 * it maps to the default view. The room categories map to their room views.
 * Hall is gone from the category vocabulary entirely — the migration translated
 * it to living-room — so there is nothing here to translate.
 */
export function legacyCategoryAsView(
  category: PortfolioCategoryId
): PortfolioViewCode {
  return isPortfolioRoomCode(category) ? category : PORTFOLIO_DEFAULT_VIEW;
}
