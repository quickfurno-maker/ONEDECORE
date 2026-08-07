import "server-only";

import type { InboxConversationDetail } from "../contracts/conversation-dtos.ts";
import {
  mapConversationRowToListItem,
  truncatePreviewText,
  type InboxConversationListItem,
} from "../contracts/conversation-dtos.ts";
import type {
  InboxListPageResult,
  InboxListQuery,
  InboxMessageListQuery,
} from "../contracts/inbox-list-query.ts";
import { WhatsappInboxError } from "./whatsapp-inbox-errors.ts";
import { getWhatsappInboxAccessContext } from "./whatsapp-auth.ts";
import {
  canCurrentUserAccessConversation,
  fetchConversationListRowById,
  queryConversationMessagesPage,
  queryInboxConversationListPage,
} from "./whatsapp-inbox-queries.ts";

export async function getInboxConversationListPageForCurrentUser(
  query: InboxListQuery
): Promise<InboxListPageResult<InboxConversationListItem>> {
  const context = await getWhatsappInboxAccessContext();
  if (!context) {
    throw new WhatsappInboxError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  return queryInboxConversationListPage(context, query);
}

export async function getInboxConversationDetailForCurrentUser(
  conversationId: string,
  messageQuery: InboxMessageListQuery
): Promise<InboxConversationDetail | null> {
  const context = await getWhatsappInboxAccessContext();
  if (!context) {
    throw new WhatsappInboxError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  const canRead = await canCurrentUserAccessConversation(conversationId, "read");
  if (!canRead) {
    return null;
  }

  const row = await fetchConversationListRowById(conversationId);
  if (!row) {
    return null;
  }

  const messagePage = await queryConversationMessagesPage(context, messageQuery);
  const previewText =
    messagePage.items.length > 0
      ? truncatePreviewText(
          messagePage.items[messagePage.items.length - 1]?.bodyText ?? null
        )
      : null;

  const base = mapConversationRowToListItem(row, previewText);

  return {
    ...base,
    messages: messagePage.items,
    messagePage: messagePage.page,
    messagePageSize: messagePage.pageSize,
    messageTotalCount: messagePage.totalCount,
  };
}
