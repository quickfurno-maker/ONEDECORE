/**
 * Phase 6B-B1 — WhatsApp inbox permissions aligned with M19 migration.
 */

export const WHATSAPP_INBOX_PERMISSION_CODES = [
  "whatsapp.inbox.read",
  "whatsapp.inbox.use",
  "whatsapp.inbox.manage",
] as const;

export type WhatsappInboxPermissionCode =
  (typeof WHATSAPP_INBOX_PERMISSION_CODES)[number];

export const WHATSAPP_INBOX_CAPABILITIES = ["read", "use", "manage"] as const;

export type WhatsappInboxCapability =
  (typeof WHATSAPP_INBOX_CAPABILITIES)[number];

export const WHATSAPP_SERVICE_PURPOSE_CODE = "WHATSAPP_SERVICE" as const;

export const WHATSAPP_SEND_INTENT_LIFECYCLE_STATUSES = [
  "eligible",
  "ineligible",
  "cancelled",
  "dispatch_pending",
  "dispatch_bound",
] as const;

export type WhatsappSendIntentLifecycleStatus =
  (typeof WHATSAPP_SEND_INTENT_LIFECYCLE_STATUSES)[number];

export const WHATSAPP_SEND_DISPATCH_MODES = [
  "service_window_text",
  "template_required",
] as const;

export type WhatsappSendDispatchMode =
  (typeof WHATSAPP_SEND_DISPATCH_MODES)[number];

/** Permission grants mirrored from M19 role_permissions block. */
export const WHATSAPP_INBOX_ROLE_PERMISSIONS: Readonly<
  Record<string, readonly WhatsappInboxPermissionCode[]>
> = {
  super_admin: [
    "whatsapp.inbox.read",
    "whatsapp.inbox.use",
    "whatsapp.inbox.manage",
  ],
  sales_manager: [
    "whatsapp.inbox.read",
    "whatsapp.inbox.use",
    "whatsapp.inbox.manage",
  ],
  management: [
    "whatsapp.inbox.read",
    "whatsapp.inbox.use",
    "whatsapp.inbox.manage",
  ],
  sales_executive: ["whatsapp.inbox.read", "whatsapp.inbox.use"],
  sales: ["whatsapp.inbox.read", "whatsapp.inbox.use"],
  project_manager: [],
  designer: [],
};
