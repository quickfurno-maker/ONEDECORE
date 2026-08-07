import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WhatsappInboxAccessContext } from "../contracts/inbox-access.ts";
import {
  escapeIlikePattern,
  type InboxListPageResult,
  type InboxListQuery,
  type InboxMessageListQuery,
} from "../contracts/inbox-list-query.ts";
import {
  mapConversationRowToListItem,
  mapMessageRowToItem,
  truncatePreviewText,
  type InboxConversationListItem,
  type InboxConversationListRow,
  type InboxMessageItem,
  type InboxMessageRow,
} from "../contracts/conversation-dtos.ts";
import { whatsappInboxErrorFromPostgresMessage } from "./whatsapp-inbox-errors.ts";

const CONVERSATION_LIST_SELECT =
  "id, customer_e164, display_name_snapshot, lead_id, contact_id, last_message_at, last_inbound_at, leads!whatsapp_conversations_lead_id_fkey(submitted_name, assigned_to)";

async function fetchLatestPreviewByConversationIds(
  conversationIds: readonly string[]
): Promise<Map<string, string | null>> {
  const previews = new Map<string, string | null>();
  if (conversationIds.length === 0) {
    return previews;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("conversation_id, body_text, provider_timestamp")
    .in("conversation_id", [...conversationIds])
    .order("provider_timestamp", { ascending: false });

  if (error) {
    throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  for (const row of data ?? []) {
    if (!previews.has(row.conversation_id)) {
      previews.set(row.conversation_id, truncatePreviewText(row.body_text));
    }
  }

  return previews;
}

export async function queryInboxConversationListPage(
  _context: WhatsappInboxAccessContext,
  query: InboxListQuery
): Promise<InboxListPageResult<InboxConversationListItem>> {
  const supabase = await createClient();
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  let builder = supabase
    .from("whatsapp_conversations")
    .select(CONVERSATION_LIST_SELECT, { count: "exact" })
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (query.linkFilter === "linked") {
    builder = builder.not("lead_id", "is", null);
  } else if (query.linkFilter === "unlinked") {
    builder = builder.is("lead_id", null);
  }

  if (query.q) {
    const pattern = `%${escapeIlikePattern(query.q)}%`;
    builder = builder.or(
      `display_name_snapshot.ilike.${pattern},customer_e164.ilike.${pattern}`
    );
  }

  const { data, error, count } = await builder;

  if (error) {
    throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const rows = (data ?? []) as InboxConversationListRow[];
  const previews = await fetchLatestPreviewByConversationIds(
    rows.map((row) => row.id)
  );

  const totalCount = count ?? 0;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / query.pageSize);

  return {
    items: rows.map((row) =>
      mapConversationRowToListItem(row, previews.get(row.id) ?? null)
    ),
    page: query.page,
    pageSize: query.pageSize,
    totalCount,
    totalPages,
  };
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
      "id, direction, normalized_message_type, body_text, provider_timestamp, latest_status",
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

  return {
    items: ((data ?? []) as InboxMessageRow[]).map(mapMessageRowToItem),
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

export async function fetchConversationListRowById(
  conversationId: string
): Promise<InboxConversationListRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select(CONVERSATION_LIST_SELECT)
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    throw whatsappInboxErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return (data as InboxConversationListRow | null) ?? null;
}
