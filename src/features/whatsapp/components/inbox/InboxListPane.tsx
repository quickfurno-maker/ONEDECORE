import type { ReactNode } from "react";
import { InboxAttentionFilters } from "./InboxAttentionFilters.tsx";
import { InboxConversationList } from "./InboxConversationList.tsx";
import { InboxLinkFilters } from "./InboxLinkFilters.tsx";
import { InboxListPagination } from "./InboxListPagination.tsx";
import { InboxSearchForm } from "./InboxSearchForm.tsx";
import type { InboxConversationListItem } from "../../contracts/conversation-dtos.ts";
import type {
  InboxListPaginationMeta,
  InboxListQuery,
} from "../../contracts/inbox-list-query.ts";
import type { SendingStatusView } from "../../contracts/sending-status.ts";

/**
 * The left pane: search, filters, conversations.
 *
 * Rendered by BOTH routes — the list and the conversation — because in a
 * three-pane workspace the list does not disappear when you open a
 * conversation. It is one component so the two routes cannot drift into
 * showing slightly different lists, which is what happens when a layout is
 * copied into two pages.
 *
 * Below 1024px the stylesheet hides whichever pane the route is not about, so
 * the same markup serves the phone as one screen at a time.
 *
 * `basePath` is the surface it is mounted on. The pane never assumes /admin:
 * every link it draws — filters, pages, conversations, the search form — is
 * built from it, so another staff surface can mount the same pane.
 */

interface InboxListPaneProps {
  /** Where this inbox lives, e.g. `WHATSAPP_ADMIN_INBOX_BASE_PATH`. */
  readonly basePath: string;
  readonly items: readonly InboxConversationListItem[];
  readonly query: InboxListQuery;
  readonly pagination: InboxListPaginationMeta;
  readonly showUnlinkedTriage: boolean;
  readonly hasActiveFilters: boolean;
  readonly selectedId?: string | null;
  readonly listQueryString?: string;
  /** Account status, shown once at the top of the workspace. */
  readonly accountNote?: ReactNode;
  /** How this deployment sends. Type only — the value is read on the server. */
  readonly sending?: SendingStatusView | null;
}

export function InboxListPane({
  basePath,
  items,
  query,
  pagination,
  showUnlinkedTriage,
  hasActiveFilters,
  selectedId = null,
  listQueryString = "",
  accountNote,
  sending = null,
}: InboxListPaneProps) {
  return (
    <div className="od-wa__pane od-wa__pane--list" data-testid="whatsapp-list-pane">
      <div className="od-wa__head">
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <h1 className="od-wa__head-title">WhatsApp</h1>
          <p className="od-wa__head-sub">
            {pagination.totalPages > 0
              ? `${items.length} shown · page ${pagination.page} of ${pagination.totalPages}`
              : "No conversations"}
          </p>
        </div>
        {accountNote}
      </div>

      {/*
        Stated once, at the top, when a reply would not actually arrive.

        In "enabled" this row is absent: the normal case needs no banner, and a
        notice that is always on screen is a notice nobody reads.
      */}
      {sending && !sending.reaches ? (
        <p
          className="od-wa__mode"
          data-tone={sending.tone}
          role="status"
          title={sending.detail}
        >
          <span className="od-wa__mode-dot" aria-hidden="true" />
          <strong>{sending.label}</strong>
          <span>{sending.detail}</span>
        </p>
      ) : null}

      <InboxSearchForm query={query} basePath={basePath} />
      <InboxAttentionFilters query={query} basePath={basePath} />
      <InboxLinkFilters
        query={query}
        showUnlinkedTriage={showUnlinkedTriage}
        basePath={basePath}
      />

      {items.length === 0 ? (
        <div className="od-wa__empty">
          <p className="od-wa__empty-title">
            {hasActiveFilters ? "Nothing matches" : "No conversations yet"}
          </p>
          <p className="od-wa__empty-note">
            {hasActiveFilters
              ? "No conversation matches this search or filter. Clear them to see everything you have access to."
              : "Conversations appear here when a customer messages the ONEDECORE WhatsApp number, and once you are assigned the matching lead."}
          </p>
          {pagination.totalPages > 0 && pagination.page > pagination.totalPages ? (
            <p className="od-wa__empty-note">
              This page is past the end of the list, which is now {pagination.totalPages}{" "}
              {pagination.totalPages === 1 ? "page" : "pages"} long.
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="od-wa__scroll">
            <InboxConversationList
              items={items}
              selectedId={selectedId}
              listQueryString={listQueryString}
              basePath={basePath}
            />
          </div>
          <div style={{ flex: "none", padding: "8px 12px" }}>
            <InboxListPagination query={query} pagination={pagination} basePath={basePath} />
          </div>
        </>
      )}
    </div>
  );
}
