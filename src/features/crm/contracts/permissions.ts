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
  "sales_targets.read",
  "sales_targets.manage",
  "crm.reporting.read",
  "crm.cadences.manage",
  /*
   * Deleting an enquiry, which is NOT `leads.transition`.
   *
   * Marking an enquiry CLOSED LOST is an ordinary lifecycle transition the
   * sales team owns: it needs a reason and a note, and the lead stays in CRM
   * history. Removing an enquiry from the business record is a different act
   * with a different authority, and the two share no permission.
   */
  "leads.delete",
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
    "sales_targets.read",
    "sales_targets.manage",
    "crm.reporting.read",
    "crm.cadences.manage",
    "leads.delete",
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
    // No leads.bulk_import: bulk enquiry upload is Super Admin only, and this
    // legacy role mirrors Sales Manager breadth closely enough that leaving it
    // here would make the restriction one role assignment away from meaningless.
    "sales_targets.read",
    "crm.reporting.read",
  ],
  /*
   * SALES MANAGER — authority over the sales team, not a second owner.
   *
   * `leads.transition` stays: marking an enquiry CLOSED LOST is the sales job.
   * What left this list is the owner control plane it had accumulated —
   * `leads.bulk_import` and `leads.duplicate_override` — because loading
   * enquiries in bulk and forcing one past duplicate protection are both acts
   * the owner takes responsibility for. `leads.delete` was never here.
   */
  sales_manager: [
    "leads.read_all",
    "leads.manage",
    "leads.create",
    "leads.assign",
    "leads.transition",
    "consents.read",
    "sources.read",
    "crm.notes.manage",
    "crm.follow_ups.manage",
    "crm.activities.read",
    "sales_targets.read",
    "crm.reporting.read",
    "crm.cadences.manage",
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
    "sales_targets.read",
    "crm.reporting.read",
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
    "sales_targets.read",
    "crm.reporting.read",
  ],
  project_manager: [],
  designer: [],
  project_operations: [],
};
