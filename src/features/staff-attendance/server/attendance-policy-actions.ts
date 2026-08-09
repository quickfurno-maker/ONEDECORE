"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import {
  AttendanceError,
  attendanceErrorFromPostgresMessage,
} from "../contracts/errors.ts";
import type {
  PublishAttendancePolicyInput,
  PublishAttendancePolicyResult,
  SetCurrentAttendancePolicyResult,
} from "../contracts/dto.ts";
import { requireAttendancePolicyManageAccess } from "./attendance-auth.ts";

type AttendancePolicyClient = SupabaseClient<Database>;

interface PublishAttendancePolicyRpcArgs {
  readonly p_code: string;
  readonly p_name: string;
  readonly p_timezone: string;
  readonly p_workday_start_local: string;
  readonly p_workday_end_local: string;
  readonly p_late_grace_minutes: number;
  readonly p_half_day_threshold_minutes: number;
  readonly p_missing_checkout_cutoff_local: string;
  readonly p_weekly_off_days: readonly number[];
  readonly p_location_required: boolean;
  readonly p_supersedes_policy_id?: string | null;
}

interface SetCurrentAttendancePolicyRpcArgs {
  readonly p_policy_id: string;
}

type AttendancePolicyRpcClient = AttendancePolicyClient & {
  rpc(
    fn: "publish_attendance_policy",
    args: PublishAttendancePolicyRpcArgs
  ): ReturnType<AttendancePolicyClient["rpc"]>;
  rpc(
    fn: "set_current_attendance_policy",
    args: SetCurrentAttendancePolicyRpcArgs
  ): ReturnType<AttendancePolicyClient["rpc"]>;
};

function policyRpcClient(client: AttendancePolicyClient): AttendancePolicyRpcClient {
  return client as AttendancePolicyRpcClient;
}

export async function publishPolicy(
  input: PublishAttendancePolicyInput
): Promise<PublishAttendancePolicyResult> {
  await requireAttendancePolicyManageAccess();

  if (input.timezone !== "Asia/Kolkata") {
    throw new AttendanceError({
      code: "ATTENDANCE_POLICY_NOT_CONFIGURED",
      message: "Attendance policy is not configured.",
      httpStatus: 422,
    });
  }

  const supabase = await createClient();
  const { data, error } = await policyRpcClient(supabase).rpc("publish_attendance_policy", {
    p_code: input.code.trim(),
    p_name: input.name.trim(),
    p_timezone: input.timezone,
    p_workday_start_local: input.workdayStartLocal,
    p_workday_end_local: input.workdayEndLocal,
    p_late_grace_minutes: input.lateGraceMinutes,
    p_half_day_threshold_minutes: input.halfDayThresholdMinutes,
    p_missing_checkout_cutoff_local: input.missingCheckoutCutoffLocal,
    p_weekly_off_days: [...input.weeklyOffDays],
    p_location_required: input.locationRequired,
    p_supersedes_policy_id: input.supersedesPolicyId ?? null,
  });

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message, "ATTENDANCE_POLICY_NOT_CONFIGURED");
  }

  const payload = data as { policyId: string; code: string };
  return {
    policyId: payload.policyId,
    code: payload.code,
  };
}

export async function setCurrentPolicy(
  policyId: string
): Promise<SetCurrentAttendancePolicyResult> {
  await requireAttendancePolicyManageAccess();

  const supabase = await createClient();
  const { data, error } = await policyRpcClient(supabase).rpc("set_current_attendance_policy", {
    p_policy_id: policyId,
  });

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message, "ATTENDANCE_POLICY_NOT_CONFIGURED");
  }

  const payload = data as { policyId: string; isCurrent: true };
  return {
    policyId: payload.policyId,
    isCurrent: true,
  };
}
