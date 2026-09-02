/**
 * Workforce V1 — attendance submission & approval domain contracts.
 *
 * Pure and framework-free on purpose. The web admin/staff UI and the future
 * Android staff app must agree on exactly these categories, states, credit
 * values and quota rules, so nothing here may depend on React, Next.js, the
 * DOM, or browser-only state. Authorization and validation stay server-side;
 * this module is the shared vocabulary, not a security boundary.
 */

/** Attendance business timezone. All day boundaries are Asia/Kolkata. */
export const WORKFORCE_TIMEZONE = "Asia/Kolkata";

/**
 * Final attendance categories. ABSENT is admin-only — staff can never mark
 * themselves absent as a shortcut.
 */
export const WORKFORCE_FINAL_CATEGORIES = [
  "ABSENT",
  "WEEKLY_OFF",
  "HALF_DAY_4H",
  "FULL_DAY_8H",
  "FULL_DAY_12H",
] as const;

export type WorkforceFinalCategory = (typeof WORKFORCE_FINAL_CATEGORIES)[number];

/** Categories a staff member may submit for themselves. */
export const WORKFORCE_SUBMITTABLE_CATEGORIES = [
  "WEEKLY_OFF",
  "HALF_DAY_4H",
  "FULL_DAY_8H",
  "FULL_DAY_12H",
] as const;

export type WorkforceSubmittableCategory =
  (typeof WORKFORCE_SUBMITTABLE_CATEGORIES)[number];

export const WORKFORCE_LIFECYCLE_STATES = [
  "NOT_STARTED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "SUBMITTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CORRECTION_REQUIRED",
] as const;

export type WorkforceLifecycleState = (typeof WORKFORCE_LIFECYCLE_STATES)[number];

/** Maximum ACTIVE (pending + approved) Weekly Off days per employee per month. */
export const WORKFORCE_WEEKLY_OFF_MONTHLY_CAP = 4;

/** Credited minutes per final category. Mirrors the database mapping exactly. */
const CREDITED_MINUTES: Record<WorkforceFinalCategory, number> = {
  ABSENT: 0,
  WEEKLY_OFF: 0,
  HALF_DAY_4H: 240,
  FULL_DAY_8H: 480,
  FULL_DAY_12H: 720,
};

export function workforceCreditedMinutes(
  category: WorkforceFinalCategory
): number {
  return CREDITED_MINUTES[category];
}

export function isWorkforceFinalCategory(
  value: string
): value is WorkforceFinalCategory {
  return (WORKFORCE_FINAL_CATEGORIES as readonly string[]).includes(value);
}

export function isWorkforceSubmittableCategory(
  value: string
): value is WorkforceSubmittableCategory {
  return (WORKFORCE_SUBMITTABLE_CATEGORIES as readonly string[]).includes(value);
}

export function isWorkforceLifecycleState(
  value: string
): value is WorkforceLifecycleState {
  return (WORKFORCE_LIFECYCLE_STATES as readonly string[]).includes(value);
}

/** Human labels for the staff and admin surfaces. */
export const WORKFORCE_CATEGORY_LABELS: Record<WorkforceFinalCategory, string> = {
  ABSENT: "Absent",
  WEEKLY_OFF: "Weekly Off",
  HALF_DAY_4H: "Half Day — 4H",
  FULL_DAY_8H: "Full Day — 8H",
  FULL_DAY_12H: "Full Day — 12H",
};

export const WORKFORCE_STATE_LABELS: Record<WorkforceLifecycleState, string> = {
  NOT_STARTED: "Not started",
  CHECKED_IN: "Checked in",
  CHECKED_OUT: "Checked out",
  SUBMITTED: "Submitted",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CORRECTION_REQUIRED: "Correction required",
};

/** Only APPROVED attendance is final, official and payroll-valid. */
export function isPayrollValid(state: WorkforceLifecycleState): boolean {
  return state === "APPROVED";
}

/**
 * A day that closed without a valid submission is UNRESOLVED, never silently
 * absent. Only a Super Admin decision turns it into a final category.
 */
export function isUnresolved(
  state: WorkforceLifecycleState,
  attendanceDate: string,
  todayBusinessDate: string
): boolean {
  if (state === "APPROVED") {
    return false;
  }
  return attendanceDate < todayBusinessDate;
}

export const WORKFORCE_EXCEPTION_FLAGS = [
  "LATE",
  "MISSING_CHECK_IN",
  "MISSING_CHECK_OUT",
  "VERY_SHORT_ATTENDANCE",
  "WEEKLY_OFF_QUOTA_ISSUE",
  "UNAPPROVED",
  "MANUALLY_EDITED",
  "MISSING_ATTENDANCE",
] as const;

