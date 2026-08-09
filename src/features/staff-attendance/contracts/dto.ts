export const ATTENDANCE_BUSINESS_TIMEZONE = "Asia/Kolkata";

export const ATTENDANCE_PRIMARY_STATUSES = [
  "present",
  "absent",
  "half_day",
  "leave",
  "weekly_off",
  "holiday",
] as const;

export type AttendancePrimaryStatus = (typeof ATTENDANCE_PRIMARY_STATUSES)[number];

export const ATTENDANCE_LOCATION_CATEGORIES = [
  "office",
  "field",
  "client_site",
] as const;

export type AttendanceLocationCategory = (typeof ATTENDANCE_LOCATION_CATEGORIES)[number];

export const ATTENDANCE_CORRECTION_TYPES = [
  "set_primary_status",
  "clear_missing_checkout",
  "adjust_worked_minutes",
  "void_open_session",
] as const;

export type AttendanceCorrectionType = (typeof ATTENDANCE_CORRECTION_TYPES)[number];

export interface AttendanceToday {
  readonly attendanceDate: string;
  readonly primaryStatus: AttendancePrimaryStatus;
  readonly openSession: boolean;
  readonly firstCheckInAt: string | null;
  readonly lastCheckOutAt: string | null;
  readonly workedMinutesSoFar: number;
  readonly isLate: boolean;
  readonly isEarlyCheckout: boolean;
  readonly isMissingCheckout: boolean;
  readonly hasManualAdjustment: boolean;
}

export interface AttendanceDaySummary {
  readonly attendanceDate: string;
  readonly primaryStatus: AttendancePrimaryStatus;
  readonly firstCheckInAt: string | null;
  readonly lastCheckOutAt: string | null;
  readonly workedMinutes: number;
  readonly isLate: boolean;
  readonly isEarlyCheckout: boolean;
  readonly isMissingCheckout: boolean;
  readonly hasManualAdjustment: boolean;
  readonly openSession: boolean;
  readonly eventCount: number;
}

export interface AttendanceMonthTotals {
  readonly presentDays: number;
  readonly absentDays: number;
  readonly leaveDays: number;
  readonly halfDays: number;
  readonly lateCount: number;
  readonly earlyCheckoutCount: number;
  readonly missingCheckoutCount: number;
  readonly workedMinutes: number;
}

export interface AttendanceMonthSummary {
  readonly year: number;
  readonly month: number;
  readonly days: readonly AttendanceDaySummary[];
  readonly totals: AttendanceMonthTotals;
}

export interface TeamAttendanceRow {
  readonly staffId: string;
  readonly displayName: string;
  readonly todayStatus: AttendancePrimaryStatus | "unknown";
  readonly isLate: boolean;
  readonly isEarlyCheckout: boolean;
  readonly isMissingCheckout: boolean;
  readonly openSession: boolean;
  readonly lastCheckInAt: string | null;
}

export interface AttendanceCheckMutationResult {
  readonly staffId: string;
  readonly attendanceDate: string;
  readonly primaryStatus: AttendancePrimaryStatus;
  readonly eventId: string;
  readonly openSession: boolean;
  readonly idempotentReplay: boolean;
  readonly occurredAt: string;
}

export interface AttendanceCorrectionResult {
  readonly correctionId: string;
  readonly staffId: string;
  readonly attendanceDate: string;
  readonly primaryStatus: AttendancePrimaryStatus;
}

export interface PublishAttendancePolicyInput {
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
  readonly workdayStartLocal: string;
  readonly workdayEndLocal: string;
  readonly lateGraceMinutes: number;
  readonly halfDayThresholdMinutes: number;
  readonly missingCheckoutCutoffLocal: string;
  readonly weeklyOffDays: readonly number[];
  readonly locationRequired: boolean;
  readonly supersedesPolicyId?: string | null;
}

export interface PublishAttendancePolicyResult {
  readonly policyId: string;
  readonly code: string;
}

export interface SetCurrentAttendancePolicyResult {
  readonly policyId: string;
  readonly isCurrent: true;
}

export interface AttendanceDayRow {
  readonly staff_id: string;
  readonly attendance_date: string;
  readonly primary_status: string;
  readonly first_check_in_at: string | null;
  readonly last_check_out_at: string | null;
  readonly worked_minutes: number;
  readonly is_late: boolean;
  readonly is_early_checkout: boolean;
  readonly is_missing_checkout: boolean;
  readonly has_manual_adjustment: boolean;
  readonly open_session: boolean;
}

export interface AttendanceCheckRpcResult {
  readonly staffId: string;
  readonly attendanceDate: string;
  readonly primaryStatus: string;
  readonly eventId: string;
  readonly openSession: boolean;
  readonly idempotentReplay: boolean;
  readonly occurredAt: string;
}

export interface AttendanceCorrectionRpcResult {
  readonly correctionId: string;
  readonly staffId: string;
  readonly attendanceDate: string;
  readonly primaryStatus: string;
}

