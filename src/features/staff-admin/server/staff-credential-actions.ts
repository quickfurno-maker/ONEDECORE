"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import { StaffError, staffErrorFromPostgresMessage } from "../contracts/errors.ts";
import {
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

type CredentialOperation =
  | "issue"
  | "password_reset"
  | "revoke"
  | "reactivate"
  | "change_phone";

type CredentialRpcClient = StaffServerClient & {
  rpc(
    fn: "begin_staff_credential_operation",
    args: {
      readonly p_staff_id: string;
      readonly p_operation: CredentialOperation;
      readonly p_reason: string | null;
      readonly p_phone: string | null;
    }
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "complete_staff_credential_operation",
    args: { readonly p_operation_id: string }
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "fail_staff_credential_operation",
    args: { readonly p_operation_id: string; readonly p_error: string | null }
  ): ReturnType<StaffServerClient["rpc"]>;
};

export interface StaffCredentialResult {
  readonly staffId: string;
  readonly accessState: string;
  readonly loginUsername: string | null;
}

/**
 * Server-side gate. The DATABASE is the authority — every RPC calls
 * `private.staff_require_credential_admin()` — so this fails fast and keeps the
 * UI honest; it is never the only check.
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
 * exactly why it is cheap insurance against a future provider that does. It
 * runs before anything reaches the operation ledger.
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
 * Runs one credential operation as prepare -> Auth -> finalize.
 *
 * `begin` validates and reserves but publishes NO final state, so a failed Auth
 * call can never leave behind a success audit or a state the application cannot
 * back up. `complete` is what publishes, and only after Auth has actually
 * succeeded. `fail` records the failure durably and keeps access fail-closed,
 * so the operation stays visibly retryable rather than silently half-done.
 */
async function runCredentialOperation(input: {
  readonly staffId: string;
  readonly operation: CredentialOperation;
  readonly reason?: string | null;
  readonly phone?: string | null;
  /** Receives the values `begin` resolved, e.g. the server-derived phone. */
  readonly authStep: (begun: Record<string, unknown>) => Promise<void>;
  /** Scrubbed from any diagnostic before it reaches the ledger. */
  readonly secret?: string;
}): Promise<StaffCredentialResult> {
  await requireCredentialAdmin();

  if (input.staffId.trim().length === 0) {
    throw new StaffError({
      code: "STAFF_VALIDATION_FAILED",
      message: "Staff member is required.",
      httpStatus: 422,
    });
  }

  const supabase = await createClient();
  const rpc = supabase as CredentialRpcClient;

  const { data: beginData, error: beginError } = await rpc.rpc(
    "begin_staff_credential_operation",
    {
      p_staff_id: input.staffId,
      p_operation: input.operation,
      p_reason: input.reason ?? null,
      p_phone: input.phone ?? null,
    }
  );

  if (beginError) {
    throw staffErrorFromPostgresMessage(beginError.message);
  }

  const begun = assertRpcJson(beginData, "begin_staff_credential_operation");
  const operationId = String(begun.operationId ?? "");

  try {
    await input.authStep(begun);
  } catch (authError) {
    const detail = scrubSecret(
      authError instanceof Error ? authError.message : undefined,
      input.secret ?? ""
    );

    // Record the failure durably. The ledger is what makes the half-finished
    // operation visible and retryable instead of invisible.
    await rpc.rpc("fail_staff_credential_operation", {
      p_operation_id: operationId,
      p_error: detail ?? null,
    });

    throw new StaffError({
      code: "STAFF_INVITE_FAILED",
      message:
        "Supabase Auth did not accept the change, so nothing was published. Access is fail-closed and the operation can be retried.",
      httpStatus: 502,
      details: detail,
    });
  }

  const { data: completeData, error: completeError } = await rpc.rpc(
    "complete_staff_credential_operation",
    { p_operation_id: operationId }
  );

  if (completeError) {
    throw staffErrorFromPostgresMessage(completeError.message);
  }

  const completed = assertRpcJson(completeData, "complete_staff_credential_operation");

  return {
    staffId: input.staffId,
    accessState: String(completed.accessState ?? ""),
    loginUsername:
      completed.loginUsername === null || completed.loginUsername === undefined
        ? null
        : String(completed.loginUsername),
  };
}

/**
 * Issues phone/password credentials for an existing staff member.
 *
 * The username is NOT taken from the form. `begin_staff_credential_operation`
 * derives it from the authoritative staff record, so a tampered submission
 * cannot point a login at some other number. The Auth identity is created with
 * the EXISTING employment UUID, so `auth.uid()` keeps matching `profiles.id`.
 */
export async function issueStaffCredentials(input: {
  readonly staffId: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly displayName: string;
}): Promise<StaffCredentialResult> {
  const password = requirePassword(input.password, input.confirmPassword);

  return runCredentialOperation({
    staffId: input.staffId,
    operation: "issue",
    secret: password,
    authStep: async (begun) => {
      const loginPhoneE164 = String(begun.targetPhone ?? "");
      if (loginPhoneE164.length === 0) {
        throw new Error("No login phone was reserved for this operation.");
      }
      await issueStaffPhoneCredentialsInAuth({
        staffId: input.staffId,
        loginPhoneE164,
        password,
        displayName: input.displayName,
      });
    },
  });
}

/**
 * Sets a new password. The current one is never read, shown or required, and
 * neither the timestamp nor the audit record is written until Supabase Auth has
 * accepted the change.
 */
export async function resetStaffPassword(input: {
  readonly staffId: string;
  readonly password: string;
  readonly confirmPassword: string;
}): Promise<StaffCredentialResult> {
  const password = requirePassword(input.password, input.confirmPassword);

  return runCredentialOperation({
    staffId: input.staffId,
    operation: "password_reset",
    secret: password,
    authStep: async () => {
      await resetStaffPhonePasswordInAuth({ staffId: input.staffId, password });
    },
  });
}

/**
 * Revokes application access.
 *
 * The database denies immediately at `begin` — this is the one operation where
 * waiting would be wrong — and the ledger then tracks whether the Auth session
 * invalidation actually landed. A failure therefore leaves access revoked and
 * the session-invalidation step visibly outstanding, never a false "done".
 */
export async function revokeStaffAccess(input: {
  readonly staffId: string;
  readonly reason: string;
}): Promise<StaffCredentialResult> {
  return runCredentialOperation({
    staffId: input.staffId,
    operation: "revoke",
    reason: input.reason,
    authStep: async () => {
      await revokeStaffAuthAccessInAuth({ staffId: input.staffId });
    },
  });
}

/**
 * Restores capability without changing the password or the UUID.
 *
 * Auth is re-enabled FIRST while the database still denies everything, and only
 * then is the access state restored — so a failed re-enable leaves the staff
 * member revoked rather than nominally allowed but unable to sign in.
 */
export async function reactivateStaffAccess(input: {
  readonly staffId: string;
  readonly reason: string;
}): Promise<StaffCredentialResult> {
  return runCredentialOperation({
    staffId: input.staffId,
    operation: "reactivate",
    reason: input.reason,
    authStep: async () => {
      await reactivateStaffAuthAccessInAuth({ staffId: input.staffId });
    },
  });
}

/**
 * Re-points the login username at a new mobile number.
 *
 * The database keeps the OLD number until Supabase Auth has moved and sessions
 * have actually been invalidated, so the application never advertises a number
 * Auth has not heard of. If the Auth step fails part-way the account is revoked
 * until a Super Admin retries, because the alternative — Auth on the new number
 * while ONEDECORE shows the old — is exactly the silent drift this avoids.
 */
export async function changeStaffLoginPhone(input: {
  readonly staffId: string;
  readonly phone: string;
  readonly reason: string;
}): Promise<StaffCredentialResult> {
  return runCredentialOperation({
    staffId: input.staffId,
    operation: "change_phone",
    reason: input.reason,
    phone: input.phone,
    authStep: async (begun) => {
      const loginPhoneE164 = String(begun.targetPhone ?? "");
      if (loginPhoneE164.length === 0) {
        throw new Error("No login phone was reserved for this operation.");
      }
      await changeStaffAuthLoginPhoneInAuth({
        staffId: input.staffId,
        loginPhoneE164,
      });
    },
  });
}

/** The 10 digits a staff member will type, derived from their employment record. */
export async function previewStaffLoginUsername(
  phoneE164: string | null
): Promise<string | null> {
  return staffLoginUsername(phoneE164);
}
