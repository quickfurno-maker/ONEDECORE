/**
 * WhatsApp inbox conversation and message DTOs — bounded public fields only.
 */

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

export const INBOX_MESSAGE_PUBLIC_KEYS = [
  "id",
  "direction",
  "normalizedMessageType",
  "bodyText",
  "providerTimestamp",
  "latestStatus",
] as const;

export type InboxMessageItem = {
  readonly id: string;
  readonly direction: "inbound" | "outbound";
  readonly normalizedMessageType: string;
  readonly bodyText: string | null;
  readonly providerTimestamp: string;
  readonly latestStatus: string | null;
};

export type InboxMessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  normalized_message_type: string;
  body_text: string | null;
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
    bodyText: row.body_text,
    providerTimestamp: row.provider_timestamp,
    latestStatus: row.latest_status,
  };
}
