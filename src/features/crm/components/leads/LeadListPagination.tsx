import Link from "next/link";
import type { LeadListPaginationMeta, LeadListQuery } from "../../contracts/lead-list-query.ts";

interface LeadListPaginationProps {
  readonly query: LeadListQuery;
  readonly pagination: LeadListPaginationMeta;
}

function buildPageHref(query: LeadListQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.sourceId) params.set("sourceId", query.sourceId);
  if (query.assignment) params.set("assignment", query.assignment);
  if (query.assigneeId) params.set("assigneeId", query.assigneeId);
  if (query.followUpDue) params.set("followUpDue", query.followUpDue);
  if (query.pageSize !== 25) params.set("pageSize", String(query.pageSize));
  if (page > 1) params.set("page", String(page));
  const value = params.toString();
  return value ? `/admin/crm/leads?${value}` : "/admin/crm/leads";
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
