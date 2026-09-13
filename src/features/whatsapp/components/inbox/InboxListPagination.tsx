import Link from "next/link";
import {
  buildInboxListHref,
  type InboxListPaginationMeta,
  type InboxListQuery,
} from "../../contracts/inbox-list-query.ts";

interface InboxListPaginationProps {
  readonly query: InboxListQuery;
  readonly pagination: InboxListPaginationMeta;
  readonly basePath: string;
}

export function InboxListPagination({
  query,
  pagination,
  basePath,
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
            href={buildInboxListHref(basePath, query, { page: pagination.page - 1 })}
            className="od-wa__btn od-wa__btn--quiet"
          >
            Previous
          </Link>
        ) : null}
        {pagination.hasNextPage ? (
          <Link
            href={buildInboxListHref(basePath, query, { page: pagination.page + 1 })}
            className="od-wa__btn od-wa__btn--quiet"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
