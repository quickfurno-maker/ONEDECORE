"use server";

import { revalidatePath } from "next/cache";
import { StaffError } from "../contracts/errors.ts";
import {
  STAFF_PASSWORD_SUCCESS_ISSUE,
  STAFF_PASSWORD_SUCCESS_RESET,
  categoriseStaffCredentialFailure,
} from "../contracts/staff-password-messages.ts";
import type {
  StaffCredentialFormState,
  StaffCredentialOperation,
} from "../contracts/staff-credential-form-state.ts";
import {
  changeStaffLoginPhone,
  issueStaffCredentials,
  reactivateStaffAccess,
  resetStaffPassword,
  revokeStaffAccess,
} from "./staff-credential-actions.ts";

export type { StaffCredentialFormState } from "../contracts/staff-credential-form-state.ts";

function read(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

/**
 * Wraps one credential operation.
 *
 * The FormData — which is where the password lives — never leaves the calling
 * action, and nothing derived from it appears in the returned state.
 */
async function run(
  operation: StaffCredentialOperation,
  staffId: string,
  work: () => Promise<{ readonly loginUsername: string | null }>,
  successMessage: string
): Promise<StaffCredentialFormState> {
  if (staffId.trim().length === 0) {
    return {
      success: false,
      message: "Staff member is required.",
      code: "STAFF_VALIDATION_FAILED",
      operation,
    };
  }

  try {
    const result = await work();
    revalidatePath(`/admin/staff/${staffId}`);
    revalidatePath("/admin/staff");
    return {
      success: true,
      message: successMessage,
      operation,
      loginUsername: result.loginUsername,
    };
  } catch (error) {
    if (error instanceof StaffError) {
      // `error.details` deliberately does NOT travel: the category is all the
      // UI needs, and the provider payload stops at the server boundary.
      return {
        success: false,
        message: error.message,
        code: error.code,
        operation,
        category: categoriseStaffCredentialFailure(error.code),
      };
    }
    return {
      success: false,
      message: "The request could not be completed.",
      operation,
      category: "provider_failed",
    };
  }
}

export async function issueStaffCredentialsAction(
  _prevState: StaffCredentialFormState,
  formData: FormData
): Promise<StaffCredentialFormState> {
  const staffId = read(formData, "staffId");
  return run(
    "issue",
    staffId,
    () =>
      // No phone is read here. The username is derived server-side from the
      // authoritative staff record, so a tampered submission cannot point a
      // login at a different number.
      issueStaffCredentials({
        staffId,
        password: read(formData, "password"),
        confirmPassword: read(formData, "confirmPassword"),
        displayName: read(formData, "displayName"),
      }),
    STAFF_PASSWORD_SUCCESS_ISSUE
  );
}

export async function resetStaffPasswordAction(
  _prevState: StaffCredentialFormState,
  formData: FormData
): Promise<StaffCredentialFormState> {
  const staffId = read(formData, "staffId");
  return run(
    "reset",
    staffId,
    () =>
      resetStaffPassword({
        staffId,
        password: read(formData, "password"),
        confirmPassword: read(formData, "confirmPassword"),
      }),
    STAFF_PASSWORD_SUCCESS_RESET
  );
}

export async function revokeStaffAccessAction(
  _prevState: StaffCredentialFormState,
  formData: FormData
): Promise<StaffCredentialFormState> {
  const staffId = read(formData, "staffId");
  return run(
    "revoke",
    staffId,
    () => revokeStaffAccess({ staffId, reason: read(formData, "reason") }),
    "Application access revoked. Employment, attendance and salary records are untouched."
  );
}

export async function reactivateStaffAccessAction(
  _prevState: StaffCredentialFormState,
  formData: FormData
): Promise<StaffCredentialFormState> {
  const staffId = read(formData, "staffId");
  return run(
    "reactivate",
    staffId,
    () => reactivateStaffAccess({ staffId, reason: read(formData, "reason") }),
    "Application access restored. The password and login number are unchanged."
  );
}

export async function changeStaffLoginPhoneAction(
  _prevState: StaffCredentialFormState,
  formData: FormData
): Promise<StaffCredentialFormState> {
  const staffId = read(formData, "staffId");
  return run(
    "change_phone",
    staffId,
    () =>
      changeStaffLoginPhone({
        staffId,
        phone: read(formData, "loginPhone"),
        reason: read(formData, "reason"),
      }),
    "Login number changed. The previous number can no longer sign in."
  );
}
