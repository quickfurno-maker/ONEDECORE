/**
 * Staff credential operations over the Auth Admin REST API.
 *
 * Like `staff-login-provisioning.ts`, this module knows NOTHING about the
 * service-role key: it receives an already-authorized request function from
 * `staff-invite-adapter.ts`, which stays the single audited place where that key
 * is acquired. The Phase 6D containment rule is therefore unchanged.
 *
 * THE TRANSPORT IDENTIFIER IS AN ALIAS, NOT A PHONE
 *
 * A staff member's login ID is their 10-digit mobile and nothing else. But the
 * Supabase Phone provider is disabled and stays disabled — the first real staff
 * sign-in failed on a live stack with `422 phone_provider_disabled` — and hosted
 * password auth accepts only an email or a phone identifier. So every identity
 * here is created and updated against the deterministic alias derived from that
 * mobile (`staffLoginAuthAlias`), which is confirmed on creation so no mail is
 * ever sent and no confirmation is ever required.
 *
 * Nothing is delivered to the alias. It is not contact information, it is never
 * shown to anyone, and it is never returned from these functions.
 *
 * VERIFIED AGAINST A LIVE GoTrue v2.193.1 STACK:
 *
 *   * Admin create honours an explicit `id`, so the Auth user is created with
 *     the EXISTING staff UUID and `auth.uid()` keeps matching `profiles.id`.
 *   * `auth.users.phone` is stored WITHOUT the leading "+": +917447863402 comes
 *     back as "917447863402". Legacy comparisons here normalise accordingly.
 *   * Password update via PUT preserves the id and the other identifiers.
 *   * There is NO admin endpoint to drop a user's sessions: both
 *     `admin/users/{id}/sessions` and `admin/users/{id}/logout` return 404.
 *     `ban_duration` is the supported mechanism, and it is what revoke uses.
 *
 * NOT re-verified on a live stack in this pass, because the change was made
 * under a no-managed-write rule: adding an email identity to a user that
 * currently has only a phone identity (`convertStaffAuthLoginToAlias`). It uses
 * the same admin PUT every other operation here uses. See that function.
 *
 * Passwords pass through this module to Supabase Auth and are never returned,
 * logged, or included in any error message.
 */

import { staffLoginAuthAlias } from "./staff-login-auth-alias.ts";
import {
  StaffIdentityConflictError,
  type AuthorizedRequest,
} from "./staff-login-provisioning.ts";

export { StaffIdentityConflictError } from "./staff-login-provisioning.ts";

export const AUTH_ADMIN_USERS_PATH = "/auth/v1/admin/users";

/** Effectively permanent. Cleared with "none" on reactivation. */
export const STAFF_BAN_DURATION = "876000h";

export interface StaffCredentialDeps {
  readonly authorizedRequest: AuthorizedRequest;
}

interface AuthUserShape {
  readonly id?: string;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly last_sign_in_at?: string | null;
  readonly banned_until?: string | null;
}

/** GoTrue stores E.164 digits with no "+", so compare on digits alone. */
function authPhoneDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}

/**
 * The transport alias for a canonical staff login number.
 *
 * Throws rather than returning null: every caller here is about to write to
 * Auth, and an unusable login number must stop the operation before it does,
 * not silently create an identity nobody can sign in as. The message names the
 * number's validity, never the alias.
 */
function requireAlias(loginPhoneE164: string): string {
  const alias = staffLoginAuthAlias(loginPhoneE164);
  if (!alias) {
    throw new StaffIdentityConflictError(
      "This employment record has no valid 10-digit login mobile number."
    );
  }
  return alias;
}

async function readError(response: {
  text(): Promise<string>;
}): Promise<string> {
  const detail = await response.text();
  return detail.slice(0, 300);
}

async function findIdentity(
  staffId: string,
  deps: StaffCredentialDeps
): Promise<AuthUserShape | null> {
  const lookup = await deps.authorizedRequest(`${AUTH_ADMIN_USERS_PATH}/${staffId}`, {
    method: "GET",
  });

  if (lookup.ok) {
    return (await lookup.json()) as AuthUserShape;
  }

  if (lookup.status === 404) {
    return null;
  }

  throw new Error(`Auth identity lookup failed: ${await readError(lookup)}`);
}

export interface IssueStaffCredentialsInput {
  readonly staffId: string;
  readonly loginPhoneE164: string;
  readonly password: string;
  readonly displayName: string;
}

