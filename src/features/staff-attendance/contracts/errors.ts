/**
 * Phase 6D — frozen attendance error vocabulary.
 * Mirrors docs/audits/phase-6d-implementation-contract-freeze.md §11.
 */

export const ATTENDANCE_ERROR_CODES = [
  "ATTENDANCE_UNAUTHORIZED",
  "ATTENDANCE_INACTIVE_STAFF",
  "ATTENDANCE_NOT_ELIGIBLE",
  "ATTENDANCE_POLICY_MISSING",
  "ATTENDANCE_ALREADY_CHECKED_IN",
  "ATTENDANCE_NOT_CHECKED_IN",
  "ATTENDANCE_LOCATION_REQUIRED",
  "ATTENDANCE_LOCATION_INVALID",
  "ATTENDANCE_IDEMPOTENCY_CONFLICT",
  "ATTENDANCE_INVALID_CORRECTION",
  "ATTENDANCE_MANAGER_SCOPE_DENIED",
  "ATTENDANCE_POLICY_NOT_CONFIGURED",
] as const;

export type AttendanceErrorCode = (typeof ATTENDANCE_ERROR_CODES)[number];

export class AttendanceError extends Error {
  readonly code: AttendanceErrorCode;
  readonly httpStatus: number;
  readonly details?: string;

  constructor(input: {
    code: AttendanceErrorCode;
    message: string;
    httpStatus: number;
    details?: string;
  }) {
    super(input.message);
    this.name = "AttendanceError";
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.details = input.details;
  }
}

const ATTENDANCE_ERROR_HTTP: Record<AttendanceErrorCode, number> = {
  ATTENDANCE_UNAUTHORIZED: 401,
  ATTENDANCE_INACTIVE_STAFF: 401,
  ATTENDANCE_NOT_ELIGIBLE: 422,
  ATTENDANCE_POLICY_MISSING: 422,
  ATTENDANCE_ALREADY_CHECKED_IN: 409,
  ATTENDANCE_NOT_CHECKED_IN: 422,
  ATTENDANCE_LOCATION_REQUIRED: 422,
  ATTENDANCE_LOCATION_INVALID: 422,
  ATTENDANCE_IDEMPOTENCY_CONFLICT: 409,
  ATTENDANCE_INVALID_CORRECTION: 422,
  ATTENDANCE_MANAGER_SCOPE_DENIED: 403,
  ATTENDANCE_POLICY_NOT_CONFIGURED: 422,
};

const ATTENDANCE_ERROR_MESSAGES: Record<AttendanceErrorCode, string> = {
  ATTENDANCE_UNAUTHORIZED: "Authentication or permission required.",
  ATTENDANCE_INACTIVE_STAFF: "Staff account is not active.",
  ATTENDANCE_NOT_ELIGIBLE: "Attendance tracking is not enabled for this profile.",
  ATTENDANCE_POLICY_MISSING: "No attendance policy is assigned.",
  ATTENDANCE_ALREADY_CHECKED_IN: "An open check-in session already exists.",
  ATTENDANCE_NOT_CHECKED_IN: "Check-out requires an open check-in session.",
  ATTENDANCE_LOCATION_REQUIRED: "Location category is required by policy.",
  ATTENDANCE_LOCATION_INVALID: "Location details are invalid.",
  ATTENDANCE_IDEMPOTENCY_CONFLICT: "Idempotency key reused with different payload.",
  ATTENDANCE_INVALID_CORRECTION: "Attendance correction details are invalid.",
  ATTENDANCE_MANAGER_SCOPE_DENIED: "Attendance action is outside authorized team scope.",
  ATTENDANCE_POLICY_NOT_CONFIGURED: "Attendance policy is not configured.",
};

export function createAttendanceError(code: AttendanceErrorCode, details?: string): AttendanceError {
  return new AttendanceError({
    code,
    message: ATTENDANCE_ERROR_MESSAGES[code],
    httpStatus: ATTENDANCE_ERROR_HTTP[code],
    details,
  });
}

/** Maps Postgres RPC exception messages to frozen attendance codes. */
export function attendanceErrorFromPostgresMessage(
  message: string,
  fallbackCode: AttendanceErrorCode = "ATTENDANCE_UNAUTHORIZED"
): AttendanceError {
  const token = ATTENDANCE_ERROR_CODES.find((code) => message.includes(code));
  if (token) {
    return createAttendanceError(token, message);
  }

  if (message.includes("42501") || message.toLowerCase().includes("permission denied")) {
    return createAttendanceError("ATTENDANCE_UNAUTHORIZED", message);
  }

  return createAttendanceError(fallbackCode, message);
}

export function isAttendanceErrorCode(value: string): value is AttendanceErrorCode {
  return (ATTENDANCE_ERROR_CODES as readonly string[]).includes(value);
}
