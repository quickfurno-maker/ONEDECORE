import "server-only";

export type CrmErrorCode =
  | "AUTH_REQUIRED"
  | "PERMISSION_DENIED"
  | "LEAD_NOT_FOUND"
  | "INVALID_TRANSITION"
  | "INVALID_ASSIGNMENT"
  | "VALIDATION_FAILED"
  | "RPC_FAILED";

export class CrmError extends Error {
  readonly code: CrmErrorCode;
  readonly httpStatus: number;
  readonly details?: string;

  constructor(input: {
    code: CrmErrorCode;
    message: string;
    httpStatus: number;
    details?: string;
  }) {
    super(input.message);
    this.name = "CrmError";
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.details = input.details;
  }
}

export function crmErrorFromPostgresMessage(
  message: string,
  fallbackCode: CrmErrorCode = "RPC_FAILED"
): CrmError {
  const normalised = message.toLowerCase();

  if (normalised.includes("authentication required")) {
    return new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
      details: message,
    });
  }

  if (
    normalised.includes("permission denied") ||
    normalised.includes("not visible")
  ) {
    return new CrmError({
      code: "PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
      details: message,
    });
  }

  if (normalised.includes("not found")) {
    return new CrmError({
      code: "LEAD_NOT_FOUND",
      message: "Lead not found",
      httpStatus: 404,
      details: message,
    });
  }

  if (normalised.includes("invalid lead status transition")) {
    return new CrmError({
      code: "INVALID_TRANSITION",
      message: "Invalid lead status transition",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("closed_won_requires_quotation_acceptance") ||
    normalised.includes("closed_lost_requires_reason") ||
    normalised.includes("terminal lead status")
  ) {
    return new CrmError({
      code: "INVALID_TRANSITION",
      message: "Lead status transition rejected",
      httpStatus: 422,
      details: message,
    });
  }

  if (
    normalised.includes("assignee is not an active eligible sales user") ||
    normalised.includes("invalid assignment method")
  ) {
    return new CrmError({
      code: "INVALID_ASSIGNMENT",
      message: "Lead assignment rejected",
      httpStatus: 422,
      details: message,
    });
  }

  return new CrmError({
    code: fallbackCode,
    message: "CRM operation failed",
    httpStatus: 500,
    details: message,
  });
}
