import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import type { AttendancePolicyOption } from "@/features/staff-admin/server/staff-queries.ts";
import {
  AttendanceError,
  attendanceErrorFromPostgresMessage,
} from "../contracts/errors.ts";
import { requireAttendancePolicyManageAccess } from "./attendance-auth.ts";

type AttendancePolicyClient = SupabaseClient<Database>;

type AttendancePolicyQueryResult = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type AttendancePolicyQueryBuilder = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> & {
  select(columns: string): AttendancePolicyQueryBuilder;
  eq(column: string, value: string | boolean): AttendancePolicyQueryBuilder;
  order(column: string, options: { ascending: boolean }): AttendancePolicyQueryBuilder;
};

type AttendancePolicyQueryClient = {
  from(table: "attendance_policies" | "staff_employment_profiles"): AttendancePolicyQueryBuilder;
};

function attendancePolicyQueryClient(
  client: AttendancePolicyClient
): AttendancePolicyQueryClient {
  return client as unknown as AttendancePolicyQueryClient;
}

export interface AttendancePolicyRow extends AttendancePolicyOption {
  readonly timezone: string;
  readonly workdayStartLocal: string;
  readonly workdayEndLocal: string;
  readonly lateGraceMinutes: number;
  readonly halfDayThresholdMinutes: number;
  readonly missingCheckoutCutoffLocal: string;
  readonly weeklyOffDays: readonly number[];
  readonly locationRequired: boolean;
}

export interface CorrectionStaffOption {
  readonly staffId: string;
  readonly displayName: string;
  readonly employeeCode: string;
}

export async function loadAttendancePolicies(): Promise<readonly AttendancePolicyRow[]> {
  await requireAttendancePolicyManageAccess();

  const supabase = await createClient();
  const { data, error } = await attendancePolicyQueryClient(supabase)
    .from("attendance_policies")
    .select(
      "id, code, name, timezone, workday_start_local, workday_end_local, late_grace_minutes, half_day_threshold_minutes, missing_checkout_cutoff_local, weekly_off_days, location_required, is_current"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message);
  }

  return (
    (data as Array<{
      id: string;
      code: string;
      name: string;
      timezone: string;
      workday_start_local: string;
      workday_end_local: string;
      late_grace_minutes: number;
      half_day_threshold_minutes: number;
      missing_checkout_cutoff_local: string;
      weekly_off_days: number[];
      location_required: boolean;
      is_current: boolean;
    }> | null) ?? []
  ).map((row) => ({
    policyId: row.id,
    code: row.code,
    name: row.name,
    isCurrent: row.is_current,
    timezone: row.timezone,
    workdayStartLocal: row.workday_start_local,
    workdayEndLocal: row.workday_end_local,
    lateGraceMinutes: row.late_grace_minutes,
    halfDayThresholdMinutes: row.half_day_threshold_minutes,
    missingCheckoutCutoffLocal: row.missing_checkout_cutoff_local,
    weeklyOffDays: row.weekly_off_days,
    locationRequired: row.location_required,
  }));
}

export async function loadCorrectionStaffOptions(
  context: {
    readonly userId: string;
    readonly canCorrectAllAttendance: boolean;
    readonly canCorrectTeamAttendance: boolean;
  }
): Promise<readonly CorrectionStaffOption[]> {
  const supabase = await createClient();

  if (context.canCorrectAllAttendance) {
    const { data, error } = await attendancePolicyQueryClient(supabase)
      .from("staff_employment_profiles")
      .select(
        "staff_id, employee_code, profiles!staff_employment_profiles_staff_id_fkey(display_name)"
      )
      .eq("attendance_eligible", true)
      .order("employee_code", { ascending: true });

    if (error) {
      throw attendanceErrorFromPostgresMessage(error.message);
    }

    return (
      (data as Array<{
        staff_id: string;
        employee_code: string;
        profiles: { display_name: string | null } | null;
      }> | null) ?? []
    ).map((row) => ({
      staffId: row.staff_id,
      employeeCode: row.employee_code,
      displayName: row.profiles?.display_name?.trim() || row.employee_code,
    }));
  }

  if (!context.canCorrectTeamAttendance) {
    throw new AttendanceError({
      code: "ATTENDANCE_UNAUTHORIZED",
      message: "Authentication or permission required.",
      httpStatus: 403,
    });
  }

  const { data, error } = await attendancePolicyQueryClient(supabase)
    .from("staff_employment_profiles")
    .select(
      "staff_id, employee_code, profiles!staff_employment_profiles_staff_id_fkey(display_name)"
    )
    .eq("reporting_manager_id", context.userId)
    .eq("attendance_eligible", true)
    .order("employee_code", { ascending: true });

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message);
  }

  return (
    (data as Array<{
      staff_id: string;
      employee_code: string;
      profiles: { display_name: string | null } | null;
    }> | null) ?? []
  ).map((row) => ({
    staffId: row.staff_id,
    employeeCode: row.employee_code,
    displayName: row.profiles?.display_name?.trim() || row.employee_code,
  }));
}
