/**
 * WM-0 (ADR-0034) — per-staff conversation state and truthful inbox filters.
 * Migration-independent; persistence arrives in WM-1.
 *
 * Two different "reads" exist and must never be merged:
 * - provider read: the customer's device reported our outbound message as read
 *   (`whatsapp_message_status_events.status = 'read'`), evidence from Meta;
 * - staff read: a member of staff opened the conversation in ONEDECORE.
 *
 * Staff read state is per staff member. One salesperson opening a thread does
 * not mark it read for their manager, and nothing here is ever sent to Meta.
 */

export interface WhatsappConversationStaffState {
  readonly conversationId: string;
  readonly staffUserId: string;
  readonly lastReadMessageId: string | null;
  /** `provider_timestamp` of `lastReadMessageId`, the comparison watermark. */
  readonly lastReadMessageAt: string | null;
  readonly lastOpenedAt: string | null;
}

export const WHATSAPP_INBOX_ATTENTION_FILTERS = [
  "all_assigned",
  "unread",
  "needs_reply",
  "waiting_on_customer",
  "follow_up_due",
  "recently_active",
] as const;

export type WhatsappInboxAttentionFilter =
  (typeof WHATSAPP_INBOX_ATTENTION_FILTERS)[number];

/**
 * The evidence each filter is defined over. WM-1 implements these in SQL behind
 * the same RLS scope as the list itself, never by fetching every row and
 * filtering in React.
 */
export const WHATSAPP_INBOX_ATTENTION_FILTER_DEFINITIONS: Readonly<
  Record<WhatsappInboxAttentionFilter, string>
> = {
  all_assigned:
    "Conversations the actor can view under current CRM scope (leads.assigned_to, or manage scope).",
  unread:
    "At least one inbound message whose provider_timestamp is later than the actor's own lastReadMessageAt, or the actor has no staff state row and an inbound message exists.",
  needs_reply:
    "The latest inbound message is later than the latest outbound message persisted through a governed path.",
  waiting_on_customer:
    "The latest governed outbound message is at or after the latest inbound message.",
  follow_up_due:
    "The linked lead has an open CRM follow-up due at or before now, read from CRM follow-up truth, not inferred from WhatsApp.",
  recently_active:
    "last_message_at within a configured window, ordered by last_message_at descending.",
};

export interface WhatsappConversationAttentionEvidence {
  readonly lastInboundAt: string | null;
  /** Latest outbound message persisted through a governed path. */
  readonly lastOutboundAt: string | null;
  readonly staffLastReadMessageAt: string | null;
}

export interface WhatsappConversationAttention {
  readonly unread: boolean;
  readonly needsReply: boolean;
  readonly waitingOnCustomer: boolean;
}

function toEpoch(value: string | null): number | null {
  if (value === null) return null;
  const epoch = Date.parse(value);
  return Number.isNaN(epoch) ? null : epoch;
}

/** Pure mirror of the WM-1 SQL definitions, for tests and presentation only. */
export function deriveWhatsappConversationAttention(
  evidence: WhatsappConversationAttentionEvidence
): WhatsappConversationAttention {
  const inbound = toEpoch(evidence.lastInboundAt);
  const outbound = toEpoch(evidence.lastOutboundAt);
  const read = toEpoch(evidence.staffLastReadMessageAt);

  const unread = inbound !== null && (read === null || inbound > read);
  const needsReply =
    inbound !== null && (outbound === null || inbound > outbound);
  const waitingOnCustomer =
    outbound !== null && (inbound === null || outbound >= inbound);

  return { unread, needsReply, waitingOnCustomer };
}
