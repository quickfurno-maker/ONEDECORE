/**
 * WM-0 (ADR-0034) — WhatsApp control-plane permission matrix. Migration-independent.
 *
 * This is the frozen TARGET matrix. The database stays the authority: a
 * `planned` code does not exist yet, grants nothing today, and is inserted by
 * the migration of the phase named on its row. `existing` rows mirror grants
 * already made by M19 / M31 / M33 and are checked against those migrations by
 * the WM-0 contract tests.
 *
 * Generic campaign permissions are reused rather than duplicated. A WhatsApp
 * channel code is added only where WhatsApp carries a risk the generic code was
 * never granted for (sending messages to people, as opposed to paid-ads spend).
 */

import type { CrmOperationalRoleCode } from "../../crm/contracts/permissions.ts";

export type WhatsappControlPlaneArea =
  | "inbox"
  | "templates"
  | "contacts"
  | "segments"
  | "campaigns"
  | "analytics"
  | "automations"
  | "flows"
  | "settings";

export type WhatsappControlPlaneRisk =
  /** Reads within an RLS scope. */
  | "read"
  | "one_to_one"
  /** Reaches many recipients or all contacts. */
  | "bulk"
  /** Touches consent, suppression or opt-out evidence. */
  | "compliance"
  | "configuration";

export interface WhatsappControlPlanePermission {
  readonly code: string;
  readonly area: WhatsappControlPlaneArea;
  readonly risk: WhatsappControlPlaneRisk;
  readonly status: "existing" | "planned";
  /** Migration file for `existing`; roadmap phase for `planned`. */
  readonly source: string;
  readonly grantedTo: readonly CrmOperationalRoleCode[];
  readonly note: string;
}

const SA_SM = ["super_admin", "sales_manager"] as const;
const SA_SM_MGMT = ["super_admin", "sales_manager", "management"] as const;
const INBOX_ALL = [
  "super_admin",
  "sales_manager",
  "management",
  "sales_executive",
  "sales",
] as const;

