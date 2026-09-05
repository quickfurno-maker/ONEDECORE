/**
 * The staff login username contract, in ONE place.
 *
 * Staff type exactly 10 Indian mobile digits. The server canonicalizes to
 * +91XXXXXXXXXX and nothing else is ever stored, compared, or sent to Supabase
 * Auth. The employee code and the work email are never login identifiers.
 *
 *   shown to staff : 7447863402
 *   canonical      : +917447863402
 *
 * Input sanitising is delegated to the existing CRM E.164 helper so the two
 * phone surfaces cannot drift apart. This module adds only what the login
 * contract needs on top: the real Indian MOBILE range.
 *
 * TRANSPORT NOTE — the Supabase Phone provider is DISABLED and stays disabled.
 * Hosted Supabase password auth accepts only an email or a phone identifier, so
 * the phone transport is unavailable: a live stack answered a staff sign-in with
 * `422 phone_provider_disabled`. Staff still have exactly one identifier they
 * ever see or type — their 10-digit mobile — and the server derives a
 * deterministic, non-deliverable auth alias from it for the email/password
 * transport. See `staffLoginAuthAlias`. There is no OTP and no SMS anywhere in
 * this system.
 */

import { sanitizeManualLeadPhoneInput } from "../../crm/lib/phone-e164.ts";

/** Exactly 10 digits, starting in the Indian mobile range. */
export const STAFF_LOGIN_PHONE_PATTERN = /^[6-9]\d{9}$/;

/** Canonical stored/transmitted form. Mirrors the database check constraint. */
export const STAFF_LOGIN_PHONE_E164_PATTERN = /^\+91[6-9]\d{9}$/;

export const STAFF_LOGIN_PHONE_ERROR_MESSAGE =
  "Enter the staff member's 10-digit Indian mobile number.";

/** Owner-locked minimum. Supabase Auth holds the password; we never see it again. */
export const STAFF_PASSWORD_MIN_LENGTH = 10;

export const STAFF_PASSWORD_LENGTH_ERROR_MESSAGE = `Use at least ${STAFF_PASSWORD_MIN_LENGTH} characters.`;

export const STAFF_PASSWORD_MISMATCH_ERROR_MESSAGE = "Both passwords must match.";

export type StaffLoginPhoneResult =
  | { readonly ok: true; readonly e164: string; readonly digits: string }
  | { readonly ok: false; readonly message: string };

/** Live input sanitiser for the credential form: digits only, capped at 10. */
export function sanitizeStaffLoginPhoneInput(raw: string): string {
  return sanitizeManualLeadPhoneInput(raw);
}

/**
 * Accepts the 10-digit form staff type, and the pasted +91/91 12-digit form.
 * Everything else is rejected rather than repaired: a 9- or 11-digit value is a
 * typo, and guessing at it would hand someone a login they did not ask for.
 */
export function normalizeStaffLoginPhone(
  raw: string | null | undefined
): StaffLoginPhoneResult {
  if (raw == null) {
    return { ok: false, message: STAFF_LOGIN_PHONE_ERROR_MESSAGE };
  }

  const trimmed = String(raw).trim();
  if (trimmed.length === 0) {
    return { ok: false, message: STAFF_LOGIN_PHONE_ERROR_MESSAGE };
  }

  // Reject anything carrying characters that are neither digits nor the leading
  // "+" of an E.164 value, so "74478 63402" and "+91-744..." do not silently
  // become a login identifier through a permissive strip.
  if (!/^\+?\d+$/.test(trimmed)) {
    return { ok: false, message: STAFF_LOGIN_PHONE_ERROR_MESSAGE };
  }

  const digits = trimmed.replace(/\D/g, "");
  const local =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;

  if (!STAFF_LOGIN_PHONE_PATTERN.test(local)) {
    return { ok: false, message: STAFF_LOGIN_PHONE_ERROR_MESSAGE };
  }

  return { ok: true, digits: local, e164: `+91${local}` };
}

/** The 10 digits shown to staff as their username, derived from the canonical value. */
export function staffLoginUsername(e164: string | null | undefined): string | null {
  if (!e164 || !STAFF_LOGIN_PHONE_E164_PATTERN.test(e164)) {
    return null;
  }
  return e164.slice(-10);
}