export interface IssueStaffCredentialsResult {
  readonly userId: string;
  readonly loginPhoneE164: string;
  /** False when an existing identity was reused, i.e. this was a retry. */
  readonly identityCreated: boolean;
}

/**
 * Creates the Auth identity with the EXISTING staff UUID, or — when a matching
 * identity already exists — sets the password on it instead of creating a
 * second one.
 *
 * Retry safety is the whole point of the lookup: issuance marks the database
 * first, so a failure after the Auth call would otherwise leave a half-created
 * identity that a naive retry would try to duplicate (and fail on). Any
 * mismatch between the existing identity and this employment record is a hard
 * conflict, never a silent overwrite.
 */
export async function issueStaffPhoneCredentials(
  input: IssueStaffCredentialsInput,
  deps: StaffCredentialDeps
): Promise<IssueStaffCredentialsResult> {
  const alias = requireAlias(input.loginPhoneE164);
  const digits = authPhoneDigits(input.loginPhoneE164);
  const existing = await findIdentity(input.staffId, deps);

  if (existing) {
    if (existing.id && existing.id !== input.staffId) {
      throw new StaffIdentityConflictError(
        "The existing login identity does not match this employment record."
      );
    }

    // A rebind to a DIFFERENT number is a conflict, not a silent overwrite.
    // Checked on whichever identifier the existing user actually carries: the
    // alias for anything issued under the current transport, and the legacy
    // phone for an identity created before it.
    const existingEmail = (existing.email ?? "").trim().toLowerCase();
    if (existingEmail.length > 0 && existingEmail !== alias) {
      throw new StaffIdentityConflictError(
        "A login identity already exists for this employee under a different mobile number."
      );
    }

    const existingDigits = authPhoneDigits(existing.phone ?? "");
    if (
      existingEmail.length === 0 &&
      existingDigits.length > 0 &&
      existingDigits !== digits
    ) {
      throw new StaffIdentityConflictError(
        "A login identity already exists for this employee under a different mobile number."
      );
    }

    // Same identity, same number: set the password rather than recreate. The
    // alias is (re)asserted here so an identity created under the old phone
    // transport gains its email identifier as part of a Super-Admin-initiated
    // reissue, rather than through any automatic repair on sign-in.
    const updated = await deps.authorizedRequest(
      `${AUTH_ADMIN_USERS_PATH}/${input.staffId}`,
      {
        method: "PUT",
        body: {
          email: alias,
          email_confirm: true,
          password: input.password,
          ban_duration: "none",
        },
      }
    );

    if (!updated.ok) {
      throw new Error(`Auth credential update failed: ${await readError(updated)}`);
    }

    return {
      userId: input.staffId,
      loginPhoneE164: input.loginPhoneE164,
      identityCreated: false,
    };
  }

  const created = await deps.authorizedRequest(AUTH_ADMIN_USERS_PATH, {
    method: "POST",
    body: {
      // The employment UUID, so profiles.id === auth.users.id forever.
      id: input.staffId,
      // The derived transport alias — never a staff-chosen or staff-visible
      // address. `email_confirm` marks it settled on creation, so GoTrue neither
      // sends nor expects a confirmation mail.
      email: alias,
      email_confirm: true,
      password: input.password,
      user_metadata: { display_name: input.displayName.trim() },
    },
  });

  if (!created.ok) {
    throw new Error(`Auth credential provisioning failed: ${await readError(created)}`);
  }

  const body = (await created.json()) as AuthUserShape;
  if (!body.id) {
    throw new Error("Auth credential provisioning returned no id.");
  }
  if (body.id !== input.staffId) {
    throw new StaffIdentityConflictError(
      "Auth provider did not honour the requested user id."
    );
  }

  return {
    userId: input.staffId,
    loginPhoneE164: input.loginPhoneE164,
    identityCreated: true,
  };
}

/** Sets a new password. The old one is never read, shown, or verified. */
export async function resetStaffPhonePassword(
  input: { readonly staffId: string; readonly password: string },
  deps: StaffCredentialDeps
): Promise<{ readonly userId: string }> {
  const existing = await findIdentity(input.staffId, deps);
  if (!existing) {
    throw new StaffIdentityConflictError(
      "This staff member has no login identity to reset."
    );
  }

  const updated = await deps.authorizedRequest(
    `${AUTH_ADMIN_USERS_PATH}/${input.staffId}`,
    { method: "PUT", body: { password: input.password } }
  );

  if (!updated.ok) {
    throw new Error(`Auth password reset failed: ${await readError(updated)}`);
  }

  return { userId: input.staffId };
}

