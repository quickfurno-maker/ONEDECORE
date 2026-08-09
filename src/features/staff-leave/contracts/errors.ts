/**
 * Phase 6D — frozen leave error vocabulary.
 * Mirrors docs/audits/phase-6d-implementation-contract-freeze.md §14.
 */

export const LEAVE_ERROR_CODES = [
  "LEAVE_UNAUTHORIZED",
  "LEAVE_OVERLAP",
  "LEAVE_INVALID_RANGE",
  "LEAVE_HALF_DAY_NOT_ALLOWED",
  "LEAVE_SELF_APPROVAL_DENIED",
  "LEAVE_NOT_CANCELLABLE",
  "LEAVE_MANAGER_SCOPE_DENIED",
] as const;

export type LeaveErrorCode = (typeof LEAVE_ERROR_CODES)[number];

export class LeaveError extends Error {
  readonly code: LeaveErrorCode;
  readonly httpStatus: number;
  readonly details?: string;

  constructor(input: {
    code: LeaveErrorCode;
    message: string;
    httpStatus: number;
    details?: string;
  }) {
    super(input.message);
    this.name = "LeaveError";
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.details = input.details;
  }
}

const LEAVE_ERROR_HTTP: Record<LeaveErrorCode, number> = {
  LEAVE_UNAUTHORIZED: 401,
  LEAVE_OVERLAP: 409,
  LEAVE_INVALID_RANGE: 422,
  LEAVE_HALF_DAY_NOT_ALLOWED: 422,
  LEAVE_SELF_APPROVAL_DENIED: 403,
  LEAVE_NOT_CANCELLABLE: 422,
  LEAVE_MANAGER_SCOPE_DENIED: 403,
};

const LEAVE_ERROR_MESSAGES: Record<LeaveErrorCode, string> = {
  LEAVE_UNAUTHORIZED: "Authentication or permission required.",
  LEAVE_OVERLAP: "Leave overlaps with an approved request.",
  LEAVE_INVALID_RANGE: "Leave request dates or state are invalid.",
  LEAVE_HALF_DAY_NOT_ALLOWED: "Selected leave type does not allow half-day requests.",
  LEAVE_SELF_APPROVAL_DENIED: "You cannot approve or reject your own leave request.",
  LEAVE_NOT_CANCELLABLE: "Approved leave cannot be cancelled.",
  LEAVE_MANAGER_SCOPE_DENIED: "Leave action is outside authorized team scope.",
};

export function createLeaveError(code: LeaveErrorCode, details?: string): LeaveError {
  return new LeaveError({
    code,
    message: LEAVE_ERROR_MESSAGES[code],
    httpStatus: LEAVE_ERROR_HTTP[code],
    details,
  });
}

/** Maps Postgres RPC exception messages to frozen leave codes. */
export function leaveErrorFromPostgresMessage(
  message: string,
  fallbackCode: LeaveErrorCode = "LEAVE_UNAUTHORIZED"
): LeaveError {
  const token = LEAVE_ERROR_CODES.find((code) => message.includes(code));
  if (token) {
    return createLeaveError(token, message);
  }

  if (message.includes("42501") || message.toLowerCase().includes("permission denied")) {
    return createLeaveError("LEAVE_UNAUTHORIZED", message);
  }

  return createLeaveError(fallbackCode, message);
}

export function isLeaveErrorCode(value: string): value is LeaveErrorCode {
  return (LEAVE_ERROR_CODES as readonly string[]).includes(value);
}
