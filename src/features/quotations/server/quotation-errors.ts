/**
 * Phase 7A — Commercial Quotation Error Normalization
 * Fail-closed, non-enumerating domain error classifications.
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

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("QUOTATION_UNAUTHORIZED")) {
    return new QuotationError(
      "QUOTATION_UNAUTHORIZED",
      "Authentication is required to access commercial quotations."
    );
  }

  if (message.includes("QUOTATION_NOT_FOUND_OR_FORBIDDEN") || message.includes("42501")) {
    return new QuotationError(
      "QUOTATION_NOT_FOUND_OR_FORBIDDEN",
      "The requested quotation does not exist or you do not have permission to access it."
    );
  }

  if (message.includes("QUOTATION_VERSION_CONFLICT")) {
    return new QuotationError(
      "QUOTATION_VERSION_CONFLICT",
      "This draft was modified in another tab or session. Please reload to refresh the latest state."
    );
  }

  if (message.includes("IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH")) {
    return new QuotationError(
      "IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH",
      "The idempotency key was reused with a different request payload."
    );
  }

  if (message.includes("QUOTATION_DRAFT_ALREADY_EXISTS")) {
    return new QuotationError(
      "QUOTATION_DRAFT_ALREADY_EXISTS",
      "An active quotation draft already exists for this lead."
    );
  }

  if (message.includes("QUOTATION_VALIDATION_FAILED")) {
    const cleanMessage = message.replace(/^.*QUOTATION_VALIDATION_FAILED:\s*/, "");
    return new QuotationError("QUOTATION_VALIDATION_FAILED", cleanMessage || "Validation failed.");
  }

  return new QuotationError(
    "QUOTATION_UNKNOWN_ERROR",
    "An unexpected commercial quotation error occurred. Please try again or contact support."
  );
}