/**
 * True when the login form input is a staff mobile rather than an email.
 *
 * Deliberately narrow: only a bare 10-digit mobile routes to the staff path, so
 * an email address can never be misread as a phone number and the Super Admin's
 * existing email/password login is untouched.
 */
export function looksLikeStaffLoginPhone(identifier: string): boolean {
  return STAFF_LOGIN_PHONE_PATTERN.test(identifier.trim());
}

/* -------------------------------------------------------------------------- */
/* Internal auth alias — a transport detail, never an identity                 */
/* -------------------------------------------------------------------------- */

/**
 * RFC 2606 reserves `.invalid`, so this domain can never resolve and no message
 * can ever be delivered to it. That is the point: the alias exists only to
 * satisfy Supabase's email/password transport, and must be impossible to
 * mistake for a way to contact anyone.
 */
export const STAFF_LOGIN_AUTH_ALIAS_DOMAIN = "staff-login.onedecore.invalid";

/**
 * The server-only Supabase Auth identifier derived from a staff login number.
 *
 *   7447863402 -> 7447863402@staff-login.onedecore.invalid
 *
 * WHY THIS EXISTS
 *
 * The owner's decision is that a staff member's 10-digit mobile is their only
 * login ID, with no OTP and no SMS. Hosted Supabase password auth accepts only
 * an email or a phone identifier, and the Phone provider is disabled — a live
 * stack rejects staff sign-in with `422 phone_provider_disabled`. So the phone
 * cannot be the transport identifier even though it is the only identifier the
 * business recognises.
 *
 * The alias closes that gap without inventing a second staff-visible identity:
 * it is derived, never chosen; server-only, never typed; and it carries no
 * information the 10-digit number does not already carry.
 *
 * WHAT IT IS NOT
 *
 * It is not a staff email address. Nothing is ever sent to it, it is never
 * stored as contact information, never shown in the UI, and never accepted FROM
 * the UI — `normalizeStaffLoginPhone` rejects any input containing an "@", so an
 * address pasted into the login field can never be re-derived into an alias and
 * take the staff path.
 *
 * Returns null for anything that is not a valid canonical staff login number,
 * so a caller cannot accidentally mint an alias from arbitrary input.
 */
export function staffLoginAuthAlias(
  loginPhone: string | null | undefined
): string | null {
  const normalized = normalizeStaffLoginPhone(loginPhone);
  if (!normalized.ok) {
    return null;
  }
  return `${normalized.digits}@${STAFF_LOGIN_AUTH_ALIAS_DOMAIN}`;
}

/**
 * True for a value that is one of our internal aliases.
 *
 * Used to keep the alias out of places it must never reach — it is not a
 * credential check and grants nothing.
 */
export function isStaffLoginAuthAlias(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const [local, domain, ...rest] = value.trim().toLowerCase().split("@");
  return (
    rest.length === 0 &&
    domain === STAFF_LOGIN_AUTH_ALIAS_DOMAIN &&
    STAFF_LOGIN_PHONE_PATTERN.test(local ?? "")
  );
}

export type StaffPasswordResult =
  | { readonly ok: true; readonly password: string }
  | { readonly ok: false; readonly message: string };

/**
 * Validates a Super-Admin-supplied password and its confirmation.
 *
 * The value is returned so it can be handed straight to Supabase Auth. It is
 * never written to a database column, an audit payload, a log line, or a
 * server-action result.
 */
export function validateStaffPassword(
  password: string,
  confirmation: string
): StaffPasswordResult {
  if (password.length < STAFF_PASSWORD_MIN_LENGTH) {
    return { ok: false, message: STAFF_PASSWORD_LENGTH_ERROR_MESSAGE };
  }

  // GoTrue's own ceiling; a longer value would be rejected downstream anyway.
  if (password.length > 72) {
    return { ok: false, message: "Use 72 characters or fewer." };
  }

  if (password !== confirmation) {
    return { ok: false, message: STAFF_PASSWORD_MISMATCH_ERROR_MESSAGE };
  }

  return { ok: true, password };
}