export function isAttendancePrimaryStatus(value: string): value is AttendancePrimaryStatus {
  return (ATTENDANCE_PRIMARY_STATUSES as readonly string[]).includes(value);
}

export function isAttendanceLocationCategory(
  value: string
): value is AttendanceLocationCategory {
  return (ATTENDANCE_LOCATION_CATEGORIES as readonly string[]).includes(value);
}

export function isAttendanceCorrectionType(value: string): value is AttendanceCorrectionType {
  return (ATTENDANCE_CORRECTION_TYPES as readonly string[]).includes(value);
}

/** Resolves the business calendar date in Asia/Kolkata. */
export function resolveAttendanceBusinessDate(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export function roundAttendanceCoordinate(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value * 1000) / 1000;
}

export function mapAttendanceDayRowToToday(
  row: AttendanceDayRow | null,
  attendanceDate: string
): AttendanceToday {
  if (!row) {
    return {
      attendanceDate,
      primaryStatus: "absent",
      openSession: false,
      firstCheckInAt: null,
      lastCheckOutAt: null,
      workedMinutesSoFar: 0,
      isLate: false,
      isEarlyCheckout: false,
      isMissingCheckout: false,
      hasManualAdjustment: false,
    };
  }

  return {
    attendanceDate: row.attendance_date,
    primaryStatus: isAttendancePrimaryStatus(row.primary_status)
      ? row.primary_status
      : "absent",
    openSession: row.open_session,
    firstCheckInAt: row.first_check_in_at,
    lastCheckOutAt: row.last_check_out_at,
    workedMinutesSoFar: row.worked_minutes,
    isLate: row.is_late,
    isEarlyCheckout: row.is_early_checkout,
    isMissingCheckout: row.is_missing_checkout,
    hasManualAdjustment: row.has_manual_adjustment,
  };
}

export function mapAttendanceDayRowToSummary(
  row: AttendanceDayRow,
  eventCount = 0
): AttendanceDaySummary {
  return {
    attendanceDate: row.attendance_date,
    primaryStatus: isAttendancePrimaryStatus(row.primary_status)
      ? row.primary_status
      : "absent",
    firstCheckInAt: row.first_check_in_at,
    lastCheckOutAt: row.last_check_out_at,
    workedMinutes: row.worked_minutes,
    isLate: row.is_late,
    isEarlyCheckout: row.is_early_checkout,
    isMissingCheckout: row.is_missing_checkout,
    hasManualAdjustment: row.has_manual_adjustment,
    openSession: row.open_session,
    eventCount,
  };
}

export function aggregateAttendanceMonthTotals(
  days: readonly AttendanceDaySummary[]
): AttendanceMonthTotals {
  return days.reduce<AttendanceMonthTotals>(
    (totals, day) => ({
      presentDays: totals.presentDays + (day.primaryStatus === "present" ? 1 : 0),
      absentDays: totals.absentDays + (day.primaryStatus === "absent" ? 1 : 0),
      leaveDays: totals.leaveDays + (day.primaryStatus === "leave" ? 1 : 0),
      halfDays: totals.halfDays + (day.primaryStatus === "half_day" ? 1 : 0),
      lateCount: totals.lateCount + (day.isLate ? 1 : 0),
      earlyCheckoutCount: totals.earlyCheckoutCount + (day.isEarlyCheckout ? 1 : 0),
      missingCheckoutCount: totals.missingCheckoutCount + (day.isMissingCheckout ? 1 : 0),
      workedMinutes: totals.workedMinutes + day.workedMinutes,
    }),
    {
      presentDays: 0,
      absentDays: 0,
      leaveDays: 0,
      halfDays: 0,
      lateCount: 0,
      earlyCheckoutCount: 0,
      missingCheckoutCount: 0,
      workedMinutes: 0,
    }
  );
}

export function mapAttendanceCheckRpcResult(
  payload: AttendanceCheckRpcResult
): AttendanceCheckMutationResult {
  return {
    staffId: payload.staffId,
    attendanceDate: payload.attendanceDate,
    primaryStatus: isAttendancePrimaryStatus(payload.primaryStatus)
      ? payload.primaryStatus
      : "absent",
    eventId: payload.eventId,
    openSession: payload.openSession,
    idempotentReplay: payload.idempotentReplay,
    occurredAt: payload.occurredAt,
  };
}

export function mapAttendanceCorrectionRpcResult(
  payload: AttendanceCorrectionRpcResult
): AttendanceCorrectionResult {
  return {
    correctionId: payload.correctionId,
    staffId: payload.staffId,
    attendanceDate: payload.attendanceDate,
    primaryStatus: isAttendancePrimaryStatus(payload.primaryStatus)
      ? payload.primaryStatus
      : "absent",
  };
}

export function monthDateRange(year: number, month: number): {
  readonly startDate: string;
  readonly endDate: string;
} {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  return { startDate, endDate };
}
