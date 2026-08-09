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
