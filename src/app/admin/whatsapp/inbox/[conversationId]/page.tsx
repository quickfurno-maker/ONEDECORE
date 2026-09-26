import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConversationDetailsPanel } from "@/features/whatsapp/components/inbox/ConversationDetailsPanel";
import { ConversationCrmResolution } from "@/features/whatsapp/components/inbox/ConversationCrmResolution";
import { ConversationCrmActions } from "@/features/whatsapp/components/inbox/ConversationCrmActions";
import { ConversationHeader } from "@/features/whatsapp/components/inbox/ConversationHeader";
import { InboxComposerSection } from "@/features/whatsapp/components/inbox/InboxComposerSection";
import { InboxListPane } from "@/features/whatsapp/components/inbox/InboxListPane";
import { InboxManualRefreshButton } from "@/features/whatsapp/components/inbox/InboxManualRefreshButton";
import { InboxReadAcknowledger } from "@/features/whatsapp/components/inbox/InboxReadAcknowledger";
import { InboxThread } from "@/features/whatsapp/components/inbox/InboxThread";
import { WhatsappAccessDenied } from "@/features/whatsapp/components/states/WhatsappAccessDenied";
import { MarketingOptOutForm } from "@/features/whatsapp/components/control-plane/ContactComplianceForms";
import { canCurrentUserRecordWhatsappOptOut } from "@/features/whatsapp/server/whatsapp-contacts-queries";
import "@/features/whatsapp/components/whatsapp-workspace.css";
import {
  buildInboxListHref,
  buildInboxListQueryString,
  hasInboxListActiveFilters,
  parseInboxListQuery,
  parseInboxMessageListQuery,
  toInboxListPaginationMeta,
} from "@/features/whatsapp/contracts/inbox-list-query";
import {
  buildInboxConversationHref,
  WHATSAPP_ADMIN_INBOX_BASE_PATH,
} from "@/features/whatsapp/contracts/inbox-surface";
import { presentServiceWindow } from "@/features/whatsapp/contracts/message-presentation";
import { getWhatsappInboxAccessContext } from "@/features/whatsapp/server/whatsapp-auth";
import { getWhatsappSendingStatus } from "@/features/whatsapp/server/whatsapp-sending-status";
import { canCurrentUserAccessConversation } from "@/features/whatsapp/server/whatsapp-inbox-queries";
import {
  getInboxConversationDetailForCurrentUser,
  getInboxConversationListPageForCurrentUser,
} from "@/features/whatsapp/server/whatsapp-inbox-repository";
import { loadConversationLeadSummary } from "@/features/whatsapp/server/conversation-lead-summary";
import {
  getWhatsappCrmCreateOptionsForCurrentUser,
  searchWhatsappCrmLeadCandidatesForCurrentUser,
} from "@/features/whatsapp/server/whatsapp-crm-integration";
import {
  listSendableUtilityTemplatesForConversation,
  probeWhatsappTemplatePermissions,
} from "@/features/whatsapp/server/whatsapp-template-queries";

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
  // q, link, attention, page and pageSize all survive the trip back.
  const backHref = buildInboxListHref(WHATSAPP_ADMIN_INBOX_BASE_PATH, listQuery);
  const conversationPath = buildInboxConversationHref(WHATSAPP_ADMIN_INBOX_BASE_PATH, conversationId);
  const conversationHref = buildInboxConversationHref(
    WHATSAPP_ADMIN_INBOX_BASE_PATH,
    conversationId,
    listQueryString
  );
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

  const crmResolution =
    context.canManage && !detail.leadId
      ? await Promise.all([
          searchWhatsappCrmLeadCandidatesForCurrentUser({
            conversationE164: detail.customerE164,
            query: null,
          }),
          getWhatsappCrmCreateOptionsForCurrentUser(),
        ])
      : null;

  const serviceWindow = presentServiceWindow(detail.lastInboundAt);
  const sending = getWhatsappSendingStatus();

  /*
   * WM-2: the approved UTILITY templates this viewer may send HERE. Asked only
   * of someone who can use the conversation and holds whatsapp.templates.use;
   * the database answers for the exact conversation and live CRM assignment.
   * `null` means no picker at all, which is what legacy sales and management
   * see.
   */
  const templatePermissions = canUse ? await probeWhatsappTemplatePermissions() : null;
  const templates = templatePermissions?.["whatsapp.templates.use"]
    ? await listSendableUtilityTemplatesForConversation(conversationId)
    : null;

  /*
   * WM-3: a restrictive marketing opt-out, offered to whoever holds
   * whatsapp.opt_out.record and can use THIS conversation. For a Sales
   * Executive that is their assigned lead; the RPC re-checks both.
   */
  const canRecordOptOut = canUse && detail.contactId ? await canCurrentUserRecordWhatsappOptOut() : false;

  return (
    <div
      className={`od-wa od-wa--with-details${showDetails ? " od-wa--details-route" : ""}`}
      data-testid="whatsapp-workspace"
      data-conversation-open="true"
    >
      <InboxListPane
        basePath={WHATSAPP_ADMIN_INBOX_BASE_PATH}
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

        {/*
          Staff read state advances from the browser, after this thread has
          mounted — never from this Server Component, which a prefetch can
          render without anyone opening the conversation.
        */}
        <InboxReadAcknowledger
          conversationId={conversationId}
          lastMessageAt={detail.lastMessageAt}
        />

        <InboxThread
          messages={detail.messages}
          canReply={canUse}
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
          templates={templates}
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
          crmActions={
            leadSummary.lead ? (
              <ConversationCrmActions lead={leadSummary.lead} />
            ) : null
          }
          crmResolution={
            crmResolution ? (
              <ConversationCrmResolution
                conversationId={conversationId}
                customerE164={detail.customerE164}
                displayName={detail.displayNameSnapshot}
                initialCandidates={crmResolution[0]}
                canCreateLead={crmResolution[1]?.canCreateLead ?? false}
                assigneePolicy={crmResolution[1]?.assigneePolicy ?? null}
                assignees={crmResolution[1]?.assignees ?? []}
              />
            ) : null
          }
          compliance={
            canRecordOptOut && detail.contactId ? (
              <MarketingOptOutForm contactId={detail.contactId} conversationId={conversationId} compact />
            ) : null
          }
        />
      </div>
    </div>
  );
}
