"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import { StaffError, staffErrorFromPostgresMessage } from "../contracts/errors.ts";
import {
  normalizeStaffLoginPhone,
  staffLoginUsername,
  validateStaffPassword,
} from "../contracts/staff-login-phone.ts";
import { getStaffAdminAccessContext } from "./staff-auth.ts";
import { probeCanManageStaffCredentials } from "./staff-permissions.ts";
import {
  changeStaffAuthLoginPhoneInAuth,
  issueStaffPhoneCredentialsInAuth,
  reactivateStaffAuthAccessInAuth,
  resetStaffPhonePasswordInAuth,
  revokeStaffAuthAccessInAuth,
} from "./staff-invite-adapter.ts";

type StaffServerClient = SupabaseClient<Database>;

type CredentialRpcClient = StaffServerClient & {
  rpc(
    fn: "issue_staff_credentials",
    args: { readonly p_staff_id: string; readonly p_phone: string }
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "record_staff_password_reset",
    args: { readonly p_staff_id: string }
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "revoke_staff_access",
    args: { readonly p_staff_id: string; readonly p_reason: string }
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "reactivate_staff_access",
    args: { readonly p_staff_id: string; readonly p_reason: string }
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "change_staff_login_phone",
    args: {
      readonly p_staff_id: string;
      readonly p_phone: string;
      readonly p_reason: string;
    }
  ): ReturnType<StaffServerClient["rpc"]>;
};

export interface StaffCredentialResult {
  readonly staffId: string;
  readonly accessState: string;
  readonly loginUsername: string | null;
}

/**
 * Server-side gate. The DATABASE is the authority — every RPC below calls
 * `private.staff_require_credential_admin()` — so this exists to fail fast and
 * to keep the UI honest, never as the only check.
 */
async function requireCredentialAdmin(): Promise<void> {
  const context = await getStaffAdminAccessContext();
  if (!context) {
    throw new StaffError({
      code: "STAFF_UNAUTHORIZED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  if (!(await probeCanManageStaffCredentials())) {
    throw new StaffError({
      code: "STAFF_CREDENTIALS_UNAUTHORIZED",
      message: "Only a Super Admin can manage staff login credentials.",
      httpStatus: 403,
    });
  }
}

/**
 * Removes a password from any diagnostic text before it can escape.
 *
 * Supabase Auth does not echo credentials, so this should never fire — which is
 * exactly why it is cheap insurance against a future provider that does.
 */
function scrubSecret(detail: string | undefined, secret: string): string | undefined {
  if (!detail || secret.length === 0) {
    return detail;
  }
  return detail.split(secret).join("[redacted]");
}

function assertRpcJson(data: unknown, label: string): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    throw staffErrorFromPostgresMessage(`Empty ${label} RPC result`);
  }
  return data as Record<string, unknown>;
}

function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new StaffError({
      code: "STAFF_REASON_REQUIRED",
      message: "Enter a reason. This is recorded in the audit trail.",
      httpStatus: 422,
    });
  }
  return trimmed;
}

function requirePhone(raw: string): string {
  const phone = normalizeStaffLoginPhone(raw);
  if (!phone.ok) {
    throw new StaffError({
      code: "STAFF_LOGIN_PHONE_INVALID",
      message: phone.message,
      httpStatus: 422,
    });
  }
  return phone.e164;
}

function requirePassword(password: string, confirmation: string): string {
  const checked = validateStaffPassword(password, confirmation);
  if (!checked.ok) {
    throw new StaffError({
      code: "STAFF_PASSWORD_REJECTED",
      message: checked.message,
      httpStatus: 422,
    });
  }
  return checked.password;
}

/**
 * Issues phone/password credentials for an existing staff member.
 *
 * Database first, exactly like the M52 invite saga: claiming `login_phone_e164`
 * inside the transaction is what makes uniqueness real under concurrency. If
 * the Auth call then fails, the row sits at `credentials_ready` with no auth
 * user, and `sync_staff_access_states` pulls it back to `not_activated` on the
 * next read — so a failed attempt is self-healing and safe to retry.
 *
 * The staff UUID is never regenerated: the Auth identity is created WITH the
 * existing employment UUID, so `auth.uid()` keeps matching `profiles.id`.
 */
export async function issueStaffCredentials(input: {
  readonly staffId: string;
  readonly phone: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly displayName: string;
}): Promise<StaffCredentialResult> {
  await requireCredentialAdmin();

  const loginPhoneE164 = requirePhone(input.phone);
  const password = requirePassword(input.password, input.confirmPassword);

  const supabase = await createClient();
  const { data, error } = await (supabase as CredentialRpcClient).rpc(
    "issue_staff_credentials",
    { p_staff_id: input.staffId, p_phone: loginPhoneE164 }
  );

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  const payload = assertRpcJson(data, "issue_staff_credentials");

  try {
    await issueStaffPhoneCredentialsInAuth({
      staffId: input.staffId,
      loginPhoneE164,
      password,
      displayName: input.displayName,
    });
  } catch (authError) {
    throw new StaffError({
      code: "STAFF_INVITE_FAILED",
      message:
        "The login number was reserved but the credentials could not be created. Nothing was lost — retry to finish issuing them.",
      httpStatus: 502,
      details: scrubSecret(
        authError instanceof Error ? authError.message : undefined,
        password
      ),
    });
  }

  return {
    staffId: input.staffId,
    accessState: String(payload.accessState ?? "credentials_ready"),
    loginUsername: staffLoginUsername(loginPhoneE164),
  };
}

