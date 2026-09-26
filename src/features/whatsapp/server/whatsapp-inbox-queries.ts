import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WhatsappInboxAccessContext } from "../contracts/inbox-access.ts";
import {
  INBOX_ATTENTION_DEFAULT,
  INBOX_RECENT_WINDOW_DAYS_DEFAULT,
  type InboxListPageResult,
  type InboxListQuery,
  type InboxMessageListQuery,
} from "../contracts/inbox-list-query.ts";
import {
  mapConversationRowToListItem,
  mapMessageRowToItem,
  parseInboxConversationListPayload,
  WHATSAPP_MESSAGE_ORIGIN_KINDS,
  type InboxConversationListItem,
  type InboxMessageItem,
  type InboxMessageRow,
  type WhatsappMessageOrigin,
} from "../contracts/conversation-dtos.ts";
import { whatsappInboxErrorFromPostgresMessage } from "./whatsapp-inbox-errors.ts";
import { getWhatsappMediaMode } from "./whatsapp-business-env.ts";

/*
 * SURFACE-INDEPENDENT BY CONSTRUCTION.
 *
 * Nothing in this file knows which route mounted the inbox. Every read goes
 * through the caller's own cookie session, and scope is decided by the
 * database — `private.whatsapp_inbox_can_view_conversation` via RLS and via the
 * WM-1 read model — so the admin workspace and a future Sales Representative
 * dashboard get the same rows for the same person without either filtering
 * anything itself. There is no service-role client here and there must never be
 * one: a broad read filtered in TypeScript is exactly the second ownership
 * system ADR-0034 forbids.
 */

/**
 * One page of the inbox list, derived entirely in SQL.
 *
 * `public.list_whatsapp_inbox_conversations` applies scope, search, link filter,
 * attention derivation, the attention filter and offset paging before any row
 * leaves the database, and returns the latest message preview with each row, so
 * no message history is fetched to build a list.
 */
export async function queryInboxConversationListPage(
  _context: WhatsappInboxAccessContext,
  query: InboxListQuery
): Promise<InboxListPageResult<InboxConversationListItem>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_whatsapp_inbox_conversations", {
    p_attention: query.attention,
    p_link_filter: query.linkFilter,
    p_search: query.q ?? undefined,
    p_page: query.page,
    p_page_size: query.pageSize,
    p_recent_window_days: INBOX_RECENT_WINDOW_DAYS_DEFAULT,
  });

  if (error) {
    throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const payload = parseInboxConversationListPayload(data);
  const totalCount = payload.totalCount;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / query.pageSize);

  return {
    items: payload.rows.map(mapConversationRowToListItem),
    page: query.page,
    pageSize: query.pageSize,
    totalCount,
    totalPages,
  };
}

/**
 * The header row for one conversation, from the same read model and the same
 * scope as the list. Refused and missing are both `null`.
 */
export async function fetchConversationListItemById(
  conversationId: string
): Promise<InboxConversationListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_whatsapp_inbox_conversations", {
    p_attention: INBOX_ATTENTION_DEFAULT,
    p_link_filter: "all",
    p_page: 1,
    p_page_size: 1,
    p_recent_window_days: INBOX_RECENT_WINDOW_DAYS_DEFAULT,
    p_conversation_id: conversationId,
  });

  if (error) {
    throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const row = parseInboxConversationListPayload(data).rows[0];
  return row ? mapConversationRowToListItem(row) : null;
}

export async function queryConversationMessagesPage(
  _context: WhatsappInboxAccessContext,
  query: InboxMessageListQuery
): Promise<InboxListPageResult<InboxMessageItem>> {
  const supabase = await createClient();
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  const { data, error, count } = await supabase
    .from("whatsapp_messages")
    .select(
      "id, direction, normalized_message_type, provider_message_type, provider_message_id, body_text, content, context_provider_message_id, provider_timestamp, latest_status",
      { count: "exact" }
    )
    .eq("conversation_id", query.conversationId)
    .order("provider_timestamp", { ascending: true })
    .range(from, to);

  if (error) {
    throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const totalCount = count ?? 0;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / query.pageSize);
  // Offer a media link only where the governed view route can serve it.
  const mediaViewEnabled = getWhatsappMediaMode() !== "disabled";
  const items = ((data ?? []) as InboxMessageRow[]).map((row) =>
    mapMessageRowToItem(row, { mediaViewEnabled })
  );

  const outboundIds = items
    .filter((item) => item.direction === "outbound")
    .map((item) => item.id);
  const origins = new Map<string, WhatsappMessageOrigin>();

  if (outboundIds.length > 0) {
    const { data: originRows, error: originError } = await supabase.rpc(
      "get_whatsapp_inbox_message_origins",
      { p_message_ids: outboundIds }
    );

    if (originError) {
      throw whatsappInboxErrorFromPostgresMessage(
        originError.message,
        "RPC_FAILED"
      );
    }

    for (const row of originRows ?? []) {
      if (
        typeof row.message_id !== "string" ||
        typeof row.origin_label !== "string" ||
        !(WHATSAPP_MESSAGE_ORIGIN_KINDS as readonly string[]).includes(
          row.origin_kind
        )
      ) {
        continue;
      }
      origins.set(row.message_id, {
        kind: row.origin_kind as WhatsappMessageOrigin["kind"],
        label: row.origin_label,
      });
    }
  }

  return {
    items: items.map((item) => ({
      ...item,
      origin: origins.get(item.id) ?? null,
    })),
    page: query.page,
    pageSize: query.pageSize,
    totalCount,
    totalPages,
  };
}

export async function canCurrentUserAccessConversation(
  conversationId: string,
  capability: "read" | "use" | "manage"
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "whatsapp_inbox_check_conversation_access",
    {
      p_conversation_id: conversationId,
      p_capability: capability,
    }
  );

  if (error) {
    throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return data === true;
}

/**
 * Advance the CURRENT staff member's internal read watermark.
 *
 * ONEDECORE state only: the RPC never calls Meta and never writes provider
 * message status. Returns `false` for a conversation the actor cannot view —
 * the database answers missing and refused identically, and so does this.
 */
export async function markConversationReadForCurrentUser(
  conversationId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_whatsapp_conversation_read", {
    p_conversation_id: conversationId,
  });

  if (error) {
    if (error.code === "P0002") return false;
    throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return true;
}
