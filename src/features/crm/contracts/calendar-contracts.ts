/**
 * CRM 2B-1 — internal CRM activity calendar contracts.
 *
 * Physical source of truth remains `lead_follow_ups` (CRM 2A). This module adds
 * no new activity model: it only derives bounded Asia/Kolkata display ranges and
 * pure reschedule targets for the audited `reschedule_lead_activity` authority.
 *
 * All range math is done on fixed-offset local-day arithmetic so results are
 * deterministic regardless of the host machine timezone. Asia/Kolkata has had a
 * constant UTC+05:30 offset with no DST since 1945, so a fixed offset is exact.
 */

import type { LeadStageCode } from "./lead-stages.ts";
import { REPORT_TIMEZONE } from "./reporting-contracts.ts";

export const CRM_CALENDAR_TIMEZONE = REPORT_TIMEZONE;

/** Asia/Kolkata is a fixed UTC+05:30 offset (no DST). */
export const CRM_CALENDAR_UTC_OFFSET_MINUTES = 330;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const OFFSET_MS = CRM_CALENDAR_UTC_OFFSET_MINUTES * MINUTE_MS;

export const CRM_CALENDAR_VIEWS = ["day", "week", "month"] as const;
export type CrmCalendarView = (typeof CRM_CALENDAR_VIEWS)[number];

export const CRM_CALENDAR_DEFAULT_VIEW: CrmCalendarView = "week";

/** Hard ceiling on a single bounded calendar range read. */
export const CRM_CALENDAR_EVENT_LIMIT = 400;

/** Day view time grid bounds (local hours). */
export const CRM_CALENDAR_DAY_START_HOUR = 7;
export const CRM_CALENDAR_DAY_END_HOUR = 21;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface CrmCalendarEvent {
  readonly activityId: string;
  readonly leadId: string;
  readonly leadDisplayLabel: string;
  readonly leadStatus: LeadStageCode;
  readonly ownerId: string;
  readonly ownerLabel: string | null;
  readonly activityType: string;
  readonly title: string;
  readonly priority: string;
  readonly dueAt: string;
  readonly durationMinutes: number | null;
  readonly isPrimaryNextAction: boolean;
}

export interface CrmCalendarRange {
  readonly view: CrmCalendarView;
  /** Anchor local date (`YYYY-MM-DD`, Asia/Kolkata). */
  readonly anchorDate: string;
  /** First local date of the labelled period. */
  readonly periodStartDate: string;
  /** Last local date of the labelled period (inclusive). */
  readonly periodEndDate: string;
  /** First local date actually rendered (month grid overshoots the period). */
  readonly visibleStartDate: string;
  /** Last local date actually rendered (inclusive). */
  readonly visibleEndDate: string;
  /** Inclusive UTC instant for the first rendered local day. */
  readonly startUtc: string;
  /** Exclusive UTC instant one local day past `visibleEndDate`. */
  readonly endUtc: string;
  /** Every rendered local date, ascending. */
  readonly days: readonly string[];
}

