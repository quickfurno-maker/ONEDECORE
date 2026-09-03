/**
 * Form state for the Login & Access panel.
 *
 * Lives in contracts rather than beside the server actions because a
 * "use server" module may only export async functions at runtime — a plain
 * object exported from one takes the whole route down.
 *
 * The shape carries NO password field in either direction. A password is read
 * from the submitted FormData, handed to Supabase Auth, and forgotten; it is
 * never echoed back, never stored, and there is no "view password" anywhere.
 */

/** Which control produced this result, so only that form shows the message. */
export type StaffCredentialOperation =
  | "issue"
  | "reset"
  | "revoke"
  | "reactivate"
  | "change_phone";

export interface StaffCredentialFormState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly operation?: StaffCredentialOperation;
  /** The 10 digits staff type, echoed after a successful issue or phone change. */
  readonly loginUsername?: string | null;
}

export const INITIAL_STAFF_CREDENTIAL_FORM_STATE: StaffCredentialFormState = {
  success: false,
  message: "",
};
