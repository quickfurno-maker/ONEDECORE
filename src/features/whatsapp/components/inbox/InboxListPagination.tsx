import Link from "next/link";
import type {
  InboxListPaginationMeta,
  InboxListQuery,
} from "../../contracts/inbox-list-query.ts";

interface InboxListPaginationProps {
  readonly query: InboxListQuery;
  readonly pagination: InboxListPaginationMeta;
}

function buildPageHref(query: InboxListQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.linkFilter !== "all") params.set("link", query.linkFilter);
  if (query.pageSize !== 25) params.set("pageSize", String(query.pageSize));
  if (page > 1) params.set("page", String(page));
  const value = params.toString();
  return value ? `/admin/whatsapp/inbox?${value}` : "/admin/whatsapp/inbox";
}

export function InboxListPagination({
  query,
  pagination,
}: InboxListPaginationProps) {
  if (!pagination.hasPreviousPage && !pagination.hasNextPage) {
    return null;
  }

  return (
    <nav
      aria-label="Inbox pagination"
      className="od-wa__pager"
    >
      <p className="od-wa__pager-label">
        Page {pagination.page} of {pagination.totalPages}
      </p>
      <div className="od-wa__pager-actions">
        {pagination.hasPreviousPage ? (
          <Link
            href={buildPageHref(query, pagination.page - 1)}
            className="od-wa__btn od-wa__btn--quiet"
          >
            Previous
          </Link>
        ) : null}
        {pagination.hasNextPage ? (
          <Link
            href={buildPageHref(query, pagination.page + 1)}
            className="od-wa__btn od-wa__btn--quiet"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
