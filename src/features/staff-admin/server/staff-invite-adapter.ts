import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  runStaffInvite,
  type StaffInviteInput,
  type StaffInviteResult,
} from "../contracts/staff-invite.ts";

export type { StaffInviteInput, StaffInviteResult } from "../contracts/staff-invite.ts";
export { setStaffInviteAdapterForTests } from "../contracts/staff-invite.ts";

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
