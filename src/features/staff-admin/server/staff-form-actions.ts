"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StaffAssignableRoleCode, StaffProfileStatusCode } from "../contracts/permissions.ts";
import { isStaffAssignableRoleCode, isStaffProfileStatusCode } from "../contracts/permissions.ts";
import { StaffError } from "../contracts/errors.ts";
import {
  createStaffMember,
  reconcileStaffInvite,
  setReportingManager,
  setStaffStatus,
  updateEmployment,
} from "./staff-actions.ts";
import { requireStaffAdminAccess } from "./staff-auth.ts";

export interface StaffFormActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
}

const INITIAL_STATE: StaffFormActionState = {
  success: false,
  message: "",
};

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
  _prevState: StaffFormActionState,
  formData: FormData
): Promise<StaffFormActionState> {
  try {
    await requireStaffAdminAccess("/admin/staff/new");

    const roleCode = String(formData.get("roleCode") ?? "");
    if (!isStaffAssignableRoleCode(roleCode)) {
      return { success: false, message: "Select a valid operational role." };
    }

    const result = await createStaffMember({
      clientRequestId: String(formData.get("clientRequestId") ?? ""),
      employeeCode: String(formData.get("employeeCode") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phoneE164: parseNullableString(formData.get("phoneE164")),
      designation: String(formData.get("designation") ?? ""),
      joiningDate: String(formData.get("joiningDate") ?? ""),
      roleCode: roleCode as StaffAssignableRoleCode,
      reportingManagerId: parseNullableString(formData.get("reportingManagerId")),
      attendanceEligible: parseBoolean(formData.get("attendanceEligible")),
      attendancePolicyId: parseNullableString(formData.get("attendancePolicyId")),
    });

    if (result.reconciliationState === "auth_created_db_pending") {
      await reconcileStaffInvite(String(formData.get("clientRequestId") ?? ""));
    }

    revalidatePath("/admin/staff");
    redirect(`/admin/staff/${result.staffId}`);
  } catch (error) {
    if (error instanceof StaffError) {
      return { success: false, message: error.message, code: error.code };
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
