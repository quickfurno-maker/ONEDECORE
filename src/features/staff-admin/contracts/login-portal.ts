/**
 * The two login identity contracts, made explicit.
 *
 * THE INCIDENT THIS FIXES
 *
 * `/admin` redirected to `/auth/login`, and that page was always branded as the
 * Staff Portal: it asked for a "Staff Login ID", told the visitor to enter their
 * unique 10-digit mobile number, and failed with "Invalid staff credentials".
 *
 * The server quietly accepted a Super Admin email as well, but nothing on screen
 * said so. An owner opening `/admin` was therefore led straight down the staff
 * mobile path — which can never authenticate an email-only Super Admin identity.
 * The defect was a MERGED IDENTITY SURFACE, not a broken credential.
 *
 * So the portal is now explicit on both sides:
 *
 *   admin -> Super Admin email + password
 *   staff -> employee 10-digit mobile + password (server-derived auth alias)
 *
 * One session system, one cookie path, one CSRF guard. Only the identity
 * contract and its presentation differ.
 */

import { STAFF_LOGIN_PHONE_PATTERN } from "./staff-login-phone.ts";

export const LOGIN_PORTALS = ["admin", "staff"] as const;

export type LoginPortal = (typeof LOGIN_PORTALS)[number];

/**
 * `/admin` is the Super Admin entry point, so an unqualified visit defaults
 * there. Staff reach their portal by choosing it, or by a link that names it.
 */
export const DEFAULT_LOGIN_PORTAL = "admin" as const satisfies LoginPortal;

/**
 * Normalises a portal value from a URL or a form field.
 *
 * Exact match only. An unknown value falls back to the default rather than
 * being echoed or half-honoured — the portal decides which credential contract
 * runs, so it must never be attacker-shaped.
 */
export function normaliseLoginPortal(
  raw: string | null | undefined
): LoginPortal {
  const value = raw?.trim().toLowerCase();
  return (LOGIN_PORTALS as readonly string[]).includes(value ?? "")
    ? (value as LoginPortal)
    : DEFAULT_LOGIN_PORTAL;
}

/**
 * A conservative "looks like an email" test for the ADMIN identifier.
 *
 * Deliberately not RFC-complete: its only job is to refuse an identifier that
 * clearly is not an email before any credential is tested, so the admin portal
 * cannot be used to probe the staff namespace. Supabase remains the authority on
 * whether the address exists.
 */
export function looksLikeAdminEmail(identifier: string): boolean {
  const value = identifier.trim();
  if (value.length < 3 || value.length > 254 || /\s/.test(value)) {
    return false;
  }
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) {
    return false;
  }
  const domain = value.slice(at + 1);
  return domain.length >= 3 && domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
}

/**
 * The portal a legacy submission belongs to.
 *
 * A form cached before this change posts no `portal` field. Rather than fail
 * those users, the identifier itself decides: a canonical bare 10-digit mobile
 * is unambiguously a staff login, and anything else takes the admin path — which
 * is exactly what the server did before the split existed.
 */
export function inferLoginPortalFromIdentifier(identifier: string): LoginPortal {
  return STAFF_LOGIN_PHONE_PATTERN.test(identifier.trim()) ? "staff" : "admin";
}

/**
 * What a submission's `portal` field resolved to.
 *
 * `invalid` is a real outcome, not a variant of the default. It carries the
 * safe default portal ONLY so the failure has something to render, and the
 * caller must refuse the submission outright rather than run that contract.
 */
export type SubmittedPortalResolution =
  | {
      readonly kind: "resolved";
      readonly portal: LoginPortal;
      /** `legacy` means the field was absent and the identifier decided. */
      readonly source: "explicit" | "legacy";
    }
  | { readonly kind: "invalid"; readonly portal: typeof DEFAULT_LOGIN_PORTAL };

/**
 * The portal a submission runs under.
 *
 * THREE CASES, AND THE THIRD ONE FAILS CLOSED
 *
 * 1. The field is ABSENT (`rawPortal === null`). This is the only case that may
 *    infer, and it exists solely for a form cached before the split, which
 *    posts no such field. The identifier decides, exactly as the server did
 *    before the split existed.
 *
 * 2. The field is present and recognised. It is used.
 *
 * 3. The field is present and is anything else — empty, whitespace, "owner",
 *    "../../etc/passwd". It is INVALID, and inference is not a fallback for it.
 *    Letting a crafted value drop through to inference would mean an attacker
 *    who sends `portal=<garbage>` with a 10-digit identifier still reaches the
 *    staff credential contract, which is precisely the "explicit portal wins"
 *    guarantee this type exists to make true.
 *
 * Only ABSENT may infer. Present-but-unrecognised is refused.
 */
export function resolveSubmittedPortal(
  /** `null` means the field was ABSENT. An empty string means it was blank. */
  rawPortal: string | null,
  identifier: string
): SubmittedPortalResolution {
  if (rawPortal === null) {
    return {
      kind: "resolved",
      portal: inferLoginPortalFromIdentifier(identifier),
      source: "legacy",
    };
  }

  const value = rawPortal.trim().toLowerCase();
  if ((LOGIN_PORTALS as readonly string[]).includes(value)) {
    return { kind: "resolved", portal: value as LoginPortal, source: "explicit" };
  }

  return { kind: "invalid", portal: DEFAULT_LOGIN_PORTAL };
}

export interface LoginPortalCopy {
  readonly brand: string;
  readonly heading: string;
  readonly description: string;
  readonly identifierLabel: string;
  readonly identifierHelp: string | null;
  readonly identifierPlaceholder: string;
  readonly submitLabel: string;
  /** The ONE failure message for this portal. Never says which part was wrong. */
  readonly errorMessage: string;
  readonly switchLabel: string;
  readonly selectorLabel: string;
}

export const LOGIN_PORTAL_COPY: Readonly<Record<LoginPortal, LoginPortalCopy>> = {
  admin: {
    brand: "ONEDECORE Admin Portal",
    heading: "Super Admin Authentication",
    description:
      "Use your authorized Super Admin email and password to access the ONEDECORE administration panel.",
    identifierLabel: "Super Admin Email",
    // No mobile helper here: naming the staff contract on the admin form is
    // what sent the owner down the wrong path in the first place.
    identifierHelp: null,
    identifierPlaceholder: "owner@onedecore.in",
    submitLabel: "Sign In to Admin Panel",
    errorMessage: "Invalid admin credentials.",
    switchLabel: "Staff member? Use the Staff Portal",
    selectorLabel: "Super Admin",
  },
  staff: {
    brand: "ONEDECORE Staff Portal",
    heading: "Staff Authentication",
    description:
      "Enter authorized staff credentials to access the internal management portal.",
    identifierLabel: "10-digit Mobile Number",
    identifierHelp:
      "Staff sign in with their unique 10-digit mobile number. Do not add +91.",
    identifierPlaceholder: "7447863402",
    submitLabel: "Sign In to Staff Portal",
    errorMessage: "Invalid staff credentials.",
    switchLabel: "Super Admin? Use the Admin Portal",
    selectorLabel: "Staff",
  },
};

/** The login URL for a portal, carrying a safe `next` when there is one. */
export function loginPortalHref(
  portal: LoginPortal,
  safeNext?: string | null
): string {
  const params = new URLSearchParams({ portal });
  if (safeNext && safeNext !== "/admin") {
    params.set("next", safeNext);
  }
  // The error is deliberately NOT carried across: a failure belongs to the
  // portal that produced it, and showing it on the other one is misleading.
  return `/auth/login?${params.toString()}`;
}
