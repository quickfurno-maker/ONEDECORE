/**
 * Workforce V1 — error vocabulary.
 *
 * Deliberately separate from `ATTENDANCE_ERROR_CODES`, which is a Phase 6D
 * contract-freeze vocabulary pinned to
 * `docs/audits/phase-6d-implementation-contract-freeze.md`. That freeze is
 * historical evidence and must not be rewritten to accommodate new work, so
 * Workforce V1 carries its own codes and maps the database's exception tokens
 * onto them.
 */

export const WORKFORCE_ERROR_CODES = [
  "WORKFORCE_UNAUTHORIZED",
  "WORKFORCE_PERMISSION_DENIED",
  "WORKFORCE_APPROVAL_DENIED",
  "WORKFORCE_SELF_APPROVAL_DENIED",
  "WORKFORCE_NOT_ELIGIBLE",
  "WORKFORCE_CATEGORY_INVALID",
  "WORKFORCE_CATEGORY_REQUIRED",
  "WORKFORCE_DATE_INVALID",
  "WORKFORCE_REASON_REQUIRED",
  "WORKFORCE_WEEKLY_OFF_QUOTA_EXCEEDED",
  "WORKFORCE_ALREADY_APPROVED",
  "WORKFORCE_RPC_FAILED",
] as const;

export type WorkforceErrorCode = (typeof WORKFORCE_ERROR_CODES)[number];

const WORKFORCE_ERROR_MESSAGES: Record<WorkforceErrorCode, string> = {
  WORKFORCE_UNAUTHORIZED: "Authentication required.",
  WORKFORCE_PERMISSION_DENIED: "You do not have permission for this attendance action.",
  WORKFORCE_APPROVAL_DENIED: "Only a Super Admin can approve attendance.",
  WORKFORCE_SELF_APPROVAL_DENIED: "You cannot approve your own attendance.",
  WORKFORCE_NOT_ELIGIBLE: "Attendance tracking is not enabled for this employee.",
  WORKFORCE_CATEGORY_INVALID: "Select Weekly Off, Half Day 4H, Full Day 8H or Full Day 12H.",
  WORKFORCE_CATEGORY_REQUIRED: "A final attendance category is required to approve this day.",
  WORKFORCE_DATE_INVALID: "Attendance can only be submitted for today or an earlier day.",
  WORKFORCE_REASON_REQUIRED: "A reason is required (1–500 characters).",
  WORKFORCE_WEEKLY_OFF_QUOTA_EXCEEDED:
    "This employee already has 4 Weekly Off days this month.",
  WORKFORCE_ALREADY_APPROVED:
    "This day is already approved. A Super Admin correction is required to change it.",
  WORKFORCE_RPC_FAILED: "Attendance operation failed.",
};

const WORKFORCE_ERROR_HTTP: Record<WorkforceErrorCode, number> = {
  WORKFORCE_UNAUTHORIZED: 401,
  WORKFORCE_PERMISSION_DENIED: 403,
  WORKFORCE_APPROVAL_DENIED: 403,
  WORKFORCE_SELF_APPROVAL_DENIED: 403,
  WORKFORCE_NOT_ELIGIBLE: 403,
  WORKFORCE_CATEGORY_INVALID: 422,
  WORKFORCE_CATEGORY_REQUIRED: 422,
  WORKFORCE_DATE_INVALID: 422,
  WORKFORCE_REASON_REQUIRED: 422,
  WORKFORCE_WEEKLY_OFF_QUOTA_EXCEEDED: 422,
  WORKFORCE_ALREADY_APPROVED: 409,
  WORKFORCE_RPC_FAILED: 500,
};

export class WorkforceError extends Error {
  readonly code: WorkforceErrorCode;
  readonly httpStatus: number;
  readonly details?: string;

  constructor(input: {
    code: WorkforceErrorCode;
    message?: string;
    details?: string;
  }) {
    super(input.message ?? WORKFORCE_ERROR_MESSAGES[input.code]);
    this.name = "WorkforceError";
    this.code = input.code;
    this.httpStatus = WORKFORCE_ERROR_HTTP[input.code];
    this.details = input.details;
  }
}

export function createWorkforceError(
  code: WorkforceErrorCode,
  details?: string
): WorkforceError {
  return new WorkforceError({ code, details });
}

/**
 * Database exception tokens raised by the Workforce V1 RPCs, mapped onto the
 * client vocabulary. Matching is by explicit token, never by prose.
 */
const SQL_TOKEN_TO_CODE: ReadonlyArray<readonly [string, WorkforceErrorCode]> = [
  ["ATTENDANCE_WEEKLY_OFF_QUOTA_EXCEEDED", "WORKFORCE_WEEKLY_OFF_QUOTA_EXCEEDED"],
  ["ATTENDANCE_SELF_APPROVAL_DENIED", "WORKFORCE_SELF_APPROVAL_DENIED"],
  ["ATTENDANCE_APPROVAL_DENIED", "WORKFORCE_APPROVAL_DENIED"],
  ["ATTENDANCE_ALREADY_APPROVED", "WORKFORCE_ALREADY_APPROVED"],
  ["ATTENDANCE_CATEGORY_REQUIRED", "WORKFORCE_CATEGORY_REQUIRED"],
  ["ATTENDANCE_CATEGORY_INVALID", "WORKFORCE_CATEGORY_INVALID"],
  ["ATTENDANCE_DATE_INVALID", "WORKFORCE_DATE_INVALID"],
  ["ATTENDANCE_REASON_REQUIRED", "WORKFORCE_REASON_REQUIRED"],
  ["ATTENDANCE_PERMISSION_DENIED", "WORKFORCE_PERMISSION_DENIED"],
  ["ATTENDANCE_NOT_ELIGIBLE", "WORKFORCE_NOT_ELIGIBLE"],
  ["ATTENDANCE_UNAUTHORIZED", "WORKFORCE_UNAUTHORIZED"],
  ["ATTENDANCE_INACTIVE_STAFF", "WORKFORCE_UNAUTHORIZED"],
];

export function workforceErrorFromPostgresMessage(message: string): WorkforceError {
  for (const [token, code] of SQL_TOKEN_TO_CODE) {
    if (message.includes(token)) {
      return createWorkforceError(code, message);
    }
  }

  if (message.includes("42501") || message.toLowerCase().includes("permission denied")) {
    return createWorkforceError("WORKFORCE_PERMISSION_DENIED", message);
  }

  return createWorkforceError("WORKFORCE_RPC_FAILED", message);
}

export function isWorkforceErrorCode(value: string): value is WorkforceErrorCode {
  return (WORKFORCE_ERROR_CODES as readonly string[]).includes(value);
}
