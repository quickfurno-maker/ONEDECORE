/**
 * WhatsApp inbox conversation and message DTOs — bounded public fields only.
 */

import { presentMessage, type MessagePresentation } from "./message-presentation.ts";

export const INBOX_CONVERSATION_LIST_PUBLIC_KEYS = [
  "id",
  "customerE164",
  "displayNameSnapshot",
  "leadId",
  "contactId",
  "lastMessageAt",
  "lastInboundAt",
  "previewText",
  "isLinked",
  "linkedLeadName",
  "linkedLeadAssignedTo",
] as const;

export type InboxConversationListItem = {
  readonly id: string;
  readonly customerE164: string;
  readonly displayNameSnapshot: string | null;
  readonly leadId: string | null;
  readonly contactId: string | null;
  readonly lastMessageAt: string | null;
  readonly lastInboundAt: string | null;
  readonly previewText: string | null;
  readonly isLinked: boolean;
  readonly linkedLeadName: string | null;
  readonly linkedLeadAssignedTo: string | null;
};

export type InboxConversationListRow = {
  id: string;
  customer_e164: string;
  display_name_snapshot: string | null;
  lead_id: string | null;
  contact_id: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  leads: { submitted_name: string; assigned_to: string | null } | null;
};

/*
 * The allowlist is the contract, and it is checked by a test.
 *
 * Four fields join it here so the thread can render something other than
 * `[image]`. `content` is NOT one of them: it is Meta's raw per-type object
 * and belongs behind `presentMessage`, not in a component. What crosses this
 * boundary is the derived presentation plus the two identifiers needed to
 * resolve a quoted reply.
 */
export const INBOX_MESSAGE_PUBLIC_KEYS = [
  "id",
  "direction",
  "normalizedMessageType",
  "providerMessageType",
  "bodyText",
  "providerTimestamp",
  "latestStatus",
  "presentation",
  "providerMessageId",
  "contextProviderMessageId",
] as const;

export type InboxMessageItem = {
  readonly id: string;
  readonly direction: "inbound" | "outbound";
  readonly normalizedMessageType: string;
  readonly providerMessageType: string | null;
  readonly bodyText: string | null;
  readonly providerTimestamp: string;
  readonly latestStatus: string | null;
  /** Render-ready, derived from `content` server-side. */
  readonly presentation: MessagePresentation;
  /**
   * The `wamid.…` this message was delivered under, and the one it replied to.
   *
   * Both are Meta's own identifiers rather than ONEDECORE ids, and the thread
   * uses them only to match a reply to the message it quotes. Nothing renders
   * them.
   */
  readonly providerMessageId: string;
  readonly contextProviderMessageId: string | null;
};

export type InboxMessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  normalized_message_type: string;
  provider_message_type: string | null;
  provider_message_id: string;
  body_text: string | null;
  content: unknown;
  context_provider_message_id: string | null;
  provider_timestamp: string;
  latest_status: string | null;
};

export type InboxConversationDetail = InboxConversationListItem & {
  readonly messages: readonly InboxMessageItem[];
  readonly messagePage: number;
  readonly messagePageSize: number;
  readonly messageTotalCount: number;
};

const PREVIEW_MAX_LENGTH = 120;

export function truncatePreviewText(bodyText: string | null): string | null {
  if (!bodyText) {
    return null;
  }
  const trimmed = bodyText.trim();
  if (trimmed.length <= PREVIEW_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, PREVIEW_MAX_LENGTH - 1)}…`;
}

export function mapConversationRowToListItem(
  row: InboxConversationListRow,
  previewText: string | null
): InboxConversationListItem {
  return {
    id: row.id,
    customerE164: row.customer_e164,
    displayNameSnapshot: row.display_name_snapshot,
    leadId: row.lead_id,
    contactId: row.contact_id,
    lastMessageAt: row.last_message_at,
    lastInboundAt: row.last_inbound_at,
    previewText,
    isLinked: row.lead_id !== null,
    linkedLeadName: row.leads?.submitted_name ?? null,
    linkedLeadAssignedTo: row.leads?.assigned_to ?? null,
  };
}

export function mapMessageRowToItem(row: InboxMessageRow): InboxMessageItem {
  return {
    id: row.id,
    direction: row.direction,
    normalizedMessageType: row.normalized_message_type,
    providerMessageType: row.provider_message_type ?? null,
    bodyText: row.body_text,
    providerTimestamp: row.provider_timestamp,
    latestStatus: row.latest_status,
    /*
     * Derived here, at the mapper, so `content` stops at this boundary. The
     * component receives a closed union with bounded strings and never indexes
     * into provider JSON.
     */
    presentation: presentMessage({
      normalizedMessageType: row.normalized_message_type,
      providerMessageType: row.provider_message_type ?? null,
      bodyText: row.body_text,
      content: row.content,
    }),
    providerMessageId: row.provider_message_id,
    contextProviderMessageId: row.context_provider_message_id,
  };
}
