/**
 * Phase 6B — normalized WhatsApp inbox errors.
 */

export type WhatsappInboxErrorCode =
  | "AUTH_REQUIRED"
  | "ACCESS_DENIED"
  | "NOT_FOUND"
  | "RPC_FAILED"
  | "VALIDATION";

export class WhatsappInboxError extends Error {
  readonly code: WhatsappInboxErrorCode;
  readonly httpStatus: number;

  constructor(options: {
    code: WhatsappInboxErrorCode;
    message: string;
    httpStatus: number;
  }) {
    super(options.message);
    this.name = "WhatsappInboxError";
    this.code = options.code;
    this.httpStatus = options.httpStatus;
  }
}

export function whatsappInboxErrorFromPostgresMessage(
  message: string,
  fallbackCode: WhatsappInboxErrorCode = "RPC_FAILED"
): WhatsappInboxError {
  if (message.includes("42501") || message.includes("denied_conversation_scope")) {
    return new WhatsappInboxError({
      code: "ACCESS_DENIED",
      message,
      httpStatus: 403,
    });
  }

  return new WhatsappInboxError({
    code: fallbackCode,
    message,
    httpStatus: fallbackCode === "AUTH_REQUIRED" ? 401 : 500,
  });
}

export function isWhatsappInboxAccessDeniedError(message: string): boolean {
  return (
    message.includes("denied_conversation_scope") ||
    message.includes("42501")
  );
}

export function isWhatsappIdempotencyConflictError(message: string): boolean {
  return message.includes("idempotency_conflict");
}

export function isWhatsappPurposeDeniedError(message: string): boolean {
  return message.includes("denied_purpose");
}

export function isWhatsappEligibilityDeniedError(message: string): boolean {
  return (
    message.includes("denied_dnc") ||
    message.includes("denied_channel_suppressed") ||
    message.includes("denied_missing_consent") ||
    message.includes("denied_missing_contact")
  );
}
