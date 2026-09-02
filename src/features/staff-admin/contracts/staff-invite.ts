/**
 * Phase 6D-A — staff invite adapter contracts and test hooks.
 */

export interface StaffInviteInput {
  readonly email: string;
  readonly displayName: string;
}

export interface StaffInviteResult {
  readonly userId: string;
  readonly email: string;
}

export type StaffInviteAdapter = (
  input: StaffInviteInput
) => Promise<StaffInviteResult>;

let testInviteAdapter: StaffInviteAdapter | null = null;

/** Overrides the Auth Admin invite adapter during application tests. */
export function setStaffInviteAdapterForTests(
  adapter: StaffInviteAdapter | null
): void {
  testInviteAdapter = adapter;
}

export async function runStaffInvite(
  input: StaffInviteInput,
  defaultAdapter: StaffInviteAdapter
): Promise<StaffInviteResult> {
  const adapter = testInviteAdapter ?? defaultAdapter;
  return adapter(input);
}

/**
 * Provisioning a LOGIN identity for an employment record that already exists.
 *
 * `staffId` is the pre-allocated employment identity: the auth user MUST be
 * created with exactly this id so `profiles.id === auth.users.id` and every RLS
 * policy keeps working untouched.
 */
export interface StaffLoginProvisionInput {
  readonly staffId: string;
  readonly email: string;
  readonly displayName: string;
}

export interface StaffLoginProvisionResult {
  readonly userId: string;
  readonly email: string;
}

export type StaffLoginProvisionAdapter = (
  input: StaffLoginProvisionInput
) => Promise<StaffLoginProvisionResult>;

let testLoginProvisionAdapter: StaffLoginProvisionAdapter | null = null;

/** Overrides the login-provisioning adapter during application tests. */
export function setStaffLoginProvisionAdapterForTests(
  adapter: StaffLoginProvisionAdapter | null
): void {
  testLoginProvisionAdapter = adapter;
}

export async function runStaffLoginProvision(
  input: StaffLoginProvisionInput,
  defaultAdapter: StaffLoginProvisionAdapter
): Promise<StaffLoginProvisionResult> {
  const adapter = testLoginProvisionAdapter ?? defaultAdapter;
  const result = await adapter(input);

  // Hard guard: if the identity provider ever stops honouring an explicit id,
  // fail loudly rather than silently creating a second, mismatched identity
  // that no RLS policy would ever match.
  if (result.userId !== input.staffId) {
    throw new Error(
      "Auth provider did not honour the requested user id; login identity would not match the employment identity."
    );
  }

  return result;
}
