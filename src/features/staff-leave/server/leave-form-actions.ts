"use server";

import { revalidatePath } from "next/cache";
import { isLeaveHalfDayPart } from "../contracts/dto.ts";
import { LeaveError } from "../contracts/errors.ts";
import {
  approve,
  cancel,
  create,
  reject,
} from "./leave-actions.ts";
import { create as createHoliday, archive as archiveHoliday } from "./holiday-actions.ts";
import { requireLeaveSelfAccess } from "./leave-auth.ts";

export interface LeaveFormActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
}

const INITIAL_STATE: LeaveFormActionState = {
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

export async function createLeaveRequestAction(
  _prevState: LeaveFormActionState,
  formData: FormData
): Promise<LeaveFormActionState> {
  try {
    await requireLeaveSelfAccess();

    const halfDayRaw = parseNullableString(formData.get("halfDayPart"));
    const halfDayPart =
      halfDayRaw && isLeaveHalfDayPart(halfDayRaw) ? halfDayRaw : null;

    await create({
      leaveTypeId: String(formData.get("leaveTypeId") ?? ""),
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      halfDayPart,
    });

    revalidatePath("/admin/leave");
    return { success: true, message: "Leave request submitted." };
  } catch (error) {
    if (error instanceof LeaveError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Leave request could not be submitted." };
  }
}

export async function cancelLeaveRequestAction(
  _prevState: LeaveFormActionState,
  formData: FormData
): Promise<LeaveFormActionState> {
  try {
    await cancel({
      requestId: String(formData.get("requestId") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });

    revalidatePath("/admin/leave");
    return { success: true, message: "Leave request cancelled." };
  } catch (error) {
    if (error instanceof LeaveError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Leave request could not be cancelled." };
  }
}

export async function approveLeaveRequestAction(
  _prevState: LeaveFormActionState,
  formData: FormData
): Promise<LeaveFormActionState> {
  try {
    await approve({
      requestId: String(formData.get("requestId") ?? ""),
      note: parseNullableString(formData.get("note")),
    });

    revalidatePath("/admin/leave/team");
    return { success: true, message: "Leave request approved." };
  } catch (error) {
    if (error instanceof LeaveError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Leave request could not be approved." };
  }
}

export async function rejectLeaveRequestAction(
  _prevState: LeaveFormActionState,
  formData: FormData
): Promise<LeaveFormActionState> {
  try {
    await reject({
      requestId: String(formData.get("requestId") ?? ""),
      note: parseNullableString(formData.get("note")),
    });

    revalidatePath("/admin/leave/team");
    return { success: true, message: "Leave request rejected." };
  } catch (error) {
    if (error instanceof LeaveError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Leave request could not be rejected." };
  }
}

export async function createHolidayAction(
  _prevState: LeaveFormActionState,
  formData: FormData
): Promise<LeaveFormActionState> {
  try {
    await createHoliday({
      holidayDate: String(formData.get("holidayDate") ?? ""),
      name: String(formData.get("name") ?? ""),
    });

    revalidatePath("/admin/holidays");
    return { success: true, message: "Holiday created." };
  } catch (error) {
    if (error instanceof LeaveError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Holiday could not be created." };
  }
}

export async function archiveHolidayAction(
  _prevState: LeaveFormActionState,
  formData: FormData
): Promise<LeaveFormActionState> {
  try {
    await archiveHoliday(String(formData.get("holidayId") ?? ""));
    revalidatePath("/admin/holidays");
    return { success: true, message: "Holiday archived." };
  } catch (error) {
    if (error instanceof LeaveError) {
      return { success: false, message: error.message, code: error.code };
    }
    return { success: false, message: "Holiday could not be archived." };
  }
}