/**
 * Revokes sessions by banning the identity.
 *
 * GoTrue exposes no admin endpoint that drops a user's sessions — both
 * `admin/users/{id}/sessions` and `admin/users/{id}/logout` answer 404 — so
 * `ban_duration` is the supported mechanism. It invalidates refresh tokens, so
 * the session cannot be renewed.
 *
 * An access token already issued stays cryptographically valid until it
 * expires. That gap is closed in the DATABASE, not here:
 * `private.has_permission` returns false for revoked staff and
 * `private.staff_require_active_actor` raises, so a surviving token can read
 * and write nothing.
 */
export async function revokeStaffAuthAccess(
  input: { readonly staffId: string },
  deps: StaffCredentialDeps
): Promise<{ readonly userId: string; readonly banned: boolean }> {
  const existing = await findIdentity(input.staffId, deps);
  if (!existing) {
    // Nothing to ban. The database state is still authoritative and already
    // denies access, so this is a success, not an error.
    return { userId: input.staffId, banned: false };
  }

  const banned = await deps.authorizedRequest(
    `${AUTH_ADMIN_USERS_PATH}/${input.staffId}`,
    { method: "PUT", body: { ban_duration: STAFF_BAN_DURATION } }
  );

  if (!banned.ok) {
    throw new Error(`Auth access revocation failed: ${await readError(banned)}`);
  }

  return { userId: input.staffId, banned: true };
}

/**
 * Lifts the ban. The password and the UUID are untouched.
 *
 * A MISSING identity is a hard failure, not a success. Returning success would
 * let the caller clear the database revocation for an employee who has no login
 * at all — the application would show restored access that cannot possibly
 * work, and the operation would look finished when nothing happened.
 */
export async function reactivateStaffAuthAccess(
  input: { readonly staffId: string },
  deps: StaffCredentialDeps
): Promise<{ readonly userId: string }> {
  const existing = await findIdentity(input.staffId, deps);
  if (!existing) {
    throw new StaffIdentityConflictError(
      "There is no login identity to re-enable for this staff member. Issue credentials instead."
    );
  }

  const restored = await deps.authorizedRequest(
    `${AUTH_ADMIN_USERS_PATH}/${input.staffId}`,
    { method: "PUT", body: { ban_duration: "none" } }
  );

  if (!restored.ok) {
    throw new Error(`Auth access reactivation failed: ${await readError(restored)}`);
  }

  return { userId: input.staffId };
}

/**
 * Re-points the identity at a new mobile number and drops existing sessions.
 *
 * The alias is derived from the new number, so replacing it is what makes the
 * OLD 10-digit login stop working: it no longer maps to any identifier this
 * user carries. Sessions are then invalidated with a ban/unban cycle, so a
 * session opened under the old number cannot be refreshed either.
 *
 * The UUID and the password are untouched — the employee keeps signing in with
 * the same password under their new number.
 */
export async function changeStaffAuthLoginPhone(
  input: { readonly staffId: string; readonly loginPhoneE164: string },
  deps: StaffCredentialDeps
): Promise<{ readonly userId: string; readonly loginPhoneE164: string }> {
  const alias = requireAlias(input.loginPhoneE164);
  const existing = await findIdentity(input.staffId, deps);
  if (!existing) {
    throw new StaffIdentityConflictError(
      "This staff member has no login identity to move."
    );
  }

  const moved = await deps.authorizedRequest(
    `${AUTH_ADMIN_USERS_PATH}/${input.staffId}`,
    {
      method: "PUT",
      body: { email: alias, email_confirm: true },
    }
  );

  if (!moved.ok) {
    throw new Error(`Auth login phone change failed: ${await readError(moved)}`);
  }

  const body = (await moved.json()) as AuthUserShape;
  if (body.id && body.id !== input.staffId) {
    throw new StaffIdentityConflictError(
      "Auth provider returned a different user id for this employment record."
    );
  }

  // Invalidate any session opened under the previous number.
  //
  // The RESULT of this call is checked. Sending it and moving on would let the
  // operation report success while a session opened under the old number was
  // still refreshable — the caller would then finalize the change believing
  // sessions were closed when they were not.
  const ban = await deps.authorizedRequest(
    `${AUTH_ADMIN_USERS_PATH}/${input.staffId}`,
    { method: "PUT", body: { ban_duration: STAFF_BAN_DURATION } }
  );

  if (!ban.ok) {
    throw new Error(
      `Login phone was changed but existing sessions could not be invalidated: ${await readError(ban)}`
    );
  }

  const unban = await deps.authorizedRequest(
    `${AUTH_ADMIN_USERS_PATH}/${input.staffId}`,
    { method: "PUT", body: { ban_duration: "none" } }
  );

  if (!unban.ok) {
    throw new Error(
      `Login phone was changed but the account could not be re-enabled: ${await readError(unban)}`
    );
  }

  return { userId: input.staffId, loginPhoneE164: input.loginPhoneE164 };
}

