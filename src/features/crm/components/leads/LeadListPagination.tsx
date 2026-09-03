import Link from "next/link";
import {
  buildLeadListHref,
  type LeadListPaginationMeta,
  type LeadListQuery,
} from "../../contracts/lead-list-query.ts";

interface LeadListPaginationProps {
  readonly query: LeadListQuery;
  readonly pagination: LeadListPaginationMeta;
}

/**
 * Delegates to the canonical URL builder.
 *
 * This used to be a second, hand-maintained copy of the query-string logic. It
 * knew nothing about the sales bucket or the received month, so paging would
 * have silently dropped both — landing the reader on page 2 of a different
 * cohort than the one they were looking at.
 */
function buildPageHref(query: LeadListQuery, page: number): string {
  return buildLeadListHref(query, undefined, { page });
}

export function LeadListPagination({
  query,
  pagination,
}: LeadListPaginationProps) {
  if (!pagination.hasPreviousPage && !pagination.hasNextPage) {
    return null;
  }

  return (
    <nav
      aria-label="Lead list pagination"
      className="flex items-center justify-between gap-3 border-t border-[var(--od-border)] pt-4"
    >
      <p className="text-sm text-[var(--od-muted)]">
        Page {pagination.page}
      </p>
      <div className="flex gap-2">
        {pagination.hasPreviousPage ? (
          <Link
            href={buildPageHref(query, pagination.page - 1)}
            className="crm-btn crm-btn-secondary min-h-11"
          >
            Previous
          </Link>
        ) : null}
        {pagination.hasNextPage ? (
          <Link
            href={buildPageHref(query, pagination.page + 1)}
            className="crm-btn crm-btn-secondary min-h-11"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
