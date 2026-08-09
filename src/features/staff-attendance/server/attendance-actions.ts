"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import {
  AttendanceError,
  attendanceErrorFromPostgresMessage,
} from "../contracts/errors.ts";
import type {
  AttendanceCheckMutationResult,
  AttendanceCorrectionResult,
  AttendanceCorrectionType,
  AttendanceDayRow,
  AttendanceLocationCategory,
  AttendanceMonthSummary,
  AttendanceToday,
  TeamAttendanceRow,
} from "../contracts/dto.ts";
import {
  aggregateAttendanceMonthTotals,
  mapAttendanceCheckRpcResult,
  mapAttendanceCorrectionRpcResult,
  mapAttendanceDayRowToSummary,
  mapAttendanceDayRowToToday,
  monthDateRange,
  resolveAttendanceBusinessDate,
  roundAttendanceCoordinate,
} from "../contracts/dto.ts";
import {
  getAttendanceAccessContext,
  requireAttendanceSelfAccess,
  requireAttendanceTeamRead,
} from "./attendance-auth.ts";

type AttendanceServerClient = SupabaseClient<Database>;

interface CheckAttendanceRpcArgs {
  readonly p_idempotency_key: string;
  readonly p_location_category?: string | null;
  readonly p_latitude?: number | null;
  readonly p_longitude?: number | null;
  readonly p_location_accuracy_m?: number | null;
  readonly p_client_reported_at?: string | null;
}

interface CorrectAttendanceDayRpcArgs {
  readonly p_staff_id: string;
  readonly p_attendance_date: string;
  readonly p_correction_type: string;
  readonly p_reason: string;
  readonly p_details?: Record<string, unknown>;
}

type AttendanceRpcClient = AttendanceServerClient & {
  rpc(fn: "check_in_attendance", args: CheckAttendanceRpcArgs): ReturnType<AttendanceServerClient["rpc"]>;
  rpc(fn: "check_out_attendance", args: CheckAttendanceRpcArgs): ReturnType<AttendanceServerClient["rpc"]>;
  rpc(fn: "correct_attendance_day", args: CorrectAttendanceDayRpcArgs): ReturnType<AttendanceServerClient["rpc"]>;
};

type AttendanceQueryResult = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type AttendanceQueryBuilder = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> & {
  select(columns: string): AttendanceQueryBuilder;
  eq(column: string, value: string | boolean): AttendanceQueryBuilder;
  gte(column: string, value: string): AttendanceQueryBuilder;
  lte(column: string, value: string): AttendanceQueryBuilder;
  in(column: string, values: readonly string[]): AttendanceQueryBuilder;
  maybeSingle(): AttendanceQueryResult;
};

type AttendanceQueryClient = {
  from(
    table: "attendance_days" | "attendance_events" | "staff_employment_profiles"
  ): AttendanceQueryBuilder;
};

function attendanceRpcClient(client: AttendanceServerClient): AttendanceRpcClient {
  return client as AttendanceRpcClient;
}

function attendanceQueryClient(client: AttendanceServerClient): AttendanceQueryClient {
  return client as unknown as AttendanceQueryClient;
}

function assertAttendanceAccess(): Promise<NonNullable<Awaited<ReturnType<typeof getAttendanceAccessContext>>>> {
  return getAttendanceAccessContext().then((context) => {
    if (!context?.canSelfAttendance) {
      throw new AttendanceError({
        code: "ATTENDANCE_UNAUTHORIZED",
        message: "Authentication or permission required.",
        httpStatus: 401,
      });
    }
    return context;
  });
}

async function fetchAttendanceDay(
  client: AttendanceServerClient,
  staffId: string,
  attendanceDate: string
): Promise<AttendanceDayRow | null> {
  const { data, error } = await attendanceQueryClient(client)
    .from("attendance_days")
    .select(
      "staff_id, attendance_date, primary_status, first_check_in_at, last_check_out_at, worked_minutes, is_late, is_early_checkout, is_missing_checkout, has_manual_adjustment, open_session"
    )
    .eq("staff_id", staffId)
    .eq("attendance_date", attendanceDate)
    .maybeSingle();

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message);
  }

  return (data as AttendanceDayRow | null) ?? null;
}