export type WorkforceExceptionFlag = (typeof WORKFORCE_EXCEPTION_FLAGS)[number];

export const WORKFORCE_EXCEPTION_LABELS: Record<WorkforceExceptionFlag, string> = {
  LATE: "Late",
  MISSING_CHECK_IN: "Missing Check-In",
  MISSING_CHECK_OUT: "Missing Check-Out",
  VERY_SHORT_ATTENDANCE: "Very Short Attendance",
  WEEKLY_OFF_QUOTA_ISSUE: "Weekly Off quota issue",
  UNAPPROVED: "Unapproved",
  MANUALLY_EDITED: "Manually Edited",
  MISSING_ATTENDANCE: "Missing attendance",
};

/**
 * Lateness against the official start, in the policy timezone.
 *
 * `lateMinutes` counts from the official start (09:16 -> 16), so the number
 * always answers "how late against the official start". `isLate` only becomes
 * true past the grace window, so 09:15 is on time and 09:16 is late.
 *
 * Lateness is EVIDENCE. It never downgrades an attendance category.
 */
export interface WorkforceLateEvidence {
  readonly lateMinutes: number;
  readonly isLate: boolean;
}

/**
 * Mirrors `private.workforce_compute_late`. Times are local wall-clock minutes
 * from midnight in the policy timezone, so this stays pure and testable.
 */
export function computeLateEvidence(input: {
  readonly checkInMinutesFromMidnight: number | null;
  readonly officialStartMinutesFromMidnight: number;
  readonly graceMinutes: number;
}): WorkforceLateEvidence {
  if (input.checkInMinutesFromMidnight == null) {
    return { lateMinutes: 0, isLate: false };
  }
  const lateMinutes = Math.max(
    0,
    input.checkInMinutesFromMidnight - input.officialStartMinutesFromMidnight
  );
  return { lateMinutes, isLate: lateMinutes > input.graceMinutes };
}

/** Remaining Weekly Off allowance for the month. Never negative. */
export function weeklyOffRemaining(activeCount: number): number {
  return Math.max(0, WORKFORCE_WEEKLY_OFF_MONTHLY_CAP - activeCount);
}

export function canSubmitWeeklyOff(activeCount: number): boolean {
  return activeCount < WORKFORCE_WEEKLY_OFF_MONTHLY_CAP;
}

export interface WorkforceSubmissionRow {
  readonly staffId: string;
  readonly attendanceDate: string;
  readonly lifecycleState: WorkforceLifecycleState;
  readonly submittedCategory: WorkforceSubmittableCategory | null;
  readonly finalCategory: WorkforceFinalCategory | null;
  readonly creditedMinutes: number | null;
  readonly lateMinutes: number;
  readonly isLate: boolean;
  readonly reviewNote: string | null;
  readonly reviewedAt: string | null;
}

export interface WorkforceApprovalInboxRow extends WorkforceSubmissionRow {
  readonly employeeName: string;
  readonly employeeCode: string | null;
  readonly inTime: string | null;
  readonly outTime: string | null;
  readonly elapsedMinutes: number | null;
  readonly exceptionFlags: readonly WorkforceExceptionFlag[];
}

export interface WorkforceMonthlySummary {
  readonly staffId: string;
  readonly monthStart: string;
  readonly monthEnd: string;
  readonly absentCount: number;
  readonly weeklyOffCount: number;
  readonly halfDay4hCount: number;
  readonly fullDay8hCount: number;
  readonly fullDay12hCount: number;
  readonly lateDayCount: number;
  readonly creditedMinutes: number;
  readonly approvedDayCount: number;
  readonly weeklyOffRemaining: number;
  readonly unresolvedCount: number;
}

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A row that is straightforward enough for "Approve Selected": it carries a
 * submitted category and no exception that needs a human decision. Bulk
 * approval never bypasses validation — the server still re-checks the Weekly
 * Off quota and every other rule on each row.
 */
export function isBulkApprovable(row: WorkforceApprovalInboxRow): boolean {
  if (row.lifecycleState !== "PENDING_APPROVAL") {
    return false;
  }
  if (row.submittedCategory == null) {
    return false;
  }
  const blocking: readonly WorkforceExceptionFlag[] = [
    "MISSING_CHECK_IN",
    "MISSING_CHECK_OUT",
    "VERY_SHORT_ATTENDANCE",
    "WEEKLY_OFF_QUOTA_ISSUE",
    "MANUALLY_EDITED",
    "MISSING_ATTENDANCE",
  ];
  return !row.exceptionFlags.some((flag) => blocking.includes(flag));
}

