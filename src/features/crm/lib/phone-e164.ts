/**
 * Manual CRM lead phone policy: staff enter exactly 10 Indian digits.
 * Server canonicalizes to E.164 +91XXXXXXXXXX for duplicate/create contracts.
 */

export const MANUAL_LEAD_PHONE_DIGITS_PATTERN = /^\d{10}$/;

export const MANUAL_LEAD_PHONE_ERROR_MESSAGE =
  "Enter a valid 10-digit mobile number.";

/** @deprecated Prefer MANUAL_LEAD_PHONE_ERROR_MESSAGE */
export const PHONE_FIELD_ERROR_MESSAGE = MANUAL_LEAD_PHONE_ERROR_MESSAGE;

export type PhoneNormalizeResult =
  | { readonly kind: "empty" }
  | { readonly kind: "valid"; readonly e164: string; readonly digits: string }
  | { readonly kind: "invalid" };

/**
 * Live input sanitizer: digits only, hard-capped at 10.
 * Pasted +91XXXXXXXXXX / 91XXXXXXXXXX (12 digits) unwraps to the 10-digit mobile.
 */
export function sanitizeManualLeadPhoneInput(raw: string): string {
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 10);
}

/**
 * Accepts only empty or exactly 10 digits (no +91, no 91-prefix, no E.164).
 * Canonical storage/preview value is +91XXXXXXXXXX.
 */
export function normalizeManualLeadPhone(
  raw: string | null | undefined
): PhoneNormalizeResult {
  if (raw == null) {
    return { kind: "empty" };
  }

  const trimmed = String(raw).trim();
  if (trimmed.length === 0) {
    return { kind: "empty" };
  }

  // Strict: raw must already be exactly 10 digits (no punctuation/plus/spaces).
  if (!MANUAL_LEAD_PHONE_DIGITS_PATTERN.test(trimmed)) {
    return { kind: "invalid" };
  }

  return {
    kind: "valid",
    digits: trimmed,
    e164: `+91${trimmed}`,
  };
}

export function canonicalizeOptionalPhone(
  raw: string | null | undefined
): { readonly phone: string | null; readonly error: string | null } {
  const result = normalizeManualLeadPhone(raw);
  if (result.kind === "empty") {
    return { phone: null, error: null };
  }
  if (result.kind === "invalid") {
    return { phone: null, error: MANUAL_LEAD_PHONE_ERROR_MESSAGE };
  }
  return { phone: result.e164, error: null };
}