async function fetchEventCountByDate(
  client: AttendanceServerClient,
  staffId: string,
  dates: readonly string[]
): Promise<Readonly<Record<string, number>>> {
  if (dates.length === 0) {
    return {};
  }

  const { data, error } = await attendanceQueryClient(client)
    .from("attendance_events")
    .select("attendance_date")
    .in("attendance_date", dates);

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message);
  }

  const counts: Record<string, number> = {};
  for (const row of (data as Array<{ attendance_date: string }> | null) ?? []) {
    counts[row.attendance_date] = (counts[row.attendance_date] ?? 0) + 1;
  }
  return counts;
}

export async function checkIn(input: {
  readonly idempotencyKey: string;
  readonly locationCategory?: AttendanceLocationCategory | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly locationAccuracyM?: number | null;
  readonly clientReportedAt?: string | null;
}): Promise<AttendanceCheckMutationResult> {
  await assertAttendanceAccess();

  const supabase = await createClient();
  const { data, error } = await attendanceRpcClient(supabase).rpc("check_in_attendance", {
    p_idempotency_key: input.idempotencyKey,
    p_location_category: input.locationCategory ?? null,
    p_latitude: roundAttendanceCoordinate(input.latitude),
    p_longitude: roundAttendanceCoordinate(input.longitude),
    p_location_accuracy_m: input.locationAccuracyM ?? null,
    p_client_reported_at: input.clientReportedAt ?? null,
  });

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message);
  }

  return mapAttendanceCheckRpcResult(data as unknown as Parameters<typeof mapAttendanceCheckRpcResult>[0]);
}

export async function checkOut(input: {
  readonly idempotencyKey: string;
  readonly locationCategory?: AttendanceLocationCategory | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly locationAccuracyM?: number | null;
  readonly clientReportedAt?: string | null;
}): Promise<AttendanceCheckMutationResult> {
  await assertAttendanceAccess();

  const supabase = await createClient();
  const { data, error } = await attendanceRpcClient(supabase).rpc("check_out_attendance", {
    p_idempotency_key: input.idempotencyKey,
    p_location_category: input.locationCategory ?? null,
    p_latitude: roundAttendanceCoordinate(input.latitude),
    p_longitude: roundAttendanceCoordinate(input.longitude),
    p_location_accuracy_m: input.locationAccuracyM ?? null,
    p_client_reported_at: input.clientReportedAt ?? null,
  });

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message);
  }

  return mapAttendanceCheckRpcResult(data as unknown as Parameters<typeof mapAttendanceCheckRpcResult>[0]);
}

export async function loadToday(): Promise<AttendanceToday> {
  const context = await requireAttendanceSelfAccess();
  const attendanceDate = resolveAttendanceBusinessDate();
  const supabase = await createClient();
  const row = await fetchAttendanceDay(supabase, context.userId, attendanceDate);
  return mapAttendanceDayRowToToday(row, attendanceDate);
}

export async function loadMonth(input: {
  readonly year: number;
  readonly month: number;
  readonly staffId?: string;
}): Promise<AttendanceMonthSummary> {
  const context = await requireAttendanceSelfAccess();
  const staffId = input.staffId ?? context.userId;

  if (
    staffId !== context.userId &&
    !context.canReadAllAttendance &&
    !context.canReadTeamAttendance
  ) {
    throw new AttendanceError({
      code: "ATTENDANCE_UNAUTHORIZED",
      message: "Authentication or permission required.",
      httpStatus: 403,
    });
  }

  const { startDate, endDate } = monthDateRange(input.year, input.month);
  const supabase = await createClient();
  const { data, error } = await attendanceQueryClient(supabase)
    .from("attendance_days")
    .select(
      "staff_id, attendance_date, primary_status, first_check_in_at, last_check_out_at, worked_minutes, is_late, is_early_checkout, is_missing_checkout, has_manual_adjustment, open_session"
    )
    .eq("staff_id", staffId)
    .gte("attendance_date", startDate)
    .lte("attendance_date", endDate);

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message);
  }

  const rows = (data as AttendanceDayRow[] | null) ?? [];
  const eventCounts = await fetchEventCountByDate(
    supabase,
    staffId,
    rows.map((row) => row.attendance_date)
  );
  const days = rows
    .map((row) => mapAttendanceDayRowToSummary(row, eventCounts[row.attendance_date] ?? 0))
    .sort((left, right) => left.attendanceDate.localeCompare(right.attendanceDate));

  return {
    year: input.year,
    month: input.month,
    days,
    totals: aggregateAttendanceMonthTotals(days),
  };
}