export interface CrmCalendarSnapshot {
  readonly range: CrmCalendarRange;
  readonly events: readonly CrmCalendarEvent[];
  readonly truncated: boolean;
  readonly scopeOwnerId: string | null;
  readonly isTeamScope: boolean;
  /** Server-resolved IST "today" — keeps render pure and hydration stable. */
  readonly todayLocalDate: string;
  readonly capturedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Local-day primitives                                                        */
/* -------------------------------------------------------------------------- */

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function isCalendarLocalDate(value: string): boolean {
  if (!LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }
  return localDateToDayIndex(value) !== null;
}

/** Days since the local epoch for a `YYYY-MM-DD` string, or null when invalid. */
function localDateToDayIndex(localDate: string): number | null {
  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  const day = Number(localDate.slice(8, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const ms = Date.UTC(year, month - 1, day);
  if (Number.isNaN(ms)) {
    return null;
  }
  // Reject overflow such as 2026-02-31 normalizing into March.
  const round = new Date(ms);
  if (
    round.getUTCFullYear() !== year ||
    round.getUTCMonth() !== month - 1 ||
    round.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.round(ms / DAY_MS);
}

function dayIndexToLocalDate(dayIndex: number): string {
  const date = new Date(dayIndex * DAY_MS);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;
}

function requireDayIndex(localDate: string): number {
  const index = localDateToDayIndex(localDate);
  if (index === null) {
    throw new RangeError(`Invalid calendar local date: ${localDate}`);
  }
  return index;
}

/** Converts an absolute instant to its Asia/Kolkata local date. */
export function calendarLocalDate(value: string | number | Date): string {
  const ms =
    typeof value === "number"
      ? value
      : value instanceof Date
        ? value.getTime()
        : Date.parse(value);
  if (Number.isNaN(ms)) {
    return "";
  }
  return dayIndexToLocalDate(Math.floor((ms + OFFSET_MS) / DAY_MS));
}

/** Local hour (0–23) of an absolute instant in Asia/Kolkata. */
export function calendarLocalHour(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return 0;
  }
  const dayMs = (((ms + OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  return Math.floor(dayMs / 3_600_000);
}

/** Local minute (0–59) of an absolute instant in Asia/Kolkata. */
export function calendarLocalMinute(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return 0;
  }
  const dayMs = (((ms + OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  return Math.floor((dayMs % 3_600_000) / MINUTE_MS);
}

/** Absolute UTC instant for local midnight of `localDate`. */
export function calendarLocalDayStartUtc(localDate: string): string {
  return new Date(requireDayIndex(localDate) * DAY_MS - OFFSET_MS).toISOString();
}

/** Absolute UTC instant for a local wall-clock time on `localDate`. */
export function calendarLocalTimeToUtc(
  localDate: string,
  hour: number,
  minute: number
): string {
  const base = requireDayIndex(localDate) * DAY_MS;
  const ms = base + hour * 3_600_000 + minute * MINUTE_MS - OFFSET_MS;
  return new Date(ms).toISOString();
}

export function addCalendarDays(localDate: string, days: number): string {
  return dayIndexToLocalDate(requireDayIndex(localDate) + days);
}

/** 0 = Monday … 6 = Sunday. Weeks start Monday for sales-week scanning. */
export function calendarWeekdayIndex(localDate: string): number {
  const dow = new Date(requireDayIndex(localDate) * DAY_MS).getUTCDay();
  return (dow + 6) % 7;
}

export function calendarStartOfWeek(localDate: string): string {
  return addCalendarDays(localDate, -calendarWeekdayIndex(localDate));
}

export function calendarStartOfMonth(localDate: string): string {
  return `${localDate.slice(0, 7)}-01`;
}

export function calendarEndOfMonth(localDate: string): string {
  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  const nextMonthFirst =
    month === 12 ? `${year + 1}-01-01` : `${year}-${pad2(month + 1)}-01`;
  return addCalendarDays(nextMonthFirst, -1);
}

/* -------------------------------------------------------------------------- */
/* Range resolution                                                            */
/* -------------------------------------------------------------------------- */

export function parseCalendarView(
  raw: string | string[] | undefined
): CrmCalendarView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && (CRM_CALENDAR_VIEWS as readonly string[]).includes(value)) {
    return value as CrmCalendarView;
  }
  return CRM_CALENDAR_DEFAULT_VIEW;
}

export function parseCalendarAnchorDate(
  raw: string | string[] | undefined,
  now: string | number | Date = Date.now()
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && isCalendarLocalDate(value.trim())) {
    return value.trim();
  }
  return calendarLocalDate(now);
}

export function resolveCalendarRange(
  view: CrmCalendarView,
  anchorDate: string
): CrmCalendarRange {
  requireDayIndex(anchorDate);

  let periodStartDate: string;
  let periodEndDate: string;
  let visibleStartDate: string;
  let visibleEndDate: string;

  if (view === "day") {
    periodStartDate = anchorDate;
    periodEndDate = anchorDate;
    visibleStartDate = anchorDate;
    visibleEndDate = anchorDate;
  } else if (view === "week") {
    periodStartDate = calendarStartOfWeek(anchorDate);
    periodEndDate = addCalendarDays(periodStartDate, 6);
    visibleStartDate = periodStartDate;
    visibleEndDate = periodEndDate;
  } else {
    periodStartDate = calendarStartOfMonth(anchorDate);
    periodEndDate = calendarEndOfMonth(anchorDate);
    // The month grid renders whole Monday-start weeks, so the fetched range is
    // exactly what is on screen — no unbounded look-around.
    visibleStartDate = calendarStartOfWeek(periodStartDate);
    visibleEndDate = addCalendarDays(
      calendarStartOfWeek(periodEndDate),
      6
    );
  }

  const startIndex = requireDayIndex(visibleStartDate);
  const endIndex = requireDayIndex(visibleEndDate);
  const days: string[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    days.push(dayIndexToLocalDate(index));
  }

  return {
    view,
    anchorDate,
    periodStartDate,
    periodEndDate,
    visibleStartDate,
    visibleEndDate,
    startUtc: calendarLocalDayStartUtc(visibleStartDate),
    endUtc: calendarLocalDayStartUtc(addCalendarDays(visibleEndDate, 1)),
    days,
  };
}

export function shiftCalendarAnchor(
  view: CrmCalendarView,
  anchorDate: string,
  direction: -1 | 1
): string {
  if (view === "day") {
    return addCalendarDays(anchorDate, direction);
  }
  if (view === "week") {
    return addCalendarDays(anchorDate, direction * 7);
  }
  const start = calendarStartOfMonth(anchorDate);
  return direction === 1
    ? addCalendarDays(calendarEndOfMonth(start), 1)
    : addCalendarDays(start, -1);
}

export function buildCalendarHref(
  view: CrmCalendarView,
  anchorDate: string,
  ownerId?: string | null
): string {
  const params = new URLSearchParams();
  params.set("view", view);
  params.set("date", anchorDate);
  if (ownerId) {
    params.set("owner", ownerId);
  }
  return `/admin/crm/calendar?${params.toString()}`;
}

/* -------------------------------------------------------------------------- */
/* Display formatting (Asia/Kolkata)                                           */
/* -------------------------------------------------------------------------- */

function localDateToNoonInstant(localDate: string): Date {
  // Noon local avoids any month/day rollover when formatting through Intl.
  return new Date(Date.parse(calendarLocalTimeToUtc(localDate, 12, 0)));
}

export function formatCalendarTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: CRM_CALENDAR_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatCalendarTimestampLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: CRM_CALENDAR_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatCalendarDayLabel(localDate: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: CRM_CALENDAR_TIMEZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(localDateToNoonInstant(localDate));
}

export function formatCalendarDayNumber(localDate: string): string {
  return String(Number(localDate.slice(8, 10)));
}

export function formatCalendarHourLabel(hour: number): string {
  const suffix = hour < 12 ? "am" : "pm";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

export function formatCalendarRangeTitle(range: CrmCalendarRange): string {
  const start = localDateToNoonInstant(range.periodStartDate);
  const end = localDateToNoonInstant(range.periodEndDate);

  if (range.view === "day") {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: CRM_CALENDAR_TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(start);
  }

  if (range.view === "month") {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: CRM_CALENDAR_TIMEZONE,
      month: "long",
      year: "numeric",
    }).format(start);
  }

  const sameMonth = range.periodStartDate.slice(0, 7) === range.periodEndDate.slice(0, 7);
  const startLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: CRM_CALENDAR_TIMEZONE,
    day: "numeric",
    ...(sameMonth ? {} : { month: "short" }),
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: CRM_CALENDAR_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(end);

  return `${startLabel} – ${endLabel}`;
}

/* -------------------------------------------------------------------------- */
/* Event grouping + reschedule targets                                         */
/* -------------------------------------------------------------------------- */

export function groupCalendarEventsByLocalDate(
  events: readonly CrmCalendarEvent[]
): Readonly<Record<string, readonly CrmCalendarEvent[]>> {
  const buckets: Record<string, CrmCalendarEvent[]> = {};
  for (const event of events) {
    const key = calendarLocalDate(event.dueAt);
    if (!key) {
      continue;
    }
    (buckets[key] ??= []).push(event);
  }
  for (const key of Object.keys(buckets)) {
    buckets[key]!.sort(compareCalendarEvents);
  }
  return buckets;
}

export function compareCalendarEvents(
  left: CrmCalendarEvent,
  right: CrmCalendarEvent
): number {
  const delta = Date.parse(left.dueAt) - Date.parse(right.dueAt);
  if (delta !== 0) {
    return delta;
  }
  if (left.isPrimaryNextAction !== right.isPrimaryNextAction) {
    return left.isPrimaryNextAction ? -1 : 1;
  }
  return left.activityId.localeCompare(right.activityId);
}

export type CalendarRescheduleTarget =
  | { readonly ok: true; readonly dueAt: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Pure reschedule target for a calendar drop or day-cell action.
 *
 * Preserves the activity's existing local time-of-day unless the drop supplies
 * an explicit hour. Mirrors the `ACTIVITY_DUE_MUST_BE_FUTURE` guard enforced by
 * `private.reschedule_lead_activity_impl` so a doomed drag fails before it is
 * ever sent; the RPC remains the authority.
 */
export function resolveCalendarRescheduleTarget(input: {
  readonly currentDueAt: string;
  readonly targetLocalDate: string;
  readonly targetHour?: number | null;
  readonly now?: number;
}): CalendarRescheduleTarget {
  const currentMs = Date.parse(input.currentDueAt);
  if (Number.isNaN(currentMs)) {
    return { ok: false, reason: "This activity has an invalid due time." };
  }
  if (!isCalendarLocalDate(input.targetLocalDate)) {
    return { ok: false, reason: "Pick a valid date." };
  }

  const hour =
    input.targetHour == null
      ? calendarLocalHour(input.currentDueAt)
      : input.targetHour;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { ok: false, reason: "Pick a valid time." };
  }
  const minute = input.targetHour == null ? calendarLocalMinute(input.currentDueAt) : 0;

  const dueAt = calendarLocalTimeToUtc(input.targetLocalDate, hour, minute);
  const dueMs = Date.parse(dueAt);
  const now = input.now ?? Date.now();

  if (dueMs === currentMs) {
    return { ok: false, reason: "Activity is already scheduled for that slot." };
  }
  if (dueMs <= now) {
    return {
      ok: false,
      reason: "Activities can only be rescheduled to a future time.",
    };
  }

  return { ok: true, dueAt };
}
