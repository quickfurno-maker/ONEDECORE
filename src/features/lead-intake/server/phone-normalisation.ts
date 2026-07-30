import "server-only";

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;
const INDIAN_MOBILE_10 = /^[6-9]\d{9}$/;
const INDIAN_MOBILE_WITH_ZERO = /^0[6-9]\d{9}$/;
const INDIAN_MOBILE_WITH_91 = /^91[6-9]\d{9}$/;

export type PhoneNormalisationResult =
  | { readonly ok: true; readonly e164: string }
  | { readonly ok: false; readonly code: "PHONE_INVALID" | "PHONE_AMBIGUOUS" };

/**
 * Explicit phone normalisation.
 * Does not blindly prepend +91 to ambiguous input.
 * Allows clearly valid Indian 10-digit mobiles via documented rules only.
 */
export function normalisePhoneToE164(raw: string): PhoneNormalisationResult {
  const trimmed = raw.normalize("NFKC").trim().replace(/[\s\-()]/g, "");
  if (!trimmed) {
    return { ok: false, code: "PHONE_INVALID" };
  }

  if (E164_PATTERN.test(trimmed)) {
    return { ok: true, e164: trimmed };
  }

  if (trimmed.startsWith("+")) {
    return { ok: false, code: "PHONE_INVALID" };
  }

  // Digits only from here
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, code: "PHONE_INVALID" };
  }

  if (INDIAN_MOBILE_10.test(trimmed)) {
    return { ok: true, e164: `+91${trimmed}` };
  }

  if (INDIAN_MOBILE_WITH_ZERO.test(trimmed)) {
    return { ok: true, e164: `+91${trimmed.slice(1)}` };
  }

  if (INDIAN_MOBILE_WITH_91.test(trimmed)) {
    return { ok: true, e164: `+${trimmed}` };
  }

  // Anything else digit-only without country context is ambiguous.
  return { ok: false, code: "PHONE_AMBIGUOUS" };
}

export function isValidE164(value: string): boolean {
  return E164_PATTERN.test(value);
}
