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
