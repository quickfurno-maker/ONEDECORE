import { PORTFOLIO_SERVICE_LABELS, SLUG_GRAMMAR_REGEX } from "./constants.ts";
import type { PortfolioServiceKey } from "./constants.ts";

export type PortfolioListingParams = {
  page: number;
  service: PortfolioServiceKey | null;
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
}): PortfolioListingParams | null {
  const page = parsePageParam(params.page);
  if (page === null) {
    return null;
  }

  const service = parseServiceParam(params.service);
  if (service === "invalid") {
    return null;
  }

  return { page, service };
}
