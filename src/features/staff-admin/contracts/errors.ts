/**
 * Phase 6D-A — staff administration error vocabulary.
 */

export const STAFF_ERROR_CODES = [
  "STAFF_UNAUTHORIZED",
  "STAFF_INACTIVE",
  "STAFF_PERMISSION_DENIED",
  "STAFF_VALIDATION_FAILED",
  "STAFF_EMPLOYEE_CODE_CONFLICT",
  "STAFF_EMAIL_INVALID",
  "STAFF_EMAIL_CONFLICT",
  "STAFF_PHONE_INVALID",
  "STAFF_INVALID_ROLE",
  "STAFF_MANAGER_REQUIRED",
  "STAFF_MANAGER_INACTIVE",
  "STAFF_REPORTING_CYCLE",
  "STAFF_PROFILE_NOT_FOUND",
  "STAFF_EMPLOYMENT_NOT_FOUND",
  "STAFF_RECONCILIATION_NOT_FOUND",
  "STAFF_STATUS_TRANSITION_DENIED",
  "STAFF_ATTENDANCE_POLICY_MISSING",
  "STAFF_INVITE_FAILED",
  "STAFF_RECONCILIATION_REQUIRED",
  "STAFF_IDEMPOTENCY_CONFLICT",
  // Phone-login credential lifecycle.
  "STAFF_CREDENTIALS_UNAUTHORIZED",
  "STAFF_CREDENTIALS_NOT_ISSUED",
  "STAFF_CREDENTIAL_OPERATION_BLOCKED",
  "STAFF_ACCESS_NOT_ACTIVE",
  "STAFF_LOGIN_PHONE_INVALID",
  "STAFF_LOGIN_PHONE_CONFLICT",
  "STAFF_LOGIN_PHONE_UNCHANGED",
  "STAFF_LOGIN_PHONE_LOCKED",
  "STAFF_ACCESS_REVOKED",
  "STAFF_ACCESS_NOT_REVOKED",
  "STAFF_ACCESS_ALREADY_ACTIVE",
  "STAFF_PASSWORD_REJECTED",
  "STAFF_REASON_REQUIRED",
  "STAFF_RPC_FAILED",
] as const;

export type StaffErrorCode = (typeof STAFF_ERROR_CODES)[number];

export class StaffError extends Error {
  readonly code: StaffErrorCode;
  readonly httpStatus: number;
  readonly details?: string;

  constructor(input: {
    code: StaffErrorCode;
    message: string;
    httpStatus: number;
    details?: string;
  }) {
    super(input.message);
    this.name = "StaffError";
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.details = input.details;
  }
}

