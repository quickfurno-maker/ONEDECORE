/**
 * WM-0 (ADR-0034) — forward-only schema plan as data. Migration-independent.
 *
 * WM-0 creates no migration. This list names what later phases add and what
 * stays authoritative, so the plan in
 * `docs/product/whatsapp-marketing-control-plane.md` has a checkable twin.
 */

/** Existing tables that remain the single source of truth. Never duplicated. */
export const WHATSAPP_CONTROL_PLANE_AUTHORITATIVE_TABLES = [
  { table: "public.contacts", owns: "identity and DNC (status = do_not_contact)" },
  { table: "public.contact_channels", owns: "WhatsApp address and suppression (status = suppressed/invalid)" },
  { table: "public.consent_events", owns: "append-only consent incl. purpose MARKETING" },
  { table: "public.leads", owns: "conversation ownership via assigned_to; CRM stage" },
  { table: "public.whatsapp_conversations", owns: "canonical thread per business phone + customer E.164" },
  { table: "public.whatsapp_messages", owns: "canonical message history, inbound and outbound" },
  { table: "public.whatsapp_message_status_events", owns: "provider delivery/read/failed evidence" },
  { table: "public.whatsapp_templates", owns: "template registry (extended forward-only in WM-2)" },
  { table: "public.campaigns", owns: "campaign identity" },
  { table: "public.campaign_versions", owns: "versioned configuration, intended_channels" },
  { table: "public.campaign_audience_rule_versions", owns: "frozen audience rules" },
  { table: "public.campaign_approvals", owns: "append-only approval evidence" },
  { table: "public.lead_follow_ups", owns: "CRM follow-up truth" },
] as const;

/** Paid-ads execution tables (ADR-0031). A WhatsApp send never writes to them. */
export const PAID_ADS_EXECUTION_TABLES_NOT_FOR_WHATSAPP = [
  "public.campaign_runs",
  "public.campaign_run_targets",
  "public.campaign_run_operations",
  "public.campaign_execution_events",
] as const;

export type WhatsappPlannedObjectKind = "table" | "column" | "function" | "permission";

export interface WhatsappPlannedSchemaObject {
  readonly name: string;
  readonly kind: WhatsappPlannedObjectKind;
  readonly phase: "WM-1" | "WM-2" | "WM-3" | "WM-4" | "WM-5" | "WM-6";
  readonly appendOnly: boolean;
  readonly purpose: string;
}

export const WHATSAPP_PLANNED_SCHEMA_OBJECTS: readonly WhatsappPlannedSchemaObject[] = [
  { name: "public.whatsapp_conversation_staff_state", kind: "table", phase: "WM-1", appendOnly: false, purpose: "per-staff last read / last opened" },
  { name: "public.whatsapp_templates (sync columns)", kind: "column", phase: "WM-2", appendOnly: false, purpose: "quality, raw status, parameter format, synced_at" },
  { name: "public.whatsapp_template_snapshots", kind: "table", phase: "WM-2", appendOnly: true, purpose: "immutable content-addressed approved template copies" },
  { name: "public.whatsapp_template_status_events", kind: "table", phase: "WM-2", appendOnly: true, purpose: "sync/webhook status and category change evidence" },
  { name: "public.whatsapp_template_submissions", kind: "table", phase: "WM-2", appendOnly: true, purpose: "draft submission requests and provider responses" },
  { name: "public.whatsapp_marketing_preference_events", kind: "table", phase: "WM-3", appendOnly: true, purpose: "per-category opt-in/opt-out evidence" },
  { name: "public.whatsapp_marketing_send_policies", kind: "table", phase: "WM-3", appendOnly: false, purpose: "versioned frequency caps and quiet hours" },
  { name: "public.whatsapp_segments", kind: "table", phase: "WM-3", appendOnly: false, purpose: "saved allowlisted rule definitions" },
  { name: "public.whatsapp_campaign_specs", kind: "table", phase: "WM-4", appendOnly: false, purpose: "1:1 with campaign_versions; frozen after submit" },
  { name: "public.whatsapp_campaign_runs", kind: "table", phase: "WM-4", appendOnly: false, purpose: "WhatsApp execution run" },
  { name: "public.whatsapp_campaign_recipients", kind: "table", phase: "WM-4", appendOnly: false, purpose: "frozen minimum-data recipient snapshot" },
  { name: "public.whatsapp_campaign_dispatch_jobs", kind: "table", phase: "WM-4", appendOnly: false, purpose: "durable queue with claim TTL" },
  { name: "public.whatsapp_campaign_dispatch_events", kind: "table", phase: "WM-4", appendOnly: true, purpose: "immutable job lifecycle evidence" },
  { name: "public.whatsapp_message_campaign_attributions", kind: "table", phase: "WM-4", appendOnly: true, purpose: "message to run/recipient binding" },
  { name: "public.whatsapp_click_tokens", kind: "table", phase: "WM-5", appendOnly: false, purpose: "opaque click redirect tokens" },
  { name: "public.whatsapp_click_events", kind: "table", phase: "WM-5", appendOnly: true, purpose: "click evidence" },
  { name: "public.whatsapp_reply_attributions", kind: "table", phase: "WM-5", appendOnly: true, purpose: "exact (context id) or inferred reply attribution" },
  { name: "public.whatsapp_automations", kind: "table", phase: "WM-6", appendOnly: false, purpose: "journey definitions bound to campaign versions" },
  { name: "public.whatsapp_automation_enrollments", kind: "table", phase: "WM-6", appendOnly: false, purpose: "per-contact journey state" },
  { name: "public.whatsapp_flows", kind: "table", phase: "WM-6", appendOnly: false, purpose: "official Flow registry" },
  { name: "public.whatsapp_flow_responses", kind: "table", phase: "WM-6", appendOnly: true, purpose: "Flow submission evidence" },
  { name: "public.whatsapp_referral_contexts", kind: "table", phase: "WM-6", appendOnly: true, purpose: "Click-to-WhatsApp ad referral context" },
];
