/**
 * WM-3…WM-6 — the WhatsApp workspace control plane, as data: the section
 * nav and the permission codes every WhatsApp page answers to.
 *
 * Authoritative permission model:
 * supabase/migrations/20260914100000_whatsapp_contacts_consent_segments_policy.sql
 *
 *   whatsapp.contacts.read    Super Admin, Sales Manager
 *   whatsapp.opt_out.record   Super Admin, Sales Manager, Sales Executive
 *                             (an executive only inside a conversation they
 *                             may use, decided by leads.assigned_to in SQL)
 *   whatsapp.segments.read    Super Admin, Sales Manager
 *   whatsapp.segments.manage  Super Admin, Sales Manager
 *   whatsapp.settings.read    Super Admin, Sales Manager
 *   whatsapp.settings.manage  Super Admin (the RPC also requires the role)
 *
 * Legacy `management` and `sales` hold none of these. Nothing in this file
 * grants anything: it names what the database already decides, so pages can
 * hide a control the database would refuse anyway.
 */

export const WHATSAPP_ADMIN_INBOX_PATH = "/admin/whatsapp/inbox";
export const WHATSAPP_ADMIN_CONTACTS_PATH = "/admin/whatsapp/contacts";
export const WHATSAPP_ADMIN_TEMPLATES_PATH = "/admin/whatsapp/templates";
export const WHATSAPP_ADMIN_CAMPAIGNS_PATH = "/admin/whatsapp/campaigns";
export const WHATSAPP_ADMIN_SCHEDULER_PATH = "/admin/whatsapp/scheduler";
export const WHATSAPP_ADMIN_SEGMENTS_PATH = "/admin/whatsapp/segments";
export const WHATSAPP_ADMIN_AUTOMATIONS_PATH = "/admin/whatsapp/automations";
export const WHATSAPP_ADMIN_FLOWS_PATH = "/admin/whatsapp/forms-flows";
export const WHATSAPP_ADMIN_ANALYTICS_PATH = "/admin/whatsapp/analytics";
export const WHATSAPP_ADMIN_SETTINGS_PATH = "/admin/whatsapp/settings";

export const WHATSAPP_CONTROL_PLANE_PERMISSION_CODES = [
  "whatsapp.inbox.read",
  "whatsapp.templates.read",
  "whatsapp.contacts.read",
  "whatsapp.opt_out.record",
  "whatsapp.segments.read",
  "whatsapp.segments.manage",
  "whatsapp.settings.read",
  "whatsapp.settings.manage",
  /** Pre-existing CRM permission that `record_whatsapp_marketing_preference` requires. */
  "marketing_consents.manage",
  /** Generic campaign governance, reused: Super Admin authors the WhatsApp spec of a draft version. */
  "campaigns.read",
  "campaigns.draft",
  /** WM-4 campaign execution: execute + test_send (SA, SM); cancel (SA). */
  "whatsapp.campaigns.execute",
  "whatsapp.campaigns.test_send",
  "whatsapp.campaigns.cancel",
  /** WM-5 analytics (SA, SM) and minimised audited export (SA). */
  "whatsapp.analytics.read",
  "whatsapp.reports.export",
  /** WM-6 automations and official Flows (SA, SM). */
  "whatsapp.automations.read",
  "whatsapp.automations.manage",
  "whatsapp.flows.read",
  "whatsapp.flows.manage",
] as const;

export type WhatsappControlPlanePermissionCode = (typeof WHATSAPP_CONTROL_PLANE_PERMISSION_CODES)[number];

export type WhatsappControlPlanePermissions = Readonly<Record<WhatsappControlPlanePermissionCode, boolean>>;

/**
 * The complete WhatsApp workspace, in the locked order. `requires` is the
 * exact code the section's own page checks, so the nav can never offer a page
 * that answers with a wall.
 */