/** Maps Postgres tokens and migration messages to staff admin errors. */
export function staffErrorFromPostgresMessage(
  message: string,
  fallbackCode: StaffErrorCode = "STAFF_RPC_FAILED"
): StaffError {
  const normalised = message.toLowerCase();

  if (
    normalised.includes("attendance_unauthorized") ||
    normalised.includes("authentication required")
  ) {
    return new StaffError({
      code: "STAFF_UNAUTHORIZED",
      message: "Authentication required",
      httpStatus: 401,
      details: message,
    });
  }

  if (normalised.includes("attendance_inactive_staff")) {
    return new StaffError({
      code: "STAFF_INACTIVE",
      message: "Staff account is not active",
      httpStatus: 403,
      details: message,
    });
  }

  // Credential lifecycle tokens are matched before the generic rules below:
  // several of them contain substrings ("unauthorized", "reason") that the
  // broader checks would otherwise swallow into a vaguer message.
  if (normalised.includes("staff_credentials_unauthorized")) {
    return new StaffError({
      code: "STAFF_CREDENTIALS_UNAUTHORIZED",
      message: "Only a Super Admin can manage staff login credentials.",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("staff_credential_operation_blocked")) {
    return new StaffError({
      code: "STAFF_CREDENTIAL_OPERATION_BLOCKED",
      message:
        "Another credential operation for this staff member has not finished. Complete or retry that one first.",
      httpStatus: 409,
      details: message,
    });
  }

  if (normalised.includes("staff_access_not_active")) {
    return new StaffError({
      code: "STAFF_ACCESS_NOT_ACTIVE",
      message: "This staff member does not have active application access.",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("staff_credentials_not_issued")) {
    return new StaffError({
      code: "STAFF_CREDENTIALS_NOT_ISSUED",
      message: "This staff member does not have login credentials yet.",
      httpStatus: 409,
      details: message,
    });
  }

  if (normalised.includes("staff_login_phone_invalid")) {
    return new StaffError({
      code: "STAFF_LOGIN_PHONE_INVALID",
      message: "Enter the staff member's 10-digit Indian mobile number.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("staff_login_phone_conflict")) {
    return new StaffError({
      code: "STAFF_LOGIN_PHONE_CONFLICT",
      message: "That mobile number is already another staff member's login.",
      httpStatus: 409,
      details: message,
    });
  }

  if (normalised.includes("staff_login_phone_unchanged")) {
    return new StaffError({
      code: "STAFF_LOGIN_PHONE_UNCHANGED",
      message: "That is already this staff member's login number.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("staff_login_phone_locked")) {
    return new StaffError({
      code: "STAFF_LOGIN_PHONE_LOCKED",
      message:
        "This staff member has login credentials, so their phone number can only be changed with Change login phone.",
      httpStatus: 409,
      details: message,
    });
  }

  if (normalised.includes("staff_access_revoked")) {
    return new StaffError({
      code: "STAFF_ACCESS_REVOKED",
      message: "Application access for this staff member is revoked.",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("staff_access_not_revoked")) {
    return new StaffError({
      code: "STAFF_ACCESS_NOT_REVOKED",
      message: "Application access is not revoked, so it cannot be reactivated.",
      httpStatus: 409,
      details: message,
    });
  }

  if (normalised.includes("staff_access_already_active")) {
    return new StaffError({
      code: "STAFF_ACCESS_ALREADY_ACTIVE",
      message:
        "This staff member has already signed in. Use Set / reset password instead.",
      httpStatus: 409,
      details: message,
    });
  }

  if (normalised.includes("staff_reason_required")) {
    return new StaffError({
      code: "STAFF_REASON_REQUIRED",
      message: "Enter a reason. This is recorded in the audit trail.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("permission denied")) {
    return new StaffError({
      code: "STAFF_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("employee_code already exists")) {
    return new StaffError({
      code: "STAFF_EMPLOYEE_CODE_CONFLICT",
      message: "Employee code is already in use.",
      httpStatus: 409,
      details: message,
    });
  }

  if (normalised.includes("invalid role for staff assignment")) {
    return new StaffError({
      code: "STAFF_INVALID_ROLE",
      message: "Selected role cannot be assigned to staff.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("sales_executive requires reporting manager")) {
    return new StaffError({
      code: "STAFF_MANAGER_REQUIRED",
      message: "Sales executives require a reporting manager.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("reporting manager must be active")) {
    return new StaffError({
      code: "STAFF_MANAGER_INACTIVE",
      message: "Reporting manager must be an active staff member.",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("reporting hierarchy cycle") ||
    normalised.includes("reporting manager cannot be self")
  ) {
    return new StaffError({
      code: "STAFF_REPORTING_CYCLE",
      message: "Reporting manager assignment would create a cycle.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("staff profile not found")) {
    return new StaffError({
      code: "STAFF_PROFILE_NOT_FOUND",
      message: "Staff profile not found.",
      httpStatus: 404,
      details: message,
    });
  }

  if (normalised.includes("employment profile not found")) {
    return new StaffError({
      code: "STAFF_EMPLOYMENT_NOT_FOUND",
      message: "Employment profile not found.",
      httpStatus: 404,
      details: message,
    });
  }

  if (normalised.includes("staff_idempotency_conflict")) {
    return new StaffError({
      code: "STAFF_IDEMPOTENCY_CONFLICT",
      message: "The same request id was used with different staff details.",
      httpStatus: 409,
      details: message,
    });
  }

  if (normalised.includes("reconciliation request not found")) {
    return new StaffError({
      code: "STAFF_RECONCILIATION_NOT_FOUND",
      message: "Reconciliation request not found.",
      httpStatus: 404,
      details: message,
    });
  }

  if (normalised.includes("disabled to active denied")) {
    return new StaffError({
      code: "STAFF_STATUS_TRANSITION_DENIED",
      message: "Disabled staff cannot be reactivated in V1.",
      httpStatus: 422,
      details: message,
    });
  }

  if (normalised.includes("attendance_policy_missing")) {
    return new StaffError({
      code: "STAFF_ATTENDANCE_POLICY_MISSING",
      message: "Attendance policy is required when attendance is enabled.",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("invalid profile status") ||
    normalised.includes("reason required") ||
    normalised.includes("validation:")
  ) {
    return new StaffError({
      code: "STAFF_VALIDATION_FAILED",
      message: "Staff details are invalid.",
      httpStatus: 422,
      details: message,
    });
  }

  return new StaffError({
    code: fallbackCode,
    message: "Staff administration operation failed",
    httpStatus: 500,
    details: message,
  });
}