export const WHATSAPP_CONTROL_PLANE_PERMISSIONS: readonly WhatsappControlPlanePermission[] = [
  // ---- existing: inbox (M19) ---------------------------------------------
  {
    code: "whatsapp.inbox.read",
    area: "inbox",
    risk: "read",
    status: "existing",
    source: "20260805140000_whatsapp_shared_inbox_send_intent_foundation.sql",
    grantedTo: INBOX_ALL,
    note: "Scope is leads.assigned_to or manage scope, enforced by RLS.",
  },
  {
    code: "whatsapp.inbox.use",
    area: "inbox",
    risk: "one_to_one",
    status: "existing",
    source: "20260805140000_whatsapp_shared_inbox_send_intent_foundation.sql",
    grantedTo: INBOX_ALL,
    note: "WHATSAPP_SERVICE send intents only. MARKETING rejected.",
  },
  {
    code: "whatsapp.inbox.manage",
    area: "inbox",
    risk: "read",
    status: "existing",
    source: "20260805140000_whatsapp_shared_inbox_send_intent_foundation.sql",
    grantedTo: SA_SM_MGMT,
    note: "Broad linked scope and unlinked/ambiguous triage.",
  },
  // ---- existing: generic campaign governance (M31 / M33), reused ----------
  {
    code: "campaigns.read",
    area: "campaigns",
    risk: "read",
    status: "existing",
    source: "20260818140000_campaign_consent_audience_approval_foundation.sql",
    grantedTo: SA_SM,
    note: "Reused for WhatsApp campaigns.",
  },
  {
    code: "campaigns.draft",
    area: "campaigns",
    risk: "configuration",
    status: "existing",
    source: "20260818140000_campaign_consent_audience_approval_foundation.sql",
    grantedTo: SA_SM,
    note: "Reused: drafts the version and its WhatsApp spec.",
  },
  {
    code: "campaigns.request_approval",
    area: "campaigns",
    risk: "configuration",
    status: "existing",
    source: "20260818140000_campaign_consent_audience_approval_foundation.sql",
    grantedTo: SA_SM,
    note: "Reused. Submitting freezes the WhatsApp spec.",
  },
  {
    code: "campaigns.approve",
    area: "campaigns",
    risk: "bulk",
    status: "existing",
    source: "20260818140000_campaign_consent_audience_approval_foundation.sql",
    grantedTo: SA_SM,
    note: "Reused. Sales Manager self-approval stays denied in the database.",
  },
  {
    code: "marketing_consents.manage",
    area: "contacts",
    risk: "compliance",
    status: "existing",
    source: "20260818140000_campaign_consent_audience_approval_foundation.sql",
    grantedTo: SA_SM,
    note: "Records staff-evidenced MARKETING granted/withdrawn on consent_events.",
  },
  {
    code: "campaigns.execute",
    area: "campaigns",
    risk: "bulk",
    status: "existing",
    source: "20260820140000_campaign_execution_foundation.sql",
    grantedTo: SA_SM,
    note: "Paid-ads runs only. NOT sufficient for a WhatsApp run.",
  },
  {
    code: "campaigns.pause",
    area: "campaigns",
    risk: "bulk",
    status: "existing",
    source: "20260820140000_campaign_execution_foundation.sql",
    grantedTo: SA_SM,
    note: "Reused for WhatsApp run pause/resume (safety-increasing).",
  },
  {
    code: "campaigns.metrics.read",
    area: "analytics",
    risk: "read",
    status: "existing",
    source: "20260820140000_campaign_execution_foundation.sql",
    grantedTo: SA_SM,
    note: "Reused for WhatsApp campaign funnel metrics.",
  },
  // ---- planned ------------------------------------------------------------
  {
    code: "whatsapp.templates.read",
    area: "templates",
    risk: "read",
    status: "planned",
    source: "WM-2",
    grantedTo: SA_SM,
    note: "Template Studio: every registry row, including pending/rejected.",
  },
  {
    code: "whatsapp.templates.use",
    area: "templates",
    risk: "one_to_one",
    status: "planned",
    source: "WM-2",
    grantedTo: ["super_admin", "sales_manager", "sales_executive"],
    note: "Insert an APPROVED template into a conversation the actor can already use. Never bulk.",
  },
  {
    code: "whatsapp.templates.manage",
    area: "templates",
    risk: "configuration",
    status: "planned",
    source: "WM-2",
    grantedTo: SA_SM,
    note: "Sync, draft, submit to Meta.",
  },
  {
    code: "whatsapp.contacts.read",
    area: "contacts",
    risk: "bulk",
    status: "planned",
    source: "WM-3",
    grantedTo: SA_SM,
    note: "Global contact workspace. Executives see contacts only through assigned leads.",
  },
  {
    code: "whatsapp.opt_out.record",
    area: "contacts",
    risk: "compliance",
    status: "planned",
    source: "WM-3",
    grantedTo: ["super_admin", "sales_manager", "sales_executive"],
    note: "Restrictive only: record a customer's opt-out within usable conversation scope. Cannot grant or clear.",
  },
  {
    code: "whatsapp.segments.read",
    area: "segments",
    risk: "read",
    status: "planned",
    source: "WM-3",
    grantedTo: SA_SM,
    note: "Saved allowlisted rule definitions and non-PII preview counts.",
  },
  {
    code: "whatsapp.segments.manage",
    area: "segments",
    risk: "configuration",
    status: "planned",
    source: "WM-3",
    grantedTo: SA_SM,
    note: "Allowlisted fields and operators only. No SQL from the UI.",
  },
  {
    code: "whatsapp.settings.read",
    area: "settings",
    risk: "read",
    status: "planned",
    source: "WM-3",
    grantedTo: SA_SM,
    note: "Send policy, account/template health.",
  },
  {
    code: "whatsapp.settings.manage",
    area: "settings",
    risk: "configuration",
    status: "planned",
    source: "WM-3",
    grantedTo: ["super_admin"],
    note: "Frequency caps, quiet hours, marketing execution gate.",
  },
  {
    code: "whatsapp.campaigns.execute",
    area: "campaigns",
    risk: "bulk",
    status: "planned",
    source: "WM-4",
    grantedTo: SA_SM,
    note: "Create/schedule a WhatsApp run from a version approved by someone else.",
  },
  {
    code: "whatsapp.campaigns.test_send",
    area: "campaigns",
    risk: "one_to_one",
    status: "planned",
    source: "WM-4",
    grantedTo: SA_SM,
    note: "Send a draft spec only to registered internal test numbers.",
  },
  {
    code: "whatsapp.campaigns.cancel",
    area: "campaigns",
    risk: "bulk",
    status: "planned",
    source: "WM-4",
    grantedTo: ["super_admin"],
    note: "Mirrors 9C: cancel is Super Admin; Sales Manager pauses.",
  },
  {
    code: "whatsapp.analytics.read",
    area: "analytics",
    risk: "read",
    status: "planned",
    source: "WM-5",
    grantedTo: SA_SM,
    note: "Channel-wide delivery, response and health analytics (aggregates).",
  },
  {
    code: "whatsapp.reports.export",
    area: "analytics",
    risk: "bulk",
    status: "planned",
    source: "WM-5",
    grantedTo: ["super_admin"],
    note: "Minimised, audited per-recipient report export.",
  },
  {
    code: "whatsapp.automations.read",
    area: "automations",
    risk: "read",
    status: "planned",
    source: "WM-6",
    grantedTo: SA_SM,
    note: "Journey definitions and enrolment evidence.",
  },
  {
    code: "whatsapp.automations.manage",
    area: "automations",
    risk: "bulk",
    status: "planned",
    source: "WM-6",
    grantedTo: SA_SM,
    note: "Drafting only; activation requires generic campaign approval.",
  },
  {
    code: "whatsapp.flows.read",
    area: "flows",
    risk: "read",
    status: "planned",
    source: "WM-6",
    grantedTo: SA_SM,
    note: "Flow definitions and submission evidence.",
  },
  {
    code: "whatsapp.flows.manage",
    area: "flows",
    risk: "configuration",
    status: "planned",
    source: "WM-6",
    grantedTo: SA_SM,
    note: "Create/publish official WhatsApp Flows.",
  },
];

