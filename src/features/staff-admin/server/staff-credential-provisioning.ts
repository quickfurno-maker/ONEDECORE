/**
 * Phone/password credential operations over the Auth Admin REST API.
 *
 * Like `staff-login-provisioning.ts`, this module knows NOTHING about the
 * service-role key: it receives an already-authorized request function from
 * `staff-invite-adapter.ts`, which stays the single audited place where that key
 * is acquired. The Phase 6D containment rule is therefore unchanged.
 *
 * EVERYTHING HERE WAS VERIFIED AGAINST A LIVE GoTrue v2.193.1 STACK, because
 * every one of these details is the kind that silently breaks in production:
 *
 *   * Admin create honours an explicit `id`, so the Auth user is created with
 *     the EXISTING staff UUID and `auth.uid()` keeps matching `profiles.id`.
 *   * `auth.users.phone` is stored WITHOUT the leading "+": +917447863402 comes
 *     back as "917447863402". Comparisons here normalise accordingly.
 *   * Signing in with the bare 10 digits is rejected; only the canonical E.164
 *     value authenticates.
 *   * Password update via PUT preserves both the id and the phone.
 *   * Changing the phone makes the OLD number stop authenticating immediately.
 *   * There is NO admin endpoint to drop a user's sessions: both
 *     `admin/users/{id}/sessions` and `admin/users/{id}/logout` return 404.
 *     `ban_duration` is the supported mechanism, and it is what revoke uses.
 *
 * Passwords pass through this module to Supabase Auth and are never returned,
 * logged, or included in any error message.
 */

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
  const digits = authPhoneDigits(input.loginPhoneE164);
  const existing = await findIdentity(input.staffId, deps);

  if (existing) {
    if (existing.id && existing.id !== input.staffId) {
      throw new StaffIdentityConflictError(
        "The existing login identity does not match this employment record."
      );
    }

    const existingDigits = authPhoneDigits(existing.phone ?? "");
    if (existingDigits.length > 0 && existingDigits !== digits) {
      throw new StaffIdentityConflictError(
        "A login identity already exists for this employee under a different mobile number."
      );
    }

    // Same identity, same number: set the password rather than recreate.
    const updated = await deps.authorizedRequest(
      `${AUTH_ADMIN_USERS_PATH}/${input.staffId}`,
      {
        method: "PUT",
        body: {
          phone: input.loginPhoneE164,
          phone_confirm: true,
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
      phone: input.loginPhoneE164,
      password: input.password,
      // Admin-issued credentials: the Super Admin vouches for the number, and a
      // confirmed phone is also what the future self-service OTP reset needs.
      phone_confirm: true,
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

/** Lifts the ban. The password and the UUID are untouched. */
export async function reactivateStaffAuthAccess(
  input: { readonly staffId: string },
  deps: StaffCredentialDeps
): Promise<{ readonly userId: string }> {
  const existing = await findIdentity(input.staffId, deps);
  if (!existing) {
    return { userId: input.staffId };
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
 * The old number stops authenticating the moment the update lands — verified
 * on a live stack. Sessions are then invalidated with a ban/unban cycle, so a
 * session opened under the old number cannot be refreshed.
 */
export async function changeStaffAuthLoginPhone(
  input: { readonly staffId: string; readonly loginPhoneE164: string },
  deps: StaffCredentialDeps
): Promise<{ readonly userId: string; readonly loginPhoneE164: string }> {
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
      body: { phone: input.loginPhoneE164, phone_confirm: true },
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
