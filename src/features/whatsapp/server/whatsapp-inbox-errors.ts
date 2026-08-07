/**
 * Phase 6B-B1 — normalized WhatsApp inbox / send-intent errors.
 */

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
