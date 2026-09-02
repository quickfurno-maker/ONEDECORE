import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getLeadIntakeServerEnv } from "@/config/server-env";
import { provisionLoginIdentityViaRest } from "./staff-login-provisioning.ts";
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