export async function loadTeam(): Promise<readonly TeamAttendanceRow[]> {
  const context = await requireAttendanceTeamRead();
  const attendanceDate = resolveAttendanceBusinessDate();
  const supabase = await createClient();

  const { data: reportRows, error: reportError } = await attendanceQueryClient(supabase)
    .from("staff_employment_profiles")
    .select("staff_id, profiles(display_name)")
    .eq("reporting_manager_id", context.userId);

  if (reportError) {
    throw attendanceErrorFromPostgresMessage(reportError.message);
  }

  const reports = (reportRows as Array<{
    staff_id: string;
    profiles: { display_name: string } | null;
  }> | null) ?? [];

  if (reports.length === 0) {
    return [];
  }

  const staffIds = reports.map((row) => row.staff_id);
  const { data: dayRows, error: dayError } = await attendanceQueryClient(supabase)
    .from("attendance_days")
    .select(
      "staff_id, attendance_date, primary_status, first_check_in_at, last_check_out_at, worked_minutes, is_late, is_early_checkout, is_missing_checkout, has_manual_adjustment, open_session"
    )
    .in("staff_id", staffIds)
    .eq("attendance_date", attendanceDate);

  if (dayError) {
    throw attendanceErrorFromPostgresMessage(dayError.message);
  }

  const dayByStaff = new Map(
    ((dayRows as AttendanceDayRow[] | null) ?? []).map((row) => [row.staff_id, row])
  );

  return reports.map((report) => {
    const day = dayByStaff.get(report.staff_id) ?? null;
    return {
      staffId: report.staff_id,
      displayName: report.profiles?.display_name ?? "Staff member",
      todayStatus: day
        ? mapAttendanceDayRowToToday(day, attendanceDate).primaryStatus
        : "unknown",
      isLate: day?.is_late ?? false,
      isEarlyCheckout: day?.is_early_checkout ?? false,
      isMissingCheckout: day?.is_missing_checkout ?? false,
      openSession: day?.open_session ?? false,
      lastCheckInAt: day?.first_check_in_at ?? null,
    } satisfies TeamAttendanceRow;
  });
}

export async function correctDay(input: {
  readonly staffId: string;
  readonly attendanceDate: string;
  readonly correctionType: AttendanceCorrectionType;
  readonly reason: string;
  readonly details?: Record<string, unknown>;
}): Promise<AttendanceCorrectionResult> {
  const context = await getAttendanceAccessContext();
  if (!context) {
    throw new AttendanceError({
      code: "ATTENDANCE_UNAUTHORIZED",
      message: "Authentication or permission required.",
      httpStatus: 401,
    });
  }

  const canCorrect =
    context.canCorrectAllAttendance ||
    (context.canCorrectTeamAttendance &&
      input.staffId !== context.userId);

  if (!canCorrect) {
    throw new AttendanceError({
      code: "ATTENDANCE_MANAGER_SCOPE_DENIED",
      message: "Attendance action is outside authorized team scope.",
      httpStatus: 403,
    });
  }

  const supabase = await createClient();
  const { data, error } = await attendanceRpcClient(supabase).rpc("correct_attendance_day", {
    p_staff_id: input.staffId,
    p_attendance_date: input.attendanceDate,
    p_correction_type: input.correctionType,
    p_reason: input.reason.trim(),
    p_details: input.details ?? {},
  });

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message);
  }

  return mapAttendanceCorrectionRpcResult(
    data as unknown as Parameters<typeof mapAttendanceCorrectionRpcResult>[0]
  );
}
