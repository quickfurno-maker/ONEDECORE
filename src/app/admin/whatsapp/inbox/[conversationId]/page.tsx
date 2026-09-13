import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConversationDetailsPanel } from "@/features/whatsapp/components/inbox/ConversationDetailsPanel";
import { ConversationHeader } from "@/features/whatsapp/components/inbox/ConversationHeader";
import { InboxComposerSection } from "@/features/whatsapp/components/inbox/InboxComposerSection";
import { InboxListPane } from "@/features/whatsapp/components/inbox/InboxListPane";
import { InboxManualRefreshButton } from "@/features/whatsapp/components/inbox/InboxManualRefreshButton";
import { InboxThread } from "@/features/whatsapp/components/inbox/InboxThread";
import { WhatsappAccessDenied } from "@/features/whatsapp/components/states/WhatsappAccessDenied";
import "@/features/whatsapp/components/whatsapp-workspace.css";
import {
  buildInboxListQueryString,
  hasInboxListActiveFilters,
  parseInboxListQuery,
  parseInboxMessageListQuery,
  toInboxListPaginationMeta,
} from "@/features/whatsapp/contracts/inbox-list-query";
import { presentServiceWindow } from "@/features/whatsapp/contracts/message-presentation";
import { getWhatsappInboxAccessContext } from "@/features/whatsapp/server/whatsapp-auth";
import { getWhatsappSendingStatus } from "@/features/whatsapp/server/whatsapp-sending-status";
import { canCurrentUserAccessConversation } from "@/features/whatsapp/server/whatsapp-inbox-queries";
import {
  getInboxConversationDetailForCurrentUser,
  getInboxConversationListPageForCurrentUser,
} from "@/features/whatsapp/server/whatsapp-inbox-repository";
import { loadConversationLeadSummary } from "@/features/whatsapp/server/conversation-lead-summary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WhatsApp Conversation | ONEDECORE",
};

interface WhatsappConversationPageProps {
  readonly params: Promise<{ conversationId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WhatsappConversationPage({
  params,
  searchParams,
}: WhatsappConversationPageProps) {
  const { conversationId } = await params;
  const resolvedSearchParams = await searchParams;
  const detailsRaw = resolvedSearchParams.details;
  const showDetails = typeof detailsRaw === "string" && detailsRaw === "1";
  const messageQuery = parseInboxMessageListQuery(conversationId, resolvedSearchParams);
  const listQuery = parseInboxListQuery(resolvedSearchParams);
  const context = await getWhatsappInboxAccessContext();

  /* See the list route: the layout has already refused, so this is a guard
     against a blank screen rather than a branch anyone reaches. */
  if (!context) {
    return <WhatsappAccessDenied />;
  }

  const canRead = await canCurrentUserAccessConversation(conversationId, "read");
  if (!canRead) {
    notFound();
  }

  const detail = await getInboxConversationDetailForCurrentUser(conversationId, messageQuery);

  if (!detail) {
    notFound();
  }

  const canUse = await canCurrentUserAccessConversation(conversationId, "use");

  /*
   * The list is fetched here as well, because the left pane does not vanish
   * when a conversation opens. It is the same query the list route runs, so
   * the search and filter the reader arrived with are still applied.
   */
  const listPage = await getInboxConversationListPageForCurrentUser(listQuery);
  const pagination = toInboxListPaginationMeta(listPage);
  const listQueryString = buildInboxListQueryString(listQuery);
  const backHref = listQueryString
    ? `/admin/whatsapp/inbox?${listQueryString}`
    : "/admin/whatsapp/inbox";
  const conversationPath = `/admin/whatsapp/inbox/${conversationId}`;
  const conversationHref = listQueryString
    ? `${conversationPath}?${listQueryString}`
    : conversationPath;
  const detailsParams = new URLSearchParams(listQueryString);
  detailsParams.set("details", "1");
  const detailsHref = `${conversationPath}?${detailsParams.toString()}`;

  /*
   * CRM fields come back through the CRM's own authorised accessor, so someone
   * who can answer this conversation but cannot read the lead sees the
   * conversation and no lead data. The WhatsApp pane is not a way around CRM
   * permissions.
   */
  const leadSummary = await loadConversationLeadSummary(detail.leadId);

  const serviceWindow = presentServiceWindow(detail.lastInboundAt);
  const sending = getWhatsappSendingStatus();

  return (
    <div
      className={`od-wa od-wa--with-details${showDetails ? " od-wa--details-route" : ""}`}
      data-testid="whatsapp-workspace"
      data-conversation-open="true"
    >
      <InboxListPane
        items={listPage.items}
        query={listQuery}
        pagination={pagination}
        showUnlinkedTriage={context.canManage}
        hasActiveFilters={hasInboxListActiveFilters(listQuery)}
        selectedId={conversationId}
        listQueryString={listQueryString}
        sending={sending}
        accountNote={<InboxManualRefreshButton />}
      />

      <div className="od-wa__pane od-wa__pane--chat" data-testid="whatsapp-chat-pane">
        <ConversationHeader
          detail={detail}
          serviceWindow={serviceWindow}
          backHref={backHref}
          detailsHref={detailsHref}
        />

        <InboxThread
          messages={detail.messages}
          olderMessagesHref={
            detail.messagePage * detail.messagePageSize < detail.messageTotalCount
              ? `?page=${detail.messagePage + 1}`
              : null
          }
        />

        <InboxComposerSection
          conversationId={conversationId}
          canRead={canRead}
          canUse={canUse}
          serviceWindow={serviceWindow}
          sending={sending}
        />
      </div>

      <div className="od-wa__pane od-wa__pane--details">
        <div className="od-wa__head">
          <Link href={conversationHref} className="od-wa__icon xl:hidden" aria-label="Back to conversation">
            <span aria-hidden="true">←</span>
          </Link>
          <h2 className="od-wa__panel-label">Details</h2>
        </div>
        <ConversationDetailsPanel
          detail={detail}
          serviceWindow={serviceWindow}
          lead={leadSummary.lead}
          leadHidden={leadSummary.hidden}
        />
      </div>
    </div>
  );
}
