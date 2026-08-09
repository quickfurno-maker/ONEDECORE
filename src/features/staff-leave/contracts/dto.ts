export const LEAVE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;

export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

export const LEAVE_HALF_DAY_PARTS = ["am", "pm"] as const;

export type LeaveHalfDayPart = (typeof LEAVE_HALF_DAY_PARTS)[number];

export interface LeaveRequestSummary {
  readonly id: string;
  readonly typeName: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly range: string;
  readonly status: LeaveRequestStatus;
  readonly halfDayPart: LeaveHalfDayPart | null;
  readonly reason: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export interface LeaveRequestDetail extends LeaveRequestSummary {
  readonly staffId: string;
  readonly leaveTypeId: string;
  readonly reviewedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HolidaySummary {
  readonly id: string;
  readonly holidayDate: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface CreateLeaveRequestInput {
  readonly leaveTypeId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: string;
  readonly halfDayPart?: LeaveHalfDayPart | null;
}

export interface LeaveMutationResult {
  readonly requestId: string;
  readonly status: LeaveRequestStatus;
}

export interface HolidayMutationResult {
  readonly holidayId: string;
  readonly holidayDate?: string;
  readonly isActive?: boolean;
}

export interface LeaveRequestRow {
  readonly id: string;
  readonly staff_id: string;
  readonly leave_type_id: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly half_day_part: string | null;
  readonly reason: string;
  readonly status: string;
  readonly reviewed_by: string | null;
  readonly reviewed_at: string | null;
  readonly review_note: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly leave_types?: { display_name: string } | null;
}

export interface HolidayRow {
  readonly id: string;
  readonly holiday_date: string;
  readonly name: string;
  readonly is_active: boolean;
}

export function isLeaveRequestStatus(value: string): value is LeaveRequestStatus {
  return (LEAVE_REQUEST_STATUSES as readonly string[]).includes(value);
}

export function isLeaveHalfDayPart(value: string): value is LeaveHalfDayPart {
  return (LEAVE_HALF_DAY_PARTS as readonly string[]).includes(value);
}

export function formatLeaveDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return startDate;
  }
  return `${startDate} – ${endDate}`;
}

export function mapLeaveRequestRowToSummary(row: LeaveRequestRow): LeaveRequestSummary {
  return {
    id: row.id,
    typeName: row.leave_types?.display_name ?? "Leave",
    startDate: row.start_date,
    endDate: row.end_date,
    range: formatLeaveDateRange(row.start_date, row.end_date),
    status: isLeaveRequestStatus(row.status) ? row.status : "pending",
    halfDayPart: row.half_day_part && isLeaveHalfDayPart(row.half_day_part)
      ? row.half_day_part
      : null,
    reason: row.reason,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
  };
}

export function mapLeaveRequestRowToDetail(row: LeaveRequestRow): LeaveRequestDetail {
  return {
    ...mapLeaveRequestRowToSummary(row),
    staffId: row.staff_id,
    leaveTypeId: row.leave_type_id,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapHolidayRowToSummary(row: HolidayRow): HolidaySummary {
  return {
    id: row.id,
    holidayDate: row.holiday_date,
    name: row.name,
    isActive: row.is_active,
  };
}

export function mapLeaveMutationRpcResult(payload: {
  readonly requestId: string;
  readonly status: string;
}): LeaveMutationResult {
  return {
    requestId: payload.requestId,
    status: isLeaveRequestStatus(payload.status) ? payload.status : "pending",
  };
}

export function mapHolidayMutationRpcResult(payload: {
  readonly holidayId: string;
  readonly holidayDate?: string;
  readonly isActive?: boolean;
}): HolidayMutationResult {
  return {
    holidayId: payload.holidayId,
    holidayDate: payload.holidayDate,
    isActive: payload.isActive,
  };
}
