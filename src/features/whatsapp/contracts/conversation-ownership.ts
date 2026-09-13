/**
 * WM-0 (ADR-0034) — CRM-owned conversation access. Migration-independent.
 *
 * A WhatsApp conversation has no owner of its own. Who may see and act on a
 * lead-linked conversation is answered by `public.leads.assigned_to`, read at
 * the moment of the request, through `private.whatsapp_inbox_can_view_conversation`
 * and `private.whatsapp_inbox_can_use_conversation`. Reassigning the lead moves
 * the conversation with it: nothing is copied, so nothing can go stale.
 *
 * `server/inbox-access-resolver.ts` is the application mirror of those
 * predicates. This file freezes the rule they share so a later phase cannot
 * quietly add a second authority (a `whatsapp_conversations.assigned_sales_rep`,
 * a cached owner on a read model, a React-side filter) that drifts from CRM.
 */

export const WHATSAPP_CONVERSATION_OWNERSHIP_AUTHORITY = {
  table: "public.leads",
  column: "assigned_to",
  linkedVia: "public.whatsapp_conversations.lead_id",
} as const;

/**
 * Column names that must never appear on `public.whatsapp_conversations` (or on
 * any WhatsApp read model standing in for it). Each would be a competing owner.
 */
export const FORBIDDEN_CONVERSATION_OWNER_COLUMNS = [
  "assigned_to",
  "assigned_sales_rep",
  "assigned_sales_rep_id",
  "assignee_id",
  "owner_id",
  "owner_profile_id",
  "sales_rep_id",
] as const;

/** Which slice of the inbox an actor can reach. Order is not precedence. */
export const WHATSAPP_CONVERSATION_SCOPES = [
  /** Linked to a live lead whose `assigned_to` is the actor. */
  "assigned_lead",
  /** Linked to a live lead, any assignee: manage scope only. */
  "broad_linked",
  /** No lead link (unknown or ambiguous identity): manage scope only. */
  "unlinked_triage",
] as const;

export type WhatsappConversationScope =
  (typeof WHATSAPP_CONVERSATION_SCOPES)[number];

/** Roles that hold manage scope when also granted `whatsapp.inbox.manage` (M19). */
export const WHATSAPP_MANAGE_SCOPE_ROLES = [
  "super_admin",
  "sales_manager",
  "management",
] as const;

/**
 * Locked owner policy (ADR-0034 §B.6) for a conversation whose linked lead is
 * tombstoned. Use/send conforms since the lead tombstone migration; read/view
 * conforms since WM-1 (20260913130000_whatsapp_inbox_staff_state_attention.sql,
 * pgTAP 64_whatsapp_inbox_staff_state_attention_test.sql).
 */
export const WHATSAPP_TOMBSTONED_LEAD_CONVERSATION_POLICY = {
  /** Sales Executive and legacy sales, including the former assignee. */
  assignedScope: { read: false, use: false, existenceVisible: false },
  /** Super Admin, Sales Manager and legacy management via existing M19 manage scope. */
  manageScope: { read: "historical_read_only", use: false, existenceVisible: true },
  evidenceRetained: true,
  governedRestoreResumesAssignmentAccess: true,
  readSideImplementedIn: "WM-1",
} as const;

/**
 * Reassignment semantics, frozen. Every item is a consequence of reading
 * `leads.assigned_to` live, not a behaviour anyone has to remember to build.
 */
export const WHATSAPP_REASSIGNMENT_RULES = {
  previousAssigneeLosesAccessImmediately: true,
  newAssigneeGainsAccessImmediately: true,
  conversationLeadLinkUnchanged: true,
  messageHistoryUnchanged: true,
  manageScopeUnaffected: true,
  /** Access denial must be indistinguishable from "does not exist". */
  deniedLooksLikeNotFound: true,
} as const;
