/**
 * Phase 7A — Commercial Quotation Error Normalization
 * Fail-closed, non-enumerating domain error classifications.
 * Supports Error instances, plain Supabase error objects ({ code, message, details, hint }), and raw strings.
 */

export type QuotationErrorCode =
  | "QUOTATION_UNAUTHORIZED"
  | "QUOTATION_NOT_FOUND_OR_FORBIDDEN"
  | "QUOTATION_VERSION_CONFLICT"
  | "QUOTATION_VALIDATION_FAILED"
  | "IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH"
  | "QUOTATION_DRAFT_ALREADY_EXISTS"
  | "QUOTATION_UNKNOWN_ERROR";

export class QuotationError extends Error {
  public readonly code: QuotationErrorCode;

  constructor(code: QuotationErrorCode, message: string) {
    super(message);
    this.name = "QuotationError";
    this.code = code;
  }
}

export function quotationErrorFromPostgresMessage(error: unknown): QuotationError {
  if (error instanceof QuotationError) {
    return error;
  }

  let codeStr = "";
  let messageStr = "";

  if (error instanceof Error) {
    messageStr = error.message;
  } else if (typeof error === "string") {
    messageStr = error;
  } else if (error && typeof error === "object") {
    const errObj = error as Record<string, unknown>;
    codeStr = typeof errObj.code === "string" ? errObj.code : "";
    messageStr = typeof errObj.message === "string" ? errObj.message : "";
  }

  const combined = `${codeStr} ${messageStr}`;

  if (combined.includes("QUOTATION_UNAUTHORIZED")) {
    return new QuotationError(
      "QUOTATION_UNAUTHORIZED",
      "Authentication is required to access commercial quotations."
    );
  }

  if (
    combined.includes("QUOTATION_NOT_FOUND_OR_FORBIDDEN") ||
    codeStr === "42501" ||
    combined.includes("42501")
  ) {
    return new QuotationError(
      "QUOTATION_NOT_FOUND_OR_FORBIDDEN",
      "The requested quotation does not exist or you do not have permission to access it."
    );
  }

  if (
    combined.includes("QUOTATION_VERSION_CONFLICT") ||
    codeStr === "P0002" ||
    combined.includes("P0002")
  ) {
    return new QuotationError(
      "QUOTATION_VERSION_CONFLICT",
      "This draft was modified in another tab or session. Please reload to refresh the latest state."
    );
  }

  if (combined.includes("IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH")) {
    return new QuotationError(
      "IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH",
      "The idempotency key was reused with a different request payload."
    );
  }

  if (combined.includes("QUOTATION_DRAFT_ALREADY_EXISTS")) {
    return new QuotationError(
      "QUOTATION_DRAFT_ALREADY_EXISTS",
      "An active quotation draft already exists for this lead."
    );
  }

  if (combined.includes("QUOTATION_VALIDATION_FAILED")) {
    const cleanMessage = messageStr.replace(/^.*QUOTATION_VALIDATION_FAILED:\s*/, "");
    return new QuotationError("QUOTATION_VALIDATION_FAILED", cleanMessage || "Validation failed.");
  }

  return new QuotationError(
    "QUOTATION_UNKNOWN_ERROR",
    "An unexpected commercial quotation error occurred. Please try again or contact support."
  );
}
