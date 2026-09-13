import "server-only";

import type { InboxConversationDetail } from "../contracts/conversation-dtos.ts";
import type { InboxConversationListItem } from "../contracts/conversation-dtos.ts";
import type {
  InboxListPageResult,
  InboxListQuery,
  InboxMessageListQuery,
} from "../contracts/inbox-list-query.ts";
import { WhatsappInboxError } from "./whatsapp-inbox-errors.ts";
import { getWhatsappInboxAccessContext } from "./whatsapp-auth.ts";
import {
  canCurrentUserAccessConversation,
  fetchConversationListItemById,
  markConversationReadForCurrentUser,
  queryConversationMessagesPage,
  queryInboxConversationListPage,
} from "./whatsapp-inbox-queries.ts";

/*
 * The inbox domain entry points. They resolve the CURRENT actor and let the
 * database decide scope; none of them takes a route, a portal or a role hint,
 * so any authenticated staff surface can mount them behind its own route-level
 * guard.
 */

async function requireAccessContext() {
  const context = await getWhatsappInboxAccessContext();
  if (!context) {
    throw new WhatsappInboxError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  return context;
}

export async function getInboxConversationListPageForCurrentUser(
  query: InboxListQuery
): Promise<InboxListPageResult<InboxConversationListItem>> {
  const context = await requireAccessContext();
  return queryInboxConversationListPage(context, query);
}

export async function getInboxConversationDetailForCurrentUser(
  conversationId: string,
  messageQuery: InboxMessageListQuery
): Promise<InboxConversationDetail | null> {
  const context = await requireAccessContext();

  const canRead = await canCurrentUserAccessConversation(conversationId, "read");
  if (!canRead) {
    return null;
  }

  const base = await fetchConversationListItemById(conversationId);
  if (!base) {
    return null;
  }

  const messagePage = await queryConversationMessagesPage(context, messageQuery);

  return {
    ...base,
    messages: messagePage.items,
    messagePage: messagePage.page,
    messagePageSize: messagePage.pageSize,
    messageTotalCount: messagePage.totalCount,
  };
}

/**
 * Record that the current staff member opened a conversation.
 *
 * Called from a Server Action invoked by the thread AFTER it mounts in the
 * browser — never from a Server Component render, which a link prefetch can
 * trigger without anyone looking at the thread.
 */
export async function acknowledgeInboxConversationOpenedForCurrentUser(
  conversationId: string
): Promise<boolean> {
  await requireAccessContext();
  return markConversationReadForCurrentUser(conversationId);
}