/* -------------------------------------------------------------------------- */
/* One-time transport repair for identities issued under the phone provider    */
/* -------------------------------------------------------------------------- */

export interface ConvertStaffAuthLoginResult {
  readonly userId: string;
  /** False when the identity already carried the alias — this is idempotent. */
  readonly converted: boolean;
}

/**
 * Moves an EXISTING Auth user from the phone transport onto its login alias.
 *
 * SM001 was provisioned before the Phone provider was turned off. The identity
 * is otherwise correct — right UUID, right password, right employment record —
 * and only its transport identifier is unusable. Recreating the user to fix that
 * would change nothing that is wrong and break everything that is right:
 * `auth.uid()` would move, and `profiles`/attendance/staff foreign keys all hang
 * off it.
 *
 * So this updates the user in place, by id, and deliberately:
 *
 *   - does NOT send a password, so the existing hash survives untouched
 *   - does NOT delete or recreate the user, so the UUID is preserved
 *   - does NOT touch the employment record or any attendance state
 *   - does NOT clear the legacy phone, which is inert while the provider is off
 *
 * Idempotent: an identity that already carries the right alias is reported as
 * `converted: false` without a write. An identity carrying a DIFFERENT alias is
 * a conflict — that is someone else's login number, and rebinding it here would
 * silently hand this employee another person's identifier.
 *
 * This is an explicit, owner-authorized operation. It is deliberately NOT wired
 * into sign-in: repairing on a failed login attempt would turn an unauthenticated
 * request into an Auth write.
 *
 * NOT VERIFIED ON A LIVE STACK in this pass — managed Supabase writes were
 * prohibited for this change. It issues the same admin PUT that the password
 * reset, revoke, reactivate and phone-change paths all use successfully; what is
 * unverified is specifically GoTrue adding an email identity to a user that
 * currently has only a phone identity. Confirm against the real project before
 * relying on it for SM001.
 */
export async function convertStaffAuthLoginToAlias(
  input: { readonly staffId: string; readonly loginPhoneE164: string },
  deps: StaffCredentialDeps
): Promise<ConvertStaffAuthLoginResult> {
  const alias = requireAlias(input.loginPhoneE164);
  const existing = await findIdentity(input.staffId, deps);

  if (!existing) {
    throw new StaffIdentityConflictError(
      "This staff member has no login identity to convert. Issue credentials instead."
    );
  }

  if (existing.id && existing.id !== input.staffId) {
    throw new StaffIdentityConflictError(
      "The existing login identity does not match this employment record."
    );
  }

  const existingEmail = (existing.email ?? "").trim().toLowerCase();
  if (existingEmail === alias) {
    return { userId: input.staffId, converted: false };
  }

  if (existingEmail.length > 0) {
    throw new StaffIdentityConflictError(
      "This login identity is already bound to a different mobile number."
    );
  }

  // No `password` key: omitting it is what preserves the existing hash. Sending
  // the field at all — even unchanged — would re-hash and invalidate nothing
  // useful while risking a silent credential change.
  const converted = await deps.authorizedRequest(
    `${AUTH_ADMIN_USERS_PATH}/${input.staffId}`,
    { method: "PUT", body: { email: alias, email_confirm: true } }
  );

  if (!converted.ok) {
    throw new Error(
      `Auth login transport conversion failed: ${await readError(converted)}`
    );
  }

  const body = (await converted.json()) as AuthUserShape;
  if (body.id && body.id !== input.staffId) {
    throw new StaffIdentityConflictError(
      "Auth provider returned a different user id for this employment record."
    );
  }

  return { userId: input.staffId, converted: true };
}
