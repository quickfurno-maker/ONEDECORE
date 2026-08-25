/**
 * Public consultation mobile UX helpers.
 * Server `normalisePhoneToE164` remains the authoritative E.164 boundary.
 * Public UI collects a national 10-digit Indian mobile only (`^[6-9][0-9]{9}$`).
 */

export const INDIAN_MOBILE_NATIONAL_PATTERN = /^[6-9][0-9]{9}$/;

export const INDIAN_MOBILE_HELPER =
  "Enter your 10-digit mobile number." as const;

export const INDIAN_MOBILE_INVALID_MESSAGE =
  "Enter a valid 10-digit mobile number." as const;

export const INDIAN_MOBILE_BLANK_MESSAGE =
  "Enter your mobile number." as const;

export function isValidIndianMobileNational(value: string): boolean {
  return INDIAN_MOBILE_NATIONAL_PATTERN.test(value);
}

export type IndianMobileAcceptResult =
  | { readonly ok: true; readonly national: string }
  | { readonly ok: false };

/**
 * Accept only unambiguous Indian mobile shapes into the public national field.
 * Never blindly truncates arbitrary digit strings to 10 characters.
 */
export function acceptIndianMobileInput(raw: string): IndianMobileAcceptResult {
  const compacted = raw
    .normalize("NFKC")
    .trim()
    .replace(/[\s\-().]/g, "");

  if (!compacted) {
    return { ok: false };
  }

  if (INDIAN_MOBILE_NATIONAL_PATTERN.test(compacted)) {
    return { ok: true, national: compacted };
  }

  if (/^\+91[6-9][0-9]{9}$/.test(compacted)) {
    return { ok: true, national: compacted.slice(3) };
  }

  if (/^91[6-9][0-9]{9}$/.test(compacted)) {
    return { ok: true, national: compacted.slice(2) };
  }

  return { ok: false };
}

/**
 * Progressive keyboard entry: digits only, max 10, no truncation of longer strings.
 * Returns null when the change must be rejected (keep prior controlled value).
 */
export function acceptIndianMobileKeystroke(
  raw: string
): IndianMobileAcceptResult | { readonly ok: true; readonly national: string } {
  const unambiguous = acceptIndianMobileInput(raw);
  if (unambiguous.ok) {
    return unambiguous;
  }

  if (/^\d{0,10}$/.test(raw)) {
    return { ok: true, national: raw };
  }

  // Digit-only but too long, or mixed junk that is not an unambiguous +91/91 paste.
  return { ok: false };
}

/** Canonical E.164 for a validated national Indian mobile (matches server rule). */
export function indianMobileNationalToE164(national: string): string | null {
  if (!isValidIndianMobileNational(national)) {
    return null;
  }
  return `+91${national}`;
}
