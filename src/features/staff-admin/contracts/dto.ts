/**
 * Phase 6D-A — staff administration DTO contracts.
 */

import {
  isStaffAssignableRoleCode,
  type StaffAssignableRoleCode,
  type StaffInvitationStateCode,
  type StaffProfileStatusCode,
  type StaffReconciliationStateCode,
} from "./permissions.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

const EMPLOYEE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface StaffListItem {
  readonly staffId: string;
  readonly employeeCode: string;
  readonly displayName: string;
  readonly designation: string;
  readonly roleCode: StaffAssignableRoleCode | "super_admin";
  readonly managerName: string | null;
  readonly status: StaffProfileStatusCode;
  readonly joiningDate: string;
}

export interface StaffDetailAuditSummary {
  readonly lastEventType: string | null;
  readonly lastEventAt: string | null;
}

export interface StaffDetail extends StaffListItem {
  readonly phoneE164: string | null;
  readonly email: string | null;
  readonly attendanceEligible: boolean;
  readonly policyName: string | null;
  readonly auditSummary: StaffDetailAuditSummary;
}

export interface CreateStaffMemberInput {
  readonly clientRequestId: string;
  readonly employeeCode: string;
  readonly displayName: string;
  readonly email: string;
  readonly phoneE164?: string | null;
  readonly designation: string;
  readonly joiningDate: string;
  readonly roleCode: StaffAssignableRoleCode;
  readonly reportingManagerId?: string | null;
  readonly attendanceEligible: boolean;
  readonly attendancePolicyId?: string | null;
}

export interface CreateStaffMemberResult {
  readonly staffId: string;
  readonly employeeCode: string;
  readonly profileStatus: Extract<StaffProfileStatusCode, "pending" | "active">;
  readonly invitationState: StaffInvitationStateCode;
  readonly reconciliationState: StaffReconciliationStateCode;
  readonly idempotentReplay: boolean;
}

export interface StaffValidationError {
  readonly field: string;
  readonly message: string;
}

export interface SetStaffStatusInput {
  readonly staffId: string;
  readonly status: StaffProfileStatusCode;
  readonly reason: string;
}

export interface SetReportingManagerInput {
  readonly staffId: string;
  readonly managerId: string | null;
  readonly reason: string;
}

export interface UpdateStaffEmploymentInput {
  readonly staffId: string;
  readonly employeeCode?: string | null;
  readonly designation?: string | null;
  readonly joiningDate?: string | null;
  readonly phoneE164?: string | null;
  readonly displayName?: string | null;
  readonly attendanceEligible?: boolean | null;
  readonly attendancePolicyId?: string | null;
  readonly reason?: string | null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function normalizeEmployeeCode(value: string): string {
  return value.trim().toUpperCase();
}

export function validateCreateStaffMemberInput(
  input: CreateStaffMemberInput
): readonly StaffValidationError[] {
  const errors: StaffValidationError[] = [];

  if (!isUuid(input.clientRequestId)) {
    errors.push({
      field: "clientRequestId",
      message: "Client request id must be a valid UUID.",
    });
  }

  const employeeCode = normalizeEmployeeCode(input.employeeCode);
  if (!EMPLOYEE_CODE_PATTERN.test(employeeCode)) {
    errors.push({
      field: "employeeCode",
      message:
        "Employee code must be 3–32 characters using A-Z, 0-9, underscore, or hyphen.",
    });
  }

  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > 120) {
    errors.push({
      field: "displayName",
      message: "Display name must be between 1 and 120 characters.",
    });
  }

  const email = input.email.trim().toLowerCase();
  if (email.length === 0 || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.push({
      field: "email",
      message: "Email must be a valid address up to 254 characters.",
    });
  }

  const phone = normalizeOptionalText(input.phoneE164 ?? null);
  if (phone && !E164_PATTERN.test(phone)) {
    errors.push({
      field: "phoneE164",
      message: "Phone must be in E.164 format (for example +919876543210).",
    });
  }

  const designation = input.designation.trim();
  if (designation.length < 1 || designation.length > 120) {
    errors.push({
      field: "designation",
      message: "Designation must be between 1 and 120 characters.",
    });
  }

  if (!ISO_DATE_PATTERN.test(input.joiningDate)) {
    errors.push({
      field: "joiningDate",
      message: "Joining date must be an ISO calendar date (YYYY-MM-DD).",
    });
  }

  if (!isStaffAssignableRoleCode(input.roleCode)) {
    errors.push({
      field: "roleCode",
      message: "Select a valid operational role.",
    });
  }

  const managerId = normalizeOptionalText(input.reportingManagerId ?? null);
  if (input.roleCode === "sales_executive" && !managerId) {
    errors.push({
      field: "reportingManagerId",
      message: "Sales executives require a reporting manager.",
    });
  }

  if (managerId && !isUuid(managerId)) {
    errors.push({
      field: "reportingManagerId",
      message: "Reporting manager id must be a valid UUID.",
    });
  }

  if (input.attendanceEligible && !input.attendancePolicyId) {
    errors.push({
      field: "attendancePolicyId",
      message: "Attendance policy is required when attendance is enabled.",
    });
  }

  if (input.attendancePolicyId && !isUuid(input.attendancePolicyId)) {
    errors.push({
      field: "attendancePolicyId",
      message: "Attendance policy id must be a valid UUID.",
    });
  }

  return errors;
}

export function mapCreateStaffMemberRpcResult(
  payload: unknown
): CreateStaffMemberResult {
  if (!payload || typeof payload !== "object") {
    throw new Error("Empty create_staff_member RPC result");
  }

  const record = payload as Record<string, unknown>;

  return {
    staffId: String(record.staffId ?? ""),
    employeeCode: String(record.employeeCode ?? ""),
    profileStatus:
      record.profileStatus === "active"
        ? "active"
        : "pending",
    invitationState:
      record.invitationState === "reconciliation_required"
        ? "reconciliation_required"
        : record.invitationState === "invited"
          ? "invited"
          : "completed",
    reconciliationState:
      record.reconciliationState === "auth_created_db_pending"
        ? "auth_created_db_pending"
        : record.reconciliationState === "db_created_auth_pending"
          ? "db_created_auth_pending"
          : "none",
    idempotentReplay: record.idempotentReplay === true,
  };
}
