import type { Metadata } from "next";
import { InboxListPane } from "@/features/whatsapp/components/inbox/InboxListPane";
import { WhatsappAccessDenied } from "@/features/whatsapp/components/states/WhatsappAccessDenied";
import { InboxManualRefreshButton } from "@/features/whatsapp/components/inbox/InboxManualRefreshButton";
import "@/features/whatsapp/components/whatsapp-workspace.css";
import {
  buildInboxListQueryString,
  hasInboxListActiveFilters,
  parseInboxListQuery,
  toInboxListPaginationMeta,
} from "@/features/whatsapp/contracts/inbox-list-query";
import { WHATSAPP_ADMIN_INBOX_BASE_PATH } from "@/features/whatsapp/contracts/inbox-surface";
import { getWhatsappInboxAccessContext } from "@/features/whatsapp/server/whatsapp-auth";
import { getWhatsappSendingStatus } from "@/features/whatsapp/server/whatsapp-sending-status";
import { getInboxConversationListPageForCurrentUser } from "@/features/whatsapp/server/whatsapp-inbox-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Inbox | ONEDECORE",
  description:
    "Role-scoped WhatsApp shared inbox for authorized ONEDECORE staff.",
};

interface WhatsappInboxPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WhatsappInboxPage({
  searchParams,
}: WhatsappInboxPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = parseInboxListQuery(resolvedSearchParams);
  const context = await getWhatsappInboxAccessContext();

  /*
   * Unreachable in practice — the layout resolves access first and returns the
   * denied state before this page runs — but `null` would paint a blank screen
   * if that ever changed, and a blank screen reads as a broken deployment.
   */
  if (!context) {
    return <WhatsappAccessDenied />;
  }

  const page = await getInboxConversationListPageForCurrentUser(query);
  const pagination = toInboxListPaginationMeta(page);
  const filtered = hasInboxListActiveFilters(query);

  /*
   * The list route renders the workspace with the chat pane empty.
   *
   * Above 1024px that is the real three-pane frame with a "pick a
   * conversation" prompt in the middle; below it the stylesheet shows only the
   * list, which is the whole screen on a phone. One markup, two behaviours,
   * decided by CSS rather than by a second page.
   */
  const listQueryString = buildInboxListQueryString(query);
  const sending = getWhatsappSendingStatus();

  /*
   * No read acknowledgement here. The list route shows rows; opening a row is
   * what marks it read, and that happens in the conversation route's client
   * bridge after the thread mounts.
   */
  return (
    <div className="od-wa" data-testid="whatsapp-workspace">
      <InboxListPane
        basePath={WHATSAPP_ADMIN_INBOX_BASE_PATH}
        items={page.items}
        query={query}
        pagination={pagination}
        showUnlinkedTriage={context.canManage}
        hasActiveFilters={filtered}
        listQueryString={listQueryString}
        accountNote={<InboxManualRefreshButton />}
        sending={sending}
      />

      <div className="od-wa__pane od-wa__pane--chat od-wa__pane--placeholder">
        <div className="od-wa__empty">
          <p className="od-wa__empty-title">Select a conversation</p>
          <p className="od-wa__empty-note">
            Choose someone on the left to read the conversation and reply.
          </p>
        </div>
      </div>
    </div>
  );
}
