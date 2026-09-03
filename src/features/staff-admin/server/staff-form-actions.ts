"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StaffAssignableRoleCode, StaffProfileStatusCode } from "../contracts/permissions.ts";
import { isStaffAssignableRoleCode, isStaffProfileStatusCode } from "../contracts/permissions.ts";
import { StaffError } from "../contracts/errors.ts";
import { validateCreateStaffMemberInput } from "../contracts/dto.ts";
import {
  readStaffCreateFormValues,
  staffErrorCodeToField,
  STAFF_FORM_CORRECTION_SUMMARY,
  toStaffCreateFieldErrors,
  type StaffCreateFieldErrors,
  type StaffFormActionState,
} from "../contracts/staff-form-state.ts";
import {
  attachStaffAppAccess,
  createStaffMember,
  reconcileStaffInvite,
  setReportingManager,
  setStaffStatus,
  updateEmployment,
} from "./staff-actions.ts";
import { requireStaffAdminAccess } from "./staff-auth.ts";

// Type-only re-export: erased at compile time, so the "use server" contract
// holds. The runtime value lives in ../contracts/staff-form-state.ts.
export type { StaffFormActionState };

function parseBoolean(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}

function parseNullableString(value: FormDataEntryValue | null): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function createStaffMemberAction(
  prevState: StaffFormActionState,
  formData: FormData
): Promise<StaffFormActionState> {
  void prevState;

  // Read every control up front so any rejection path can echo it back intact.
  const values = readStaffCreateFormValues(formData);
  const clientRequestId = String(formData.get("clientRequestId") ?? "");

  const reject = (
    message: string,
    fieldErrors: StaffCreateFieldErrors,
    code?: string
  ): StaffFormActionState => ({
    success: false,
    message,
    code,
    values,
    fieldErrors,
  });

  try {
    await requireStaffAdminAccess("/admin/staff/new");

    // Presentation-side validation produces the full field map in one pass so
    // the user sees every problem at once instead of one error per round trip.
    // `createStaffMember` re-validates below and remains authoritative.
    const validationErrors = validateCreateStaffMemberInput({
      clientRequestId,
      employeeCode: values.employeeCode,
      displayName: values.displayName,
      email: values.email,
      phoneE164: values.phoneE164 || null,
      designation: values.designation,
      joiningDate: values.joiningDate,
      roleCode: values.roleCode as StaffAssignableRoleCode,
      reportingManagerId: values.reportingManagerId || null,
      attendanceEligible: values.attendanceEligible,
      attendancePolicyId: values.attendancePolicyId || null,
    });

    const fieldErrors = toStaffCreateFieldErrors(validationErrors);
    if (Object.keys(fieldErrors).length > 0) {
      return reject(STAFF_FORM_CORRECTION_SUMMARY, fieldErrors, "STAFF_VALIDATION_FAILED");
    }

    if (!isStaffAssignableRoleCode(values.roleCode)) {
      return reject(
        STAFF_FORM_CORRECTION_SUMMARY,
        { roleCode: "Select a valid operational role." },
        "STAFF_INVALID_ROLE"
      );
    }

    const result = await createStaffMember({
      clientRequestId,
      employeeCode: values.employeeCode,
      displayName: values.displayName,
      email: values.email,
      phoneE164: values.phoneE164 || null,
      designation: values.designation,
      joiningDate: values.joiningDate,
      roleCode: values.roleCode as StaffAssignableRoleCode,
      reportingManagerId: values.reportingManagerId || null,
      attendanceEligible: values.attendanceEligible,
      attendancePolicyId: values.attendancePolicyId || null,
    });

    if (result.reconciliationState === "auth_created_db_pending") {
      await reconcileStaffInvite(clientRequestId);
    }

    revalidatePath("/admin/staff");
    redirect(`/admin/staff/${result.staffId}`);
  } catch (error) {
    // `redirect()` signals success by throwing; it must not be treated as a
    // failure, so only StaffError is converted into form state here.
    if (error instanceof StaffError) {
      const field = staffErrorCodeToField(error.code);
      if (field) {
        return reject(STAFF_FORM_CORRECTION_SUMMARY, { [field]: error.message }, error.code);
      }
      return reject(error.message, {}, error.code);
    }
    throw error;
  }
}

export async function setStaffStatusAction(
  _prevState: StaffFormActionState,
  formData: FormData
): Promise<StaffFormActionState> {
  try {
    await requireStaffAdminAccess();

    const status = String(formData.get("status") ?? "");
    if (!isStaffProfileStatusCode(status)) {
      return { success: false, message: "Invalid profile status." };
    }

    const staffId = String(formData.get("staffId") ?? "");
    await setStaffStatus({
      staffId,
      status: status as StaffProfileStatusCode,
      reason: String(formData.get("reason") ?? ""),
    });

    revalidatePath(`/admin/staff/${staffId}`);
    revalidatePath("/admin/staff");
    return { success: true, message: "Staff status updated." };
  } catch (error) {
    if (error instanceof StaffError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Unable to update staff status." };
  }
}

export async function setReportingManagerAction(
  _prevState: StaffFormActionState,
  formData: FormData
): Promise<StaffFormActionState> {
  try {
    await requireStaffAdminAccess();

    const staffId = String(formData.get("staffId") ?? "");
    const managerId = parseNullableString(formData.get("managerId"));
    await setReportingManager({
      staffId,
      managerId,
      reason: String(formData.get("reason") ?? ""),
    });

    revalidatePath(`/admin/staff/${staffId}`);
    revalidatePath("/admin/staff");
    return { success: true, message: "Reporting manager updated." };
  } catch (error) {
    if (error instanceof StaffError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Unable to update reporting manager." };
  }
}

export async function updateStaffEmploymentAction(
  _prevState: StaffFormActionState,
  formData: FormData
): Promise<StaffFormActionState> {
  try {
    await requireStaffAdminAccess();

    const staffId = String(formData.get("staffId") ?? "");
    await updateEmployment({
      staffId,
      employeeCode: parseNullableString(formData.get("employeeCode")),
      designation: parseNullableString(formData.get("designation")),
      joiningDate: parseNullableString(formData.get("joiningDate")),
      phoneE164: parseNullableString(formData.get("phoneE164")),
      displayName: parseNullableString(formData.get("displayName")),
      attendanceEligible: formData.has("attendanceEligible")
        ? parseBoolean(formData.get("attendanceEligible"))
        : null,
      attendancePolicyId: parseNullableString(formData.get("attendancePolicyId")),
      reason: parseNullableString(formData.get("reason")),
    });

    revalidatePath(`/admin/staff/${staffId}`);
    revalidatePath("/admin/staff");
    return { success: true, message: "Employment details updated." };
  } catch (error) {
    if (error instanceof StaffError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Unable to update employment details." };
  }
}

/**
 * Super Admin attaches a login identity to a staff member created without one.
 *
 * Email is required HERE (unlike creation) because this action's entire purpose
 * is to supply the missing address. A placeholder is still never generated.
 */
export async function attachStaffAppAccessAction(
  _prevState: StaffFormActionState,
  formData: FormData
): Promise<StaffFormActionState> {
  try {
    await requireStaffAdminAccess();

    const staffId = String(formData.get("staffId") ?? "");
    await attachStaffAppAccess({
      staffId,
      email: String(formData.get("email") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
    });

    revalidatePath(`/admin/staff/${staffId}`);
    revalidatePath("/admin/staff");
    return {
      success: true,
      message:
        "App access activated. A set-password email has been sent to the staff member.",
    };
  } catch (error) {
    if (error instanceof StaffError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Unable to activate app access." };
  }
}
