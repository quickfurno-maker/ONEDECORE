import { PORTFOLIO_SERVICE_LABELS, SLUG_GRAMMAR_REGEX } from "./constants.ts";
import type { PortfolioServiceKey } from "./constants.ts";
import {
  isPortfolioCategoryId,
  type PortfolioCategoryId,
} from "./portfolio-categories.ts";

export type PortfolioListingParams = {
  page: number;
  service: PortfolioServiceKey | null;
  category: PortfolioCategoryId | null;
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

  return { page, service, category };
}
