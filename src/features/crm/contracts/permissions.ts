/**
 * Phase 5B CRM role and permission constants — aligned with
 * `20260730184426_crm_identity_core_foundation.sql`.
 */

export const CRM_PERMISSION_CODES = [
  "leads.read",
  "leads.read_all",
  "leads.read_assigned",
  "leads.manage",
  "leads.create",
  "leads.duplicate_override",
  "leads.assign",
  "leads.transition",
  "consents.read",
  "lead_intake.audit",
  "sources.read",
  "sources.manage",
  "crm.notes.manage",
  "crm.follow_ups.manage",
  "crm.activities.read",
  "leads.bulk_import",
  "leads.bulk_import_approve",
  "leads.assignment_rules.manage",
] as const;

export type CrmPermissionCode = (typeof CRM_PERMISSION_CODES)[number];

/** Canonical Phase 5B operational roles. */
export const CRM_ROLE_CODES = [
  "super_admin",
  "sales_manager",
  "sales_executive",
  "project_manager",
  "designer",
] as const;

export type CrmRoleCode = (typeof CRM_ROLE_CODES)[number];

/** Legacy seed roles retained for existing assignments. */
export const CRM_LEGACY_ROLE_CODES = [
  "management",
  "sales",
  "project_operations",
] as const;

export type CrmLegacyRoleCode = (typeof CRM_LEGACY_ROLE_CODES)[number];

export type CrmOperationalRoleCode = CrmRoleCode | CrmLegacyRoleCode;

/** Methods recorded for human assignment RPC calls (derived server-side). */
export const CRM_HUMAN_ASSIGNMENT_METHODS = [
  "manual",
  "manager",
  "super_admin",
] as const;

export type CrmHumanAssignmentMethod =
  (typeof CRM_HUMAN_ASSIGNMENT_METHODS)[number];

/** Reserved for future private/system assignment paths — not accepted from clients. */
export const CRM_RESERVED_ASSIGNMENT_METHODS = [
  "source_rule",
  "system",
] as const;

export type CrmReservedAssignmentMethod =
  (typeof CRM_RESERVED_ASSIGNMENT_METHODS)[number];

export type CrmAssignmentMethod =
  | CrmHumanAssignmentMethod
  | CrmReservedAssignmentMethod;

/** Permission grants mirrored from the Phase 5B migration role_permissions block. */
export const CRM_ROLE_PERMISSIONS: Readonly<
  Record<CrmOperationalRoleCode, readonly CrmPermissionCode[]>
> = {
  super_admin: [
    "leads.read",
    "leads.read_all",
    "leads.read_assigned",
    "leads.manage",
    "leads.create",
    "leads.duplicate_override",
    "leads.assign",
    "leads.transition",
    "consents.read",
    "lead_intake.audit",
    "sources.read",
    "sources.manage",
    "crm.notes.manage",
    "crm.follow_ups.manage",
    "crm.activities.read",
    "leads.bulk_import",
    "leads.bulk_import_approve",
    "leads.assignment_rules.manage",
  ],
  management: [
    "leads.read",
    "leads.read_all",
    "leads.manage",
    "leads.create",
    "leads.duplicate_override",
    "leads.assign",
    "leads.transition",
    "consents.read",
    "lead_intake.audit",
    "sources.read",
    "crm.notes.manage",
    "crm.follow_ups.manage",
    "crm.activities.read",
    "leads.bulk_import",
  ],
  sales_manager: [
    "leads.read_all",
    "leads.manage",
    "leads.create",
    "leads.duplicate_override",
    "leads.assign",
    "leads.transition",
    "consents.read",
    "sources.read",
    "crm.notes.manage",
    "crm.follow_ups.manage",
    "crm.activities.read",
    "leads.bulk_import",
  ],
  sales: [
    "leads.read_assigned",
    "leads.manage",
    "leads.create",
    "leads.transition",
    "consents.read",
    "sources.read",
    "crm.notes.manage",
    "crm.follow_ups.manage",
    "crm.activities.read",
  ],
  sales_executive: [
    "leads.read_assigned",
    "leads.create",
    "leads.transition",
    "consents.read",
    "sources.read",
    "crm.notes.manage",
    "crm.follow_ups.manage",
    "crm.activities.read",
  ],
  project_manager: [],
  designer: [],
  project_operations: [],
};