/**
 * Sets a new password. The current password is never read, shown or required —
 * there is deliberately no "view password" anywhere in this system.
 */
export async function resetStaffPassword(input: {
  readonly staffId: string;
  readonly password: string;
  readonly confirmPassword: string;
}): Promise<StaffCredentialResult> {
  await requireCredentialAdmin();

  const password = requirePassword(input.password, input.confirmPassword);

  const supabase = await createClient();
  const { data, error } = await (supabase as CredentialRpcClient).rpc(
    "record_staff_password_reset",
    { p_staff_id: input.staffId }
  );

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  const payload = assertRpcJson(data, "record_staff_password_reset");

  try {
    await resetStaffPhonePasswordInAuth({ staffId: input.staffId, password });
  } catch (authError) {
    throw new StaffError({
      code: "STAFF_INVITE_FAILED",
      message: "The password could not be updated. Retry the reset.",
      httpStatus: 502,
      details: scrubSecret(
        authError instanceof Error ? authError.message : undefined,
        password
      ),
    });
  }

  return {
    staffId: input.staffId,
    accessState: String(payload.accessState ?? ""),
    loginUsername: staffLoginUsername(
      payload.loginPhone ? String(payload.loginPhone) : null
    ),
  };
}

/**
 * Revokes application access.
 *
 * Employment, attendance history and salary are untouched: this disables the
 * LOGIN, not the job. Enforcement is layered — the database refuses every
 * permission for a revoked staff member, and the Auth identity is banned so the
 * session cannot be refreshed.
 */
export async function revokeStaffAccess(input: {
  readonly staffId: string;
  readonly reason: string;
}): Promise<StaffCredentialResult> {
  await requireCredentialAdmin();

  const reason = requireReason(input.reason);

  const supabase = await createClient();
  const { data, error } = await (supabase as CredentialRpcClient).rpc(
    "revoke_staff_access",
    { p_staff_id: input.staffId, p_reason: reason }
  );

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  assertRpcJson(data, "revoke_staff_access");

  try {
    await revokeStaffAuthAccessInAuth({ staffId: input.staffId });
  } catch (authError) {
    // The database already denies this staff member everything, so access IS
    // revoked. Only the session invalidation is outstanding, and saying so
    // plainly is better than implying the revocation failed.
    throw new StaffError({
      code: "STAFF_INVITE_FAILED",
      message:
        "Access is revoked in ONEDECORE, but existing sessions could not be invalidated. Retry to close them.",
      httpStatus: 502,
      details: authError instanceof Error ? authError.message : undefined,
    });
  }

  return { staffId: input.staffId, accessState: "revoked", loginUsername: null };
}

/** Restores capability without changing the password or the UUID. */
export async function reactivateStaffAccess(input: {
  readonly staffId: string;
  readonly reason: string;
}): Promise<StaffCredentialResult> {
  await requireCredentialAdmin();

  const reason = requireReason(input.reason);

  const supabase = await createClient();
  const { data, error } = await (supabase as CredentialRpcClient).rpc(
    "reactivate_staff_access",
    { p_staff_id: input.staffId, p_reason: reason }
  );

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  const payload = assertRpcJson(data, "reactivate_staff_access");

  try {
    await reactivateStaffAuthAccessInAuth({ staffId: input.staffId });
  } catch (authError) {
    throw new StaffError({
      code: "STAFF_INVITE_FAILED",
      message:
        "Access was reactivated in ONEDECORE, but the login could not be re-enabled. Retry to finish.",
      httpStatus: 502,
      details: authError instanceof Error ? authError.message : undefined,
    });
  }

  return {
    staffId: input.staffId,
    accessState: String(payload.accessState ?? ""),
    loginUsername: null,
  };
}

/**
 * Re-points the login username at a new mobile number.
 *
 * The employment phone and the credential phone move together in one
 * transaction, then Supabase Auth is updated and sessions are invalidated, so
 * the old number stops authenticating immediately. The staff UUID is preserved.
 */
export async function changeStaffLoginPhone(input: {
  readonly staffId: string;
  readonly phone: string;
  readonly reason: string;
}): Promise<StaffCredentialResult> {
  await requireCredentialAdmin();

  const reason = requireReason(input.reason);
  const loginPhoneE164 = requirePhone(input.phone);

  const supabase = await createClient();
  const { data, error } = await (supabase as CredentialRpcClient).rpc(
    "change_staff_login_phone",
    { p_staff_id: input.staffId, p_phone: loginPhoneE164, p_reason: reason }
  );

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  assertRpcJson(data, "change_staff_login_phone");

  try {
    await changeStaffAuthLoginPhoneInAuth({
      staffId: input.staffId,
      loginPhoneE164,
    });
  } catch (authError) {
    throw new StaffError({
      code: "STAFF_INVITE_FAILED",
      message:
        "ONEDECORE now shows the new login number, but Supabase Auth was not updated. Retry so the two cannot drift.",
      httpStatus: 502,
      details: authError instanceof Error ? authError.message : undefined,
    });
  }

  return {
    staffId: input.staffId,
    accessState: "",
    loginUsername: staffLoginUsername(loginPhoneE164),
  };
}
