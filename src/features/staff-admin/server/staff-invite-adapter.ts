import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getLeadIntakeServerEnv } from "@/config/server-env";
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
 * pre-allocated employment id.
 *
 * Called through the Auth Admin REST endpoint rather than the typed SDK because
 * `AdminUserAttributes` does not expose `id`, even though GoTrue accepts and
 * honours it (verified against v2.193.1). The explicit id is the whole point:
 * it makes `profiles.id === auth.users.id`, so no foreign key moves and no RLS
 * policy changes. `runStaffLoginProvision` re-checks the returned id and throws
 * if it ever differs.
 */
async function defaultProvisionStaffLoginIdentity(
  input: StaffLoginProvisionInput
): Promise<StaffLoginProvisionResult> {
  const env = getLeadIntakeServerEnv();
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error("[ONEDECORE Admin] Service-role key unavailable.");
  }

  const email = input.email.trim().toLowerCase();

  const response = await fetch(`${env.supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: input.staffId,
      email,
      email_confirm: false,
      user_metadata: { display_name: input.displayName.trim() },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Auth user provisioning failed: ${detail.slice(0, 300)}`);
  }

  const created = (await response.json()) as { id?: string };
  if (!created.id) {
    throw new Error("Auth user provisioning returned no id.");
  }

  // Send the staff member a link so they can set a password. A failure here
  // leaves access_state at "invited" and is retryable; the identity already
  // exists and is correct.
  const admin = createAdminClient();
  const { error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (linkError) {
    throw new Error(`Auth user created but invite link failed: ${linkError.message}`);
  }

  return { userId: created.id, email };
}

/**
 * Server-only login-identity provisioning for an existing employment record.
 * Never import from Client Components.
 */
export async function provisionStaffLoginIdentity(
  input: StaffLoginProvisionInput
): Promise<StaffLoginProvisionResult> {
  return runStaffLoginProvision(input, defaultProvisionStaffLoginIdentity);
}
