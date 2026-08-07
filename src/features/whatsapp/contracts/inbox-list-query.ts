/**
 * WhatsApp inbox conversation list query parsing and pagination contracts.
 */

export const INBOX_LIST_PAGE_SIZE_DEFAULT = 25;
export const INBOX_LIST_PAGE_SIZE_MAX = 50;
export const INBOX_MESSAGE_PAGE_SIZE_DEFAULT = 50;
export const INBOX_MESSAGE_PAGE_SIZE_MAX = 100;

export const INBOX_LINK_FILTERS = ["all", "linked", "unlinked"] as const;
export type InboxLinkFilter = (typeof INBOX_LINK_FILTERS)[number];

export type InboxListQuery = {
  readonly q: string | null;
  readonly linkFilter: InboxLinkFilter;
  readonly page: number;
  readonly pageSize: number;
};

export type InboxListPageResult<T> = {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
};

export type InboxMessageListQuery = {
  readonly conversationId: string;
  readonly page: number;
  readonly pageSize: number;
};

export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  max: number
): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function parseLinkFilter(raw: string | undefined): InboxLinkFilter {
  if (raw === "linked" || raw === "unlinked") {
    return raw;
  }
  return "all";
}

export function parseInboxListQuery(
  searchParams: Record<string, string | string[] | undefined>
): InboxListQuery {
  const qRaw = searchParams.q;
  const q =
    typeof qRaw === "string" && qRaw.trim().length > 0 ? qRaw.trim() : null;
  const linkRaw =
    typeof searchParams.link === "string" ? searchParams.link : undefined;

  return {
    q,
    linkFilter: parseLinkFilter(linkRaw),
    page: parsePositiveInt(
      typeof searchParams.page === "string" ? searchParams.page : undefined,
      1,
      10_000
    ),
    pageSize: parsePositiveInt(
      typeof searchParams.pageSize === "string"
        ? searchParams.pageSize
        : undefined,
      INBOX_LIST_PAGE_SIZE_DEFAULT,
      INBOX_LIST_PAGE_SIZE_MAX
    ),
  };
}

export function parseInboxMessageListQuery(
  conversationId: string,
  searchParams: Record<string, string | string[] | undefined> = {}
): InboxMessageListQuery {
  return {
    conversationId,
    page: parsePositiveInt(
      typeof searchParams.page === "string" ? searchParams.page : undefined,
      1,
      10_000
    ),
    pageSize: parsePositiveInt(
      typeof searchParams.pageSize === "string"
        ? searchParams.pageSize
        : undefined,
      INBOX_MESSAGE_PAGE_SIZE_DEFAULT,
      INBOX_MESSAGE_PAGE_SIZE_MAX
    ),
  };
}

export function hasInboxListActiveFilters(query: InboxListQuery): boolean {
  return query.q !== null || query.linkFilter !== "all";
}

export type InboxListPaginationMeta = {
  readonly page: number;
  readonly totalPages: number;
  readonly hasPreviousPage: boolean;
  readonly hasNextPage: boolean;
};

export function toInboxListPaginationMeta(
  result: InboxListPageResult<unknown>
): InboxListPaginationMeta {
  return {
    page: result.page,
    totalPages: result.totalPages,
    hasPreviousPage: result.page > 1,
    hasNextPage: result.page < result.totalPages,
  };
}
