/**
 * The operator-facing vocabulary for setting a staff password.
 *
 * Centralised because the wording IS the feature. The defect this addresses was
 * not a missing check — it was the UI telling an operator a password had been
 * set when Supabase had refused it. Every string below is therefore written to
 * be honest about WHICH stage produced it:
 *
 *   local  -> "ready to submit", "recommended"    (never "accepted")
 *   server -> "updated successfully", "rejected"  (the only verdicts)
 */

/**
 * Why a credential operation failed, in terms the UI can branch on.
 *
 * Derived from the `StaffError` code — the raw provider payload never reaches
 * the browser, but the operator still needs to know whether to pick a different
 * password, ask for permission, or issue credentials first.
 */
export type StaffCredentialFailureCategory =
  | "weak_password"
  | "validation_failed"
  | "unauthorized"
  | "missing_identity"
  | "provider_failed";

/** Under the password field. States plainly who decides. */
export const STAFF_PASSWORD_SECTION_HELP =
  "Set a strong, unique password for this staff member. Final acceptance is verified securely by Supabase Auth before the change is applied.";

/* -------------------------------------------------------------------------- */
/* Status card                                                                 */
/* -------------------------------------------------------------------------- */

export type StaffPasswordStatusTone =
  | "neutral"
  | "warning"
  | "info"
  | "success"
  | "error";

export const STAFF_PASSWORD_STATUS = {
  /** Nothing typed yet. */
  idle: "Create a password, then confirm it. The final decision is made securely when you submit.",
  /** Hard checks not satisfied. */
  localInvalid: "Password not ready yet. Complete the required checks below.",
  /**
   * Hard checks satisfied. Note what this deliberately does NOT say: nothing
   * about the password being good, safe, or accepted.
   */
  localValid:
    "Ready to submit. Local checks passed. Final acceptance will be confirmed securely when you save the password.",
  submitting: "Saving password securely and checking acceptance…",
} as const;

export const STAFF_PASSWORD_SUCCESS_ISSUE =
  "Credentials issued successfully. The staff member can now sign in with their 10-digit mobile number and the password you just set.";

export const STAFF_PASSWORD_SUCCESS_RESET =
  "Password updated successfully. The staff member can continue using the same 10-digit mobile number with the new password.";

/** After a first-time issue, access only becomes Active on a real sign-in. */
export const STAFF_PASSWORD_FIRST_LOGIN_NOTE =
  "Ask the staff member to sign in once to activate their access if this is a first-time credential issue.";

/* -------------------------------------------------------------------------- */
/* Rejection copy                                                              */
/* -------------------------------------------------------------------------- */

/** Supabase reported `weak_password` with a breach (`pwned`) reason. */
export const STAFF_PASSWORD_REJECTED_BREACHED =
  "This password was rejected because it is known to be weak or has appeared in breach data. Choose a stronger, unique password and try again.";

/** Supabase reported `weak_password` with no structured reason. */
export const STAFF_PASSWORD_REJECTED_WEAK =
  "This password was rejected by the authentication provider as too weak. Choose a stronger, more unique password and try again.";

export const STAFF_PASSWORD_MISMATCH =
  "Passwords do not match. Re-enter the same password in both fields.";

export const STAFF_PASSWORD_TOO_SHORT =
  "Password must be at least 10 characters long.";

export const STAFF_PASSWORD_UNAUTHORIZED =
  "You do not have permission to manage staff login credentials.";

export const STAFF_PASSWORD_NO_IDENTITY =
  "This staff member does not yet have a login identity. Issue credentials first instead of resetting the password.";

/**
 * The closing line on any failure. Says the one thing the operator most needs:
 * the password did NOT change, so the old one still works.
 */
export const STAFF_PASSWORD_NOT_CHANGED =
  "The password was not changed. The authentication provider did not accept this update. Please review the message above and try again.";

/* -------------------------------------------------------------------------- */
/* Generation                                                                  */
/* -------------------------------------------------------------------------- */

export const STAFF_PASSWORD_GENERATED_HELP =
  "Generated strong password loaded into both fields. Share it securely with the staff member now. After a successful save, it will not be shown again.";

/** Sits beside any strength label, so the meter cannot be misread as a verdict. */
export const STAFF_PASSWORD_STRENGTH_NOTE =
  "Strength estimate is local guidance only. Final acceptance is checked securely on save.";

/* -------------------------------------------------------------------------- */
/* Mapping                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Groups a `StaffError` code into something the UI can act on.
 *
 * Only the CATEGORY crosses to the browser — never the provider payload, never
 * a request id, never the password.
 */
export function categoriseStaffCredentialFailure(
  code: string | undefined
): StaffCredentialFailureCategory {
  switch (code) {
    // Stage 2 — the provider refused the password itself.
    case "STAFF_PASSWORD_WEAK":
      return "weak_password";
    // Stage 1 — local, deterministic validation the operator can see and fix.
    // Reaching the server at all means a tampered or stale client, since the
    // form disables submit until these pass.
    case "STAFF_PASSWORD_REJECTED":
    case "STAFF_VALIDATION_FAILED":
    case "STAFF_LOGIN_PHONE_INVALID":
      return "validation_failed";
    case "STAFF_UNAUTHORIZED":
    case "STAFF_PERMISSION_DENIED":
    case "STAFF_CREDENTIALS_UNAUTHORIZED":
      return "unauthorized";
    case "STAFF_CREDENTIALS_NOT_ISSUED":
      return "missing_identity";
    default:
      return "provider_failed";
  }
}

/**
 * The guidance line shown under a failure, chosen by category.
 *
 * `weak_password` deliberately gets no extra line: its own message already says
 * what happened and what to do, and appending "the password was not changed"
 * under a message that already says "rejected" reads as two failures.
 */
export function staffCredentialFailureHint(
  category: StaffCredentialFailureCategory
): string | null {
  switch (category) {
    case "weak_password":
      return null;
    case "unauthorized":
      return STAFF_PASSWORD_UNAUTHORIZED;
    case "missing_identity":
      return STAFF_PASSWORD_NO_IDENTITY;
    case "validation_failed":
      return null;
    default:
      return STAFF_PASSWORD_NOT_CHANGED;
  }
}