export function mapApprovalInboxRow(raw: Record<string, unknown>): WorkforceApprovalInboxRow {
  const state = asString(raw.lifecycle_state);
  const submitted = raw.submitted_category == null ? null : asString(raw.submitted_category);
  const final = raw.final_category == null ? null : asString(raw.final_category);
  const flags = Array.isArray(raw.exception_flags) ? raw.exception_flags : [];

  return {
    staffId: asString(raw.staff_id),
    attendanceDate: asString(raw.attendance_date),
    lifecycleState: isWorkforceLifecycleState(state) ? state : "NOT_STARTED",
    submittedCategory:
      submitted && isWorkforceSubmittableCategory(submitted) ? submitted : null,
    finalCategory: final && isWorkforceFinalCategory(final) ? final : null,
    creditedMinutes: asNullableNumber(raw.credited_minutes),
    lateMinutes: asNumber(raw.late_minutes),
    isLate: raw.is_late === true,
    reviewNote: raw.review_note == null ? null : asString(raw.review_note),
    reviewedAt: raw.reviewed_at == null ? null : asString(raw.reviewed_at),
    employeeName: asString(raw.employee_name),
    employeeCode: raw.employee_code == null ? null : asString(raw.employee_code),
    inTime: raw.in_time == null ? null : asString(raw.in_time),
    outTime: raw.out_time == null ? null : asString(raw.out_time),
    elapsedMinutes: asNullableNumber(raw.elapsed_minutes),
    exceptionFlags: flags
      .map((flag) => asString(flag))
      .filter((flag): flag is WorkforceExceptionFlag =>
        (WORKFORCE_EXCEPTION_FLAGS as readonly string[]).includes(flag)
      ),
  };
}

export function mapMonthlySummary(raw: Record<string, unknown>): WorkforceMonthlySummary {
  return {
    staffId: asString(raw.staffId),
    monthStart: asString(raw.monthStart),
    monthEnd: asString(raw.monthEnd),
    absentCount: asNumber(raw.absentCount),
    weeklyOffCount: asNumber(raw.weeklyOffCount),
    halfDay4hCount: asNumber(raw.halfDay4hCount),
    fullDay8hCount: asNumber(raw.fullDay8hCount),
    fullDay12hCount: asNumber(raw.fullDay12hCount),
    lateDayCount: asNumber(raw.lateDayCount),
    creditedMinutes: asNumber(raw.creditedMinutes),
    approvedDayCount: asNumber(raw.approvedDayCount),
    weeklyOffRemaining: asNumber(raw.weeklyOffRemaining),
    unresolvedCount: asNumber(raw.unresolvedCount),
  };
}

/** Maps a raw `attendance_submissions` row into the shared submission shape. */
export function mapSubmissionRow(raw: Record<string, unknown>): WorkforceSubmissionRow {
  const state = asString(raw.lifecycle_state);
  const submitted = raw.submitted_category == null ? null : asString(raw.submitted_category);
  const final = raw.final_category == null ? null : asString(raw.final_category);

  return {
    staffId: asString(raw.staff_id),
    attendanceDate: asString(raw.attendance_date),
    lifecycleState: isWorkforceLifecycleState(state) ? state : "NOT_STARTED",
    submittedCategory:
      submitted && isWorkforceSubmittableCategory(submitted) ? submitted : null,
    finalCategory: final && isWorkforceFinalCategory(final) ? final : null,
    creditedMinutes: asNullableNumber(raw.credited_minutes),
    lateMinutes: asNumber(raw.late_minutes),
    isLate: raw.is_late === true,
    reviewNote: raw.review_note == null ? null : asString(raw.review_note),
    reviewedAt: raw.reviewed_at == null ? null : asString(raw.reviewed_at),
  };
}

/** `YYYY-MM-DD` bounds of the calendar month containing `date`. */
export function monthBounds(date: string): {
  readonly monthStart: string;
  readonly monthEnd: string;
} {
  const [year, month] = date.split("-").map((part) => Number(part));
  const safeYear = Number.isFinite(year) ? year : new Date().getUTCFullYear();
  const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : 1;
  const lastDay = new Date(Date.UTC(safeYear, safeMonth, 0)).getUTCDate();
  const mm = String(safeMonth).padStart(2, "0");
  return {
    monthStart: `${safeYear}-${mm}-01`,
    monthEnd: `${safeYear}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Human duration for elapsed/credited minutes. */
export function formatMinutes(minutes: number | null): string {
  if (minutes == null) {
    return "—";
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
}
