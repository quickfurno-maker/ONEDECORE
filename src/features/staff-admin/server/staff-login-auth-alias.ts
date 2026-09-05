import "server-only";

/**
 * The internal Supabase Auth transport alias for a staff login number.
 *
 * WHY THIS IS ITS OWN SERVER-ONLY MODULE
 *
 * These helpers previously lived in `contracts/staff-login-phone.ts`, which is
 * also imported by Client Components (`StaffLoginAccessPanel` needs the password
 * minimum and the display username). That put the alias domain and its
 * derivation inside the client import graph.
 *
 * A bundler would very likely have tree-shaken them out. That is not the point:
 * tree-shaking is an optimisation, not a containment boundary, and "the shipped
 * bundle probably omits it" is not the same claim as "a Client Component cannot
 * reach it". `import "server-only"` makes the second claim enforceable — any
 * client module that imports this file fails the build.
 *
 * The shared contract keeps everything user-facing: 10-digit validation, E.164
 * canonicalization, `staffLoginUsername`, and the password rules. Only the
 * transport detail moved here.
 */

import {
  STAFF_LOGIN_PHONE_PATTERN,
  normalizeStaffLoginPhone,
} from "../contracts/staff-login-phone.ts";

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
 * the UI — the login action rejects a submitted alias outright, and
 * `normalizeStaffLoginPhone` rejects any input containing an "@" so one can
 * never be re-derived from pasted text.
 *
 * Returns null for anything that is not a valid canonical staff login number,
 * so a caller cannot accidentally mint an alias from arbitrary input.
 *
 * DEPLOYMENT GATE — the alias is deterministic, so it is guessable from a staff
 * mobile number. Its secrecy is never load-bearing: an account holding one still
 * fails `authorize("admin.access")` and every RLS policy. But if the Supabase
 * project allows public signup, an external caller with only the public URL and
 * publishable key could register an employee's alias BEFORE the owner issues
 * their credentials, blocking onboarding. So before production:
 *
 *   Authentication -> Sign In / Providers -> Allow new users to sign up = OFF
 *
 * Admin-created users must remain allowed — that is how credentials are issued.
 * The application source contains no signup path (asserted in tests), but that
 * proves only the application's half; the project setting is verified by hand.
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
 * This is a CONTAINMENT check, not a credential check — it grants nothing. Its
 * job is to recognise the alias where it must never appear, above all as a
 * value someone typed into the login form: the alias is deterministic and
 * therefore guessable from a staff mobile number, so accepting it as an
 * identifier would create a second staff login the owner never authorised.
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