export const WHATSAPP_CONTROL_PLANE_SECTIONS = [
  { key: "inbox", label: "Inbox", href: WHATSAPP_ADMIN_INBOX_PATH, requires: "whatsapp.inbox.read" },
  { key: "contacts", label: "Contacts", href: WHATSAPP_ADMIN_CONTACTS_PATH, requires: "whatsapp.contacts.read" },
  { key: "templates", label: "Templates", href: WHATSAPP_ADMIN_TEMPLATES_PATH, requires: "whatsapp.templates.read" },
  { key: "campaigns", label: "Campaigns", href: WHATSAPP_ADMIN_CAMPAIGNS_PATH, requires: "whatsapp.campaigns.execute" },
  { key: "scheduler", label: "Scheduler", href: WHATSAPP_ADMIN_SCHEDULER_PATH, requires: "whatsapp.campaigns.execute" },
  { key: "segments", label: "Segments", href: WHATSAPP_ADMIN_SEGMENTS_PATH, requires: "whatsapp.segments.read" },
  { key: "automations", label: "Automations", href: WHATSAPP_ADMIN_AUTOMATIONS_PATH, requires: "whatsapp.automations.read" },
  { key: "flows", label: "Forms / Flows", href: WHATSAPP_ADMIN_FLOWS_PATH, requires: "whatsapp.flows.read" },
  { key: "analytics", label: "Analytics", href: WHATSAPP_ADMIN_ANALYTICS_PATH, requires: "whatsapp.analytics.read" },
  { key: "settings", label: "Settings & Compliance", href: WHATSAPP_ADMIN_SETTINGS_PATH, requires: "whatsapp.settings.read" },
] as const satisfies readonly {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly requires: WhatsappControlPlanePermissionCode;
}[];

export type WhatsappControlPlaneSectionKey = (typeof WHATSAPP_CONTROL_PLANE_SECTIONS)[number]["key"];

/** Only the sections this caller can open. A link to a wall is clutter. */
export function visibleWhatsappControlPlaneSections(permissions: WhatsappControlPlanePermissions) {
  return WHATSAPP_CONTROL_PLANE_SECTIONS.filter((section) => permissions[section.requires]);
}

export type WhatsappControlPlaneActionState =
  | { readonly success: true; readonly message: string }
  | { readonly success: false; readonly code: string; readonly message: string; readonly field?: string };

export const INITIAL_WHATSAPP_CONTROL_PLANE_ACTION_STATE: WhatsappControlPlaneActionState = {
  success: false,
  code: "IDLE",
  message: "",
};

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Postgres error codes the WM-3 RPCs raise, mapped to what staff can act on. */
export function describeWhatsappControlPlaneRpcError(
  error: { readonly code?: string | null; readonly message?: string | null },
  area: "opt_out" | "preference" | "consent" | "segment" | "policy"
): { readonly code: string; readonly message: string } {
  const code = error.code ?? "";
  if (code === "42501") {
    const message =
      area === "policy"
        ? "Only a Super Admin can change the WhatsApp marketing send policy."
        : area === "segment"
          ? "You do not have permission to manage WhatsApp segments."
          : area === "preference"
            ? "You do not have permission to record marketing preferences."
            : area === "consent"
              ? "You do not have permission to record marketing consent."
              : "You are not allowed to record an opt-out for this contact.";
    return { code: "ACCESS_DENIED", message };
  }
  if (code === "22023") {
    return { code: "VALIDATION", message: "The database rejected these values. Check each field and try again." };
  }
  if (code === "P0002") {
    return { code: "NOT_FOUND", message: area === "segment" ? "That segment no longer exists." : "Not found." };
  }
  if (code === "23505") {
    return { code: "CONFLICT", message: "An active segment already uses this name." };
  }
  if (code === "23503") {
    return { code: "NOT_FOUND", message: "That contact no longer exists." };
  }
  return { code: "RPC_FAILED", message: "The change could not be saved. Try again." };
}
