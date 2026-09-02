"use server";

import { revalidatePath } from "next/cache";
import {
  isWorkforceFinalCategory,
  isWorkforceSubmittableCategory,
  type WorkforceFinalCategory,
  type WorkforceSubmittableCategory,
} from "../contracts/workforce-contracts.ts";
import { WorkforceError } from "../contracts/workforce-errors.ts";
import {
  approveAttendanceDay,
  rejectAttendanceDay,
  requestAttendanceCorrection,
  returnAttendanceForCorrection,
  submitAttendanceDay,
} from "./workforce-actions.ts";

export interface WorkforceFormActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  /** Rows that failed during a bulk action, so partial success stays visible. */
  readonly failures?: readonly string[];
}

export const INITIAL_WORKFORCE_FORM_STATE: WorkforceFormActionState = {
  success: false,
  message: "",
};

function fail(error: unknown, fallback: string): WorkforceFormActionState {
  if (error instanceof WorkforceError) {
    return { success: false, message: error.message, code: error.code };
  }
  return { success: false, message: fallback };
}

function readDate(formData: FormData): string {
  return String(formData.get("attendanceDate") ?? "").trim();
}

/** Staff submits one daily attendance category. */
export async function submitAttendanceDayAction(
  _prevState: WorkforceFormActionState,
  formData: FormData
): Promise<WorkforceFormActionState> {
  const category = String(formData.get("category") ?? "").trim();

  try {
    if (!isWorkforceSubmittableCategory(category)) {
      return {
        success: false,
        message: "Select Weekly Off, Half Day 4H, Full Day 8H or Full Day 12H.",
        code: "WORKFORCE_CATEGORY_INVALID",
      };
    }

    await submitAttendanceDay({
      attendanceDate: readDate(formData),
      category: category as WorkforceSubmittableCategory,
    });

    revalidatePath("/admin/attendance");
    revalidatePath("/admin/attendance/approvals");
    return { success: true, message: "Attendance submitted for approval." };
  } catch (error) {
    return fail(error, "Unable to submit attendance.");
  }
}

/** Staff asks a Super Admin to correct wrong or missing check-in/out evidence. */
export async function requestAttendanceCorrectionAction(
  _prevState: WorkforceFormActionState,
  formData: FormData
): Promise<WorkforceFormActionState> {
  try {
    await requestAttendanceCorrection({
      attendanceDate: readDate(formData),
      note: String(formData.get("note") ?? ""),
    });

    revalidatePath("/admin/attendance");
    revalidatePath("/admin/attendance/approvals");
    return { success: true, message: "Correction request sent." };
  } catch (error) {
    return fail(error, "Unable to send the correction request.");
  }
}

/**
 * Super Admin approve, or Edit + Approve when a final category is supplied.
 * Authority and the Weekly Off cap are enforced in the database.
 */
export async function approveAttendanceDayAction(
  _prevState: WorkforceFormActionState,
  formData: FormData
): Promise<WorkforceFormActionState> {
  const finalCategory = String(formData.get("finalCategory") ?? "").trim();

  try {
    if (finalCategory.length > 0 && !isWorkforceFinalCategory(finalCategory)) {
      return {
        success: false,
        message: "Invalid final attendance category.",
        code: "WORKFORCE_CATEGORY_INVALID",
      };
    }

    await approveAttendanceDay({
      staffId: String(formData.get("staffId") ?? ""),
      attendanceDate: readDate(formData),
      finalCategory:
        finalCategory.length > 0 ? (finalCategory as WorkforceFinalCategory) : null,
      note: String(formData.get("note") ?? ""),
    });

    revalidatePath("/admin/attendance/approvals");
    revalidatePath("/admin/attendance");
    return { success: true, message: "Attendance approved." };
  } catch (error) {
    return fail(error, "Unable to approve attendance.");
  }
}

export async function rejectAttendanceDayAction(
  _prevState: WorkforceFormActionState,
  formData: FormData
): Promise<WorkforceFormActionState> {
  try {
    await rejectAttendanceDay({
      staffId: String(formData.get("staffId") ?? ""),
      attendanceDate: readDate(formData),
      note: String(formData.get("note") ?? ""),
    });

    revalidatePath("/admin/attendance/approvals");
    return { success: true, message: "Attendance rejected." };
  } catch (error) {
    return fail(error, "Unable to reject attendance.");
  }
}

export async function returnAttendanceForCorrectionAction(
  _prevState: WorkforceFormActionState,
  formData: FormData
): Promise<WorkforceFormActionState> {
  try {
    await returnAttendanceForCorrection({
      staffId: String(formData.get("staffId") ?? ""),
      attendanceDate: readDate(formData),
      note: String(formData.get("note") ?? ""),
    });

    revalidatePath("/admin/attendance/approvals");
    return { success: true, message: "Sent back for correction." };
  } catch (error) {
    return fail(error, "Unable to send the day back for correction.");
  }
}

/**
 * Approve several straightforward rows in one submit.
 *
 * Each row goes through the SAME `approve_attendance_day` RPC as a single
 * approval, so bulk approval cannot bypass validation, authority or the Weekly
 * Off monthly cap. A row that fails is reported rather than silently skipped,
 * and the remaining rows still proceed.
 */
export async function approveSelectedAttendanceAction(
  _prevState: WorkforceFormActionState,
  formData: FormData
): Promise<WorkforceFormActionState> {
  // Each checkbox carries "<staffId>|<attendanceDate>".
  const selections = formData
    .getAll("selection")
    .map((value) => String(value))
    .filter((value) => value.includes("|"));

  if (selections.length === 0) {
    return { success: false, message: "Select at least one row to approve." };
  }

  const failures: string[] = [];
  let approved = 0;

  for (const selection of selections) {
    const [staffId, attendanceDate] = selection.split("|");
    if (!staffId || !attendanceDate) {
      failures.push(`${selection}: malformed selection`);
      continue;
    }
    try {
      await approveAttendanceDay({ staffId, attendanceDate, finalCategory: null });
      approved += 1;
    } catch (error) {
      const message =
        error instanceof WorkforceError ? error.message : "Unknown error";
      failures.push(`${attendanceDate}: ${message}`);
    }
  }

  revalidatePath("/admin/attendance/approvals");

  if (failures.length === 0) {
    return { success: true, message: `Approved ${approved} day(s).` };
  }

  return {
    success: approved > 0,
    message:
      approved > 0
        ? `Approved ${approved} day(s); ${failures.length} could not be approved.`
        : "No rows could be approved.",
    failures,
  };
}
