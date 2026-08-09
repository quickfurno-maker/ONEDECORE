"use server";

import { revalidatePath } from "next/cache";
import {
  ATTENDANCE_CORRECTION_TYPES,
  ATTENDANCE_LOCATION_CATEGORIES,
  isAttendanceCorrectionType,
  isAttendanceLocationCategory,
} from "../contracts/dto.ts";
import { AttendanceError } from "../contracts/errors.ts";
import { checkIn, checkOut, correctDay } from "./attendance-actions.ts";
import { publishPolicy, setCurrentPolicy } from "./attendance-policy-actions.ts";
import { requireAttendancePolicyManageAccess } from "./attendance-auth.ts";

export interface AttendanceFormActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
}

const INITIAL_STATE: AttendanceFormActionState = {
  success: false,
  message: "",
};

function parseNullableString(value: FormDataEntryValue | null): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseNullableNumber(value: FormDataEntryValue | null): number | null {
  const raw = parseNullableString(value);
  if (raw == null) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function checkInAction(
  _prevState: AttendanceFormActionState,
  formData: FormData
): Promise<AttendanceFormActionState> {
  try {
    const locationRaw = parseNullableString(formData.get("locationCategory"));
    const locationCategory =
      locationRaw && isAttendanceLocationCategory(locationRaw) ? locationRaw : null;

    await checkIn({
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
      locationCategory,
      latitude: parseNullableNumber(formData.get("latitude")),
      longitude: parseNullableNumber(formData.get("longitude")),
      locationAccuracyM: parseNullableNumber(formData.get("locationAccuracyM")),
    });

    revalidatePath("/admin/attendance");
    return { success: true, message: "Check-in recorded." };
  } catch (error) {
    if (error instanceof AttendanceError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Check-in could not be recorded." };
  }
}

export async function checkOutAction(
  _prevState: AttendanceFormActionState,
  formData: FormData
): Promise<AttendanceFormActionState> {
  try {
    const locationRaw = parseNullableString(formData.get("locationCategory"));
    const locationCategory =
      locationRaw && isAttendanceLocationCategory(locationRaw) ? locationRaw : null;

    await checkOut({
      idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
      locationCategory,
      latitude: parseNullableNumber(formData.get("latitude")),
      longitude: parseNullableNumber(formData.get("longitude")),
      locationAccuracyM: parseNullableNumber(formData.get("locationAccuracyM")),
    });

    revalidatePath("/admin/attendance");
    return { success: true, message: "Check-out recorded." };
  } catch (error) {
    if (error instanceof AttendanceError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Check-out could not be recorded." };
  }
}

export async function correctAttendanceDayAction(
  _prevState: AttendanceFormActionState,
  formData: FormData
): Promise<AttendanceFormActionState> {
  try {
    const correctionType = String(formData.get("correctionType") ?? "");
    if (!isAttendanceCorrectionType(correctionType)) {
      return {
        success: false,
        message: `Correction type must be one of: ${ATTENDANCE_CORRECTION_TYPES.join(", ")}.`,
      };
    }

    await correctDay({
      staffId: String(formData.get("staffId") ?? ""),
      attendanceDate: String(formData.get("attendanceDate") ?? ""),
      correctionType,
      reason: String(formData.get("reason") ?? ""),
    });

    revalidatePath("/admin/attendance/corrections");
    revalidatePath("/admin/attendance/team");
    return { success: true, message: "Attendance correction recorded." };
  } catch (error) {
    if (error instanceof AttendanceError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Attendance correction could not be recorded." };
  }
}

export async function publishAttendancePolicyAction(
  _prevState: AttendanceFormActionState,
  formData: FormData
): Promise<AttendanceFormActionState> {
  try {
    await requireAttendancePolicyManageAccess();

    const weeklyOffRaw = String(formData.get("weeklyOffDays") ?? "");
    const weeklyOffDays = weeklyOffRaw
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

    await publishPolicy({
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      timezone: String(formData.get("timezone") ?? "Asia/Kolkata"),
      workdayStartLocal: String(formData.get("workdayStartLocal") ?? ""),
      workdayEndLocal: String(formData.get("workdayEndLocal") ?? ""),
      lateGraceMinutes: Number(formData.get("lateGraceMinutes") ?? 0),
      halfDayThresholdMinutes: Number(formData.get("halfDayThresholdMinutes") ?? 0),
      missingCheckoutCutoffLocal: String(formData.get("missingCheckoutCutoffLocal") ?? ""),
      weeklyOffDays,
      locationRequired: formData.get("locationRequired") === "on",
      supersedesPolicyId: parseNullableString(formData.get("supersedesPolicyId")),
    });

    revalidatePath("/admin/attendance-policies");
    return { success: true, message: "Attendance policy published." };
  } catch (error) {
    if (error instanceof AttendanceError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Attendance policy could not be published." };
  }
}

export async function setCurrentAttendancePolicyAction(
  _prevState: AttendanceFormActionState,
  formData: FormData
): Promise<AttendanceFormActionState> {
  try {
    await requireAttendancePolicyManageAccess();
    await setCurrentPolicy(String(formData.get("policyId") ?? ""));
    revalidatePath("/admin/attendance-policies");
    return { success: true, message: "Current attendance policy updated." };
  } catch (error) {
    if (error instanceof AttendanceError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Current attendance policy could not be updated." };
  }
}

export { ATTENDANCE_LOCATION_CATEGORIES };
