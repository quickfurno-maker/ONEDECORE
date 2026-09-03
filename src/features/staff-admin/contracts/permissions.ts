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
  // Credential administration is its own permission so it can never widen
  // by accident if staff.manage is granted to another role later.
  "staff.credentials.manage",
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
  "not_activated",
  "invited",
  "reconciliation_required",
  "completed",
] as const;

export type StaffInvitationStateCode = (typeof STAFF_INVITATION_STATE_CODES)[number];

/**
 * LOGIN identity state, distinct from employment status.
 *
 * `not_activated` means no auth user exists for this employment identity, so
 * auth.uid() can never match it and every RLS policy denies access.
 *
 * `credentials_ready` replaced the earlier `invited`: both meant exactly
 * "a login identity exists but nobody has ever signed in", and carrying two
 * names for one state forced every consumer to guess which to write.
 *
 * `revoked` is enforced in the database — `private.has_permission` returns
 * false outright — so it is never merely a UI state.
 */
export const STAFF_ACCESS_STATE_CODES = [
  "not_activated",
  "credentials_ready",
  "active",
  "revoked",
] as const;

export type StaffAccessStateCode = (typeof STAFF_ACCESS_STATE_CODES)[number];

export const STAFF_ACCESS_STATE_LABELS: Record<StaffAccessStateCode, string> = {
  not_activated: "No credentials",
  credentials_ready: "Credentials ready",
  active: "Active",
  revoked: "Revoked",
};

export function isStaffAccessStateCode(value: string): value is StaffAccessStateCode {
  return (STAFF_ACCESS_STATE_CODES as readonly string[]).includes(value);
}

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
    // Deliberately NO staff.credentials.manage: a Sales Manager must not
    // issue, reset, revoke or re-point another staff member's login.
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
