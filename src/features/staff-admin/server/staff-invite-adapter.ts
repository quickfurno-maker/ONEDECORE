import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getLeadIntakeServerEnv } from "@/config/server-env";
import { provisionLoginIdentityViaRest } from "./staff-login-provisioning.ts";
import {
  changeStaffAuthLoginPhone,
  convertStaffAuthLoginToAlias,
  issueStaffPhoneCredentials,
  reactivateStaffAuthAccess,
  resetStaffPhonePassword,
  revokeStaffAuthAccess,
  type ConvertStaffAuthLoginResult,
  type IssueStaffCredentialsInput,
  type IssueStaffCredentialsResult,
  type StaffCredentialDeps,
} from "./staff-credential-provisioning.ts";
import {
  runStaffInvite,
  runStaffLoginProvision,
  type StaffInviteInput,
  type StaffInviteResult,
  type StaffLoginProvisionInput,
  type StaffLoginProvisionResult,
} from "../contracts/staff-invite.ts";

export type { StaffInviteInput, StaffInviteResult } from "../contracts/staff-invite.ts";
export { setStaffInviteAdapterForTests } from "../contracts/staff-invite.ts";
export { setStaffLoginProvisionAdapterForTests } from "../contracts/staff-invite.ts";
export type {
  StaffLoginProvisionInput,
  StaffLoginProvisionResult,
} from "../contracts/staff-invite.ts";

async function defaultInviteStaffMemberByEmail(
  input: StaffInviteInput
): Promise<StaffInviteResult> {
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      display_name: input.displayName.trim(),
    },
  });

  if (error || !data.user?.id) {
    throw new Error(error?.message ?? "Auth invite failed");
  }

  return {
    userId: data.user.id,
    email,
  };
}

/**
 * Server-only Supabase Auth Admin invite/create wrapper.
 * Never import from Client Components.
 */
export async function inviteStaffMemberByEmail(
  input: StaffInviteInput
): Promise<StaffInviteResult> {
  return runStaffInvite(input, defaultInviteStaffMemberByEmail);
}

/**
 * Creates the auth user for an existing employment record, using the
 * pre-allocated employment id, then ACTUALLY SENDS the set-password email.
 *
 * The HTTP work lives in `staff-login-provisioning.ts` so the delivery step can
 * be unit tested with an injected fetch. `admin.generateLink()` is deliberately
 * NOT used: it mints a link and delivers nothing.
 */
async function defaultProvisionStaffLoginIdentity(
  input: StaffLoginProvisionInput
): Promise<StaffLoginProvisionResult> {
  const env = getLeadIntakeServerEnv();
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error("[ONEDECORE Admin] Service-role key unavailable.");
  }

  // The service-role key is acquired here and nowhere else: the provisioning
  // module receives only an already-authorized request function.
  const base = env.supabaseUrl.replace(/\/+$/, "");
  const key = env.serviceRoleKey;

  const result = await provisionLoginIdentityViaRest(input, {
    authorizedRequest: async (path, init) =>
      fetch(`${base}${path}`, {
        method: init.method,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
  });

  if (!result.deliveryInvoked) {
    throw new Error("Set-password email was not dispatched.");
  }

  return { userId: result.userId, email: result.email };
}

export async function provisionStaffLoginIdentity(
  input: StaffLoginProvisionInput
): Promise<StaffLoginProvisionResult> {
  return runStaffLoginProvision(input, defaultProvisionStaffLoginIdentity);
}

/**
 * Builds an authorized Auth Admin request function.
 *
 * The service-role key is read HERE and nowhere else, exactly as the invite
 * path already does, so `staff-credential-provisioning.ts` stays a pure
 * transport module with no access to it. Credential values pass straight
 * through to Supabase Auth and are never logged.
 */
function credentialDeps(): StaffCredentialDeps {
  const env = getLeadIntakeServerEnv();
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error("[ONEDECORE Admin] Service-role key unavailable.");
  }

  const base = env.supabaseUrl.replace(/\/+$/, "");
  const key = env.serviceRoleKey;

  return {
    authorizedRequest: async (path, init) =>
      fetch(`${base}${path}`, {
        method: init.method,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
  };
}

export async function issueStaffPhoneCredentialsInAuth(
  input: IssueStaffCredentialsInput
): Promise<IssueStaffCredentialsResult> {
  return issueStaffPhoneCredentials(input, credentialDeps());
}

export async function resetStaffPhonePasswordInAuth(input: {
  readonly staffId: string;
  readonly password: string;
}): Promise<{ readonly userId: string }> {
  return resetStaffPhonePassword(input, credentialDeps());
}

export async function revokeStaffAuthAccessInAuth(input: {
  readonly staffId: string;
}): Promise<{ readonly userId: string; readonly banned: boolean }> {
  return revokeStaffAuthAccess(input, credentialDeps());
}

export async function reactivateStaffAuthAccessInAuth(input: {
  readonly staffId: string;
}): Promise<{ readonly userId: string }> {
  return reactivateStaffAuthAccess(input, credentialDeps());
}

export async function changeStaffAuthLoginPhoneInAuth(input: {
  readonly staffId: string;
  readonly loginPhoneE164: string;
}): Promise<{ readonly userId: string; readonly loginPhoneE164: string }> {
  return changeStaffAuthLoginPhone(input, credentialDeps());
}

/**
 * One-time transport repair for a login issued under the old phone provider.
 *
 * Exposed as an explicit, separately-invoked operation. It is deliberately NOT
 * called from the login action or from any automatic path: repairing on a failed
 * sign-in would let an unauthenticated request trigger an Auth write.
 */
export async function convertStaffAuthLoginToAliasInAuth(input: {
  readonly staffId: string;
  readonly loginPhoneE164: string;
}): Promise<ConvertStaffAuthLoginResult> {
  return convertStaffAuthLoginToAlias(input, credentialDeps());
}
