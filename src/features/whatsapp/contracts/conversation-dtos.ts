/**
 * WhatsApp inbox conversation and message DTOs — bounded public fields only.
 */

import { presentMessage, type MessagePresentation } from "./message-presentation.ts";

/*
 * WM-1: the list item carries the attention state the database derived, and
 * nothing it did not. There is no unread COUNT (the read model computes a
 * boolean per staff member, not a tally), no online/typing, no SLA. The
 * assignee's staff id no longer crosses at all: nothing rendered it, and a
 * salesperson's list has no business carrying colleagues' profile ids.
 */
export const INBOX_CONVERSATION_LIST_PUBLIC_KEYS = [
  "id",
  "customerE164",
  "displayNameSnapshot",
  "leadId",
  "contactId",
  "lastMessageAt",
  "lastInboundAt",
  "lastOutboundAt",
  "previewText",
  "isLinked",
  "linkState",
  "linkedLeadName",
  "staffLastReadMessageAt",
  "unread",
  "needsReply",
  "waitingOnCustomer",
  "followUpDue",
] as const;

/**
 * `live`: linked to an operational lead. `tombstoned`: linked to a deleted
 * enquiry — only manage scope ever receives these, as read-only history.
 */
export const INBOX_CONVERSATION_LINK_STATES = ["unlinked", "live", "tombstoned"] as const;
export type InboxConversationLinkState = (typeof INBOX_CONVERSATION_LINK_STATES)[number];

export type InboxConversationListItem = {
  readonly id: string;
  readonly customerE164: string;
  readonly displayNameSnapshot: string | null;
  readonly leadId: string | null;
  readonly contactId: string | null;
  readonly lastMessageAt: string | null;
  readonly lastInboundAt: string | null;
  readonly lastOutboundAt: string | null;
  readonly previewText: string | null;
  readonly isLinked: boolean;
  readonly linkState: InboxConversationLinkState;
  readonly linkedLeadName: string | null;
  /** The CURRENT viewer's own internal read watermark. Never provider read. */
  readonly staffLastReadMessageAt: string | null;
  readonly unread: boolean;
  readonly needsReply: boolean;
  readonly waitingOnCustomer: boolean;
  readonly followUpDue: boolean;
};

/** One item as `public.list_whatsapp_inbox_conversations` returns it. */
export type InboxConversationListRow = {
  id: string;
  customer_e164: string;
  display_name_snapshot: string | null;
  lead_id: string | null;
  contact_id: string | null;
  link_state: string;
  linked_lead_name: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  staff_last_read_message_at: string | null;
  preview_body_text: string | null;
  unread: boolean;
  needs_reply: boolean;
  waiting_on_customer: boolean;
  follow_up_due: boolean;
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
  "origin",
] as const;

export const WHATSAPP_MESSAGE_ORIGIN_KINDS = [
  "campaign",
  "automation",
  "utility_template",
] as const;
export type WhatsappMessageOriginKind =
  (typeof WHATSAPP_MESSAGE_ORIGIN_KINDS)[number];

export interface WhatsappMessageOrigin {
  readonly kind: WhatsappMessageOriginKind;
  readonly label: string;
}

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
  /** Existing attribution evidence, projected only for caller-visible messages. */
  readonly origin: WhatsappMessageOrigin | null;
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

export type InboxConversationListPayload = {
  readonly totalCount: number;
  readonly rows: readonly InboxConversationListRow[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The read model returns `jsonb`, which the generated types can only call
 * `Json`. This is the one place its shape is checked, so a drift between the
 * SQL and the DTO fails loudly here instead of rendering `undefined` rows.
 */
export function parseInboxConversationListPayload(
  payload: unknown
): InboxConversationListPayload {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new Error("inbox read model returned an unexpected payload");
  }
  const totalCount = Number(payload.total_count);
  if (!Number.isInteger(totalCount) || totalCount < 0) {
    throw new Error("inbox read model returned an invalid total_count");
  }
  const rows = payload.items.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.customer_e164 !== "string") {
      throw new Error("inbox read model returned an invalid row");
    }
    return item as unknown as InboxConversationListRow;
  });
  return { totalCount, rows };
}

function toLinkState(row: InboxConversationListRow): InboxConversationLinkState {
  if (row.lead_id === null) return "unlinked";
  /*
   * An unrecognised value on a linked row is read as tombstoned, the
   * read-only shape. Guessing "live" would let a UI treat history as workable.
   */
  return row.link_state === "live" ? "live" : "tombstoned";
}

export function mapConversationRowToListItem(
  row: InboxConversationListRow
): InboxConversationListItem {
  return {
    id: row.id,
    customerE164: row.customer_e164,
    displayNameSnapshot: row.display_name_snapshot,
    leadId: row.lead_id,
    contactId: row.contact_id,
    lastMessageAt: row.last_message_at,
    lastInboundAt: row.last_inbound_at,
    lastOutboundAt: row.last_outbound_at,
    previewText: truncatePreviewText(row.preview_body_text),
    isLinked: row.lead_id !== null,
    linkState: toLinkState(row),
    linkedLeadName: row.linked_lead_name,
    staffLastReadMessageAt: row.staff_last_read_message_at,
    // Strictly `true`: a missing or malformed flag is not an attention signal.
    unread: row.unread === true,
    needsReply: row.needs_reply === true,
    waitingOnCustomer: row.waiting_on_customer === true,
    followUpDue: row.follow_up_due === true,
  };
}

export function mapMessageRowToItem(
  row: InboxMessageRow,
  options: { readonly mediaViewEnabled?: boolean } = {}
): InboxMessageItem {
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
      mediaViewEnabled: options.mediaViewEnabled === true,
      direction: row.direction,
    }),
    providerMessageId: row.provider_message_id,
    contextProviderMessageId: row.context_provider_message_id,
    origin: null,
  };
}
