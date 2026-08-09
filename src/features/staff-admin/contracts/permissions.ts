/**
 * Phase 6D — staff, attendance, and leave permission constants (M23 §A).
 */

import type { CrmRoleCode } from "../../crm/contracts/permissions.ts";

export const STAFF_PERMISSION_CODES = [
  "staff.manage",
  "staff.read",
  "attendance.self",
  "attendance.team.read",
  "attendance.read.all",
  "attendance.correct.all",
  "attendance.correct.team",
  "leave.self",
  "leave.team.approve",
  "leave.manage",
  "holidays.manage",
  "attendance.policies.manage",
] as const;

export type StaffPermissionCode = (typeof STAFF_PERMISSION_CODES)[number];

/** Operational roles assignable by Super Admin when creating staff. */
export const STAFF_ASSIGNABLE_ROLE_CODES = [
  "sales_manager",
  "sales_executive",
  "project_manager",
  "designer",
] as const;

export type StaffAssignableRoleCode = (typeof STAFF_ASSIGNABLE_ROLE_CODES)[number];

export const STAFF_PROFILE_STATUS_CODES = [
  "pending",
  "active",
  "suspended",
  "disabled",
] as const;

export type StaffProfileStatusCode = (typeof STAFF_PROFILE_STATUS_CODES)[number];

export const STAFF_INVITATION_STATE_CODES = [
  "invited",
  "reconciliation_required",
  "completed",
] as const;

export type StaffInvitationStateCode = (typeof STAFF_INVITATION_STATE_CODES)[number];

export const STAFF_RECONCILIATION_STATE_CODES = [
  "none",
  "auth_created_db_pending",
  "db_created_auth_pending",
] as const;

export type StaffReconciliationStateCode =
  (typeof STAFF_RECONCILIATION_STATE_CODES)[number];

/** Permission grants mirrored from M23 role_permissions block. */
export const STAFF_ROLE_PERMISSIONS: Readonly<
  Record<CrmRoleCode, readonly StaffPermissionCode[]>
> = {
  super_admin: [...STAFF_PERMISSION_CODES],
  sales_manager: [
    "staff.read",
    "attendance.self",
    "attendance.team.read",
    "leave.self",
    "leave.team.approve",
  ],
  sales_executive: ["attendance.self", "leave.self"],
  project_manager: [],
  designer: [],
};

export function isStaffAssignableRoleCode(
  value: string
): value is StaffAssignableRoleCode {
  return (STAFF_ASSIGNABLE_ROLE_CODES as readonly string[]).includes(value);
}

export function isStaffProfileStatusCode(
  value: string
): value is StaffProfileStatusCode {
  return (STAFF_PROFILE_STATUS_CODES as readonly string[]).includes(value);
}
