/**
 * WhatsApp inbox conversation list query parsing and pagination contracts.
 */

import {
  WHATSAPP_INBOX_ATTENTION_FILTERS,
  type WhatsappInboxAttentionFilter,
} from "./staff-conversation-state.ts";

export const INBOX_LIST_PAGE_SIZE_DEFAULT = 25;
export const INBOX_LIST_PAGE_SIZE_MAX = 50;
export const INBOX_MESSAGE_PAGE_SIZE_DEFAULT = 50;
export const INBOX_MESSAGE_PAGE_SIZE_MAX = 100;

export const INBOX_LINK_FILTERS = ["all", "linked", "unlinked"] as const;
export type InboxLinkFilter = (typeof INBOX_LINK_FILTERS)[number];

export const INBOX_ATTENTION_DEFAULT: WhatsappInboxAttentionFilter = "all_assigned";

/**
 * The Recently Active window WM-1 ships with.
 *
 * It travels to the database as a parameter rather than living in SQL, so a
 * later settings phase can supply a configured window without a schema change.
 * There is deliberately no setting for it yet.
 */
export const INBOX_RECENT_WINDOW_DAYS_DEFAULT = 7;

export type InboxListQuery = {
  readonly q: string | null;
  readonly linkFilter: InboxLinkFilter;
  readonly attention: WhatsappInboxAttentionFilter;
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

/** Anything unrecognised falls back to the unfiltered queue, never to an error. */
export function parseInboxAttentionFilter(
  raw: string | undefined
): WhatsappInboxAttentionFilter {
  return (WHATSAPP_INBOX_ATTENTION_FILTERS as readonly string[]).includes(raw ?? "")
    ? (raw as WhatsappInboxAttentionFilter)
    : INBOX_ATTENTION_DEFAULT;
}

export function parseInboxListQuery(
  searchParams: Record<string, string | string[] | undefined>
): InboxListQuery {
  const qRaw = searchParams.q;
  const q =
    typeof qRaw === "string" && qRaw.trim().length > 0 ? qRaw.trim() : null;
  const linkRaw =
    typeof searchParams.link === "string" ? searchParams.link : undefined;
  const attentionRaw =
    typeof searchParams.attention === "string"
      ? searchParams.attention
      : undefined;

  return {
    q,
    linkFilter: parseLinkFilter(linkRaw),
    attention: parseInboxAttentionFilter(attentionRaw),
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
  return (
    query.q !== null ||
    query.linkFilter !== "all" ||
    query.attention !== INBOX_ATTENTION_DEFAULT
  );
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

/**
 * The list query as a URL query string.
 *
 * Carried on every conversation link so opening a conversation and coming back
 * lands on the same search, filter and page. Without it a manager who searched,
 * paged to 3 and opened a conversation returns to an unfiltered page 1 — which
 * is how a triage queue gets worked twice.
 *
 * Defaults are omitted rather than written out, so a plain visit keeps a clean
 * URL instead of `?link=all&page=1&pageSize=25`.
 */
export function buildInboxListQueryString(query: InboxListQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.linkFilter !== "all") params.set("link", query.linkFilter);
  if (query.attention !== INBOX_ATTENTION_DEFAULT) {
    params.set("attention", query.attention);
  }
  if (query.page > 1) params.set("page", String(query.page));
  if (query.pageSize !== INBOX_LIST_PAGE_SIZE_DEFAULT) {
    params.set("pageSize", String(query.pageSize));
  }
  return params.toString();
}

/**
 * A list URL on whichever surface mounted the inbox.
 *
 * Changing search, link or attention is a different list, so it starts at
 * page 1: staying on page 3 of "All" after switching to "Unread" lands on an
 * empty page of a two-page queue. Only an explicit `page` keeps a position.
 */
export function buildInboxListHref(
  basePath: string,
  query: InboxListQuery,
  change: Partial<Pick<InboxListQuery, "q" | "linkFilter" | "attention" | "page">> = {}
): string {
  const filterChanged =
    ("q" in change && change.q !== query.q) ||
    ("linkFilter" in change && change.linkFilter !== query.linkFilter) ||
    ("attention" in change && change.attention !== query.attention);

  const next: InboxListQuery = {
    ...query,
    ...change,
    page: change.page ?? (filterChanged ? 1 : query.page),
  };
  const value = buildInboxListQueryString(next);
  return value ? `${basePath}?${value}` : basePath;
}