/**
 * Codes a Sales Executive must never hold by default. Each one reaches beyond
 * the executive's own assigned conversations, or mutates compliance truth.
 */
export const SALES_EXECUTIVE_FORBIDDEN_WHATSAPP_CODES = [
  "whatsapp.inbox.manage",
  "campaigns.draft",
  "campaigns.request_approval",
  "campaigns.approve",
  "campaigns.execute",
  "campaigns.pause",
  "marketing_consents.manage",
  "whatsapp.templates.manage",
  "whatsapp.contacts.read",
  "whatsapp.segments.read",
  "whatsapp.segments.manage",
  "whatsapp.settings.manage",
  "whatsapp.campaigns.execute",
  "whatsapp.campaigns.test_send",
  "whatsapp.campaigns.cancel",
  "whatsapp.reports.export",
  "whatsapp.automations.manage",
  "whatsapp.flows.manage",
] as const;

/** The only roles that may hold a code whose risk is `bulk`. */
export const WHATSAPP_BULK_AUTHORITY_ROLES = ["super_admin", "sales_manager"] as const;

export function whatsappControlPlaneCodesForRole(
  role: CrmOperationalRoleCode,
  include: "existing" | "target" = "target"
): ReadonlySet<string> {
  return new Set(
    WHATSAPP_CONTROL_PLANE_PERMISSIONS.filter(
      (entry) =>
        (include === "target" || entry.status === "existing") &&
        entry.grantedTo.includes(role)
    ).map((entry) => entry.code)
  );
}

/**
 * Permission is necessary, never sufficient. A WhatsApp run additionally
 * requires an approved WhatsApp-only version whose approver is not the actor
 * when the actor is a Sales Manager (DB-enforced self-approval rule).
 */
export const WHATSAPP_RUN_EXECUTION_REQUIRES = [
  "whatsapp.campaigns.execute",
  "campaigns.read",
] as const;
