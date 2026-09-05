/**
 * Owner dashboard summary — the contract behind the mobile home screen.
 *
 * The Owner app's first screen answers four questions before anything is
 * tapped: how many leads came in today, this week and this month; what is on
 * the calendar today; how the team is attending; and where the modules are.
 * The first two are CRM, and this file owns their definitions.
 *
 * WHY THE DEFINITIONS LIVE HERE. "This week" is the kind of fact that looks
 * trivial and is not. A phone computing it would need the Asia/Kolkata offset,
 * a Monday convention and a half-open bound, and it would drift from the web
 * workspace the first time any of the three was written slightly differently.
 * There is one definition, on the server, and the client renders the number.
 *
 * EVERY WINDOW IS HALF-OPEN, [start, end). A lead created at exactly midnight
 * IST belongs to the new day, and to exactly one of them — a closed upper
 * bound would double-count it, which is precisely the sort of error nobody
 * notices until a total disagrees with the sum of its parts.
 */

import {
  addCalendarDays,
  calendarLocalDate,
  calendarLocalDayStartUtc,
  calendarStartOfMonth,
  calendarStartOfWeek,
} from "./calendar-contracts.ts";

/**
 * What counts as an appointment on the dashboard.
 *
 * A consultation and a site visit are the two activities where a CLIENT has
 * agreed to be somewhere at a time. That is what an owner glancing at
 * "Today's Appointments" is asking about.
 *
 * The other four activity types are deliberately excluded. A call and a
 * WhatsApp message are outreach the owner controls and can move; a quotation
 * follow-up is a task about a document; an `internal_task` involves no client
 * at all. Counting any of them here would inflate the number an owner plans
 * their day around.
 *
 * This is NOT `CRM_CLIENT_FACING_ACTIVITY_TYPES`, which is a different question
 * — whether a completion note records something the client said — and includes
 * calls for exactly that reason. The pairing here mirrors the one the score
 * engine already treats as a unit: `hasConsultationOrSiteVisit`.
 */
export const CRM_APPOINTMENT_ACTIVITY_TYPES = [
  "consultation",
  "site_visit",
] as const;

export type CrmAppointmentActivityType =
  (typeof CRM_APPOINTMENT_ACTIVITY_TYPES)[number];

export function isAppointmentActivityType(
  activityType: string
): activityType is CrmAppointmentActivityType {
  return (CRM_APPOINTMENT_ACTIVITY_TYPES as readonly string[]).includes(
    activityType
  );
}

/** Owner-facing labels for the two appointment types. */
export const CRM_APPOINTMENT_LABELS: Readonly<
  Record<CrmAppointmentActivityType, string>
> = {
  consultation: "Consultation",
  site_visit: "Site Visit",
};

/* -------------------------------------------------------------------------- */
/* Windows                                                                     */
/* -------------------------------------------------------------------------- */

/** A half-open [startIso, endIso) range of absolute instants. */
export interface CrmDashboardWindow {
  readonly startIso: string;
  readonly endIso: string;
}

export interface CrmDashboardWindows {
  /** `YYYY-MM-DD` in Asia/Kolkata — the day the whole summary describes. */
  readonly localDate: string;
  readonly today: CrmDashboardWindow;
  readonly thisWeek: CrmDashboardWindow;
  readonly thisMonth: CrmDashboardWindow;
}

/**
 * The three received-lead windows, resolved from ONE instant.
 *
 * Taking a single `nowIso` matters: resolving each window from its own
 * `Date.now()` would let a request that straddles midnight report a "today"
 * and a "this week" that disagree about which day it is. Every boundary below
 * is derived from the same local date.
 *
 * The week starts MONDAY, from `calendarWeekdayIndex` — the convention the CRM
 * calendar already scans sales weeks with. It is not re-decided here.
 */
export function resolveCrmDashboardWindows(
  nowIso: string
): CrmDashboardWindows {
  const localDate = calendarLocalDate(nowIso);

  const weekStart = calendarStartOfWeek(localDate);
  const monthStart = calendarStartOfMonth(localDate);

  return {
    localDate,
    today: {
      startIso: calendarLocalDayStartUtc(localDate),
      endIso: calendarLocalDayStartUtc(addCalendarDays(localDate, 1)),
    },
    thisWeek: {
      startIso: calendarLocalDayStartUtc(weekStart),
      endIso: calendarLocalDayStartUtc(addCalendarDays(weekStart, 7)),
    },
    thisMonth: {
      startIso: calendarLocalDayStartUtc(monthStart),
      /*
       * The first of NEXT month, reached by adding a day to this month's last
       * day rather than by incrementing a month number — which would have to
       * know about December.
       */
      endIso: calendarLocalDayStartUtc(nextMonthStart(monthStart)),
    },
  };
}

function nextMonthStart(monthStart: string): string {
  const year = Number(monthStart.slice(0, 4));
  const month = Number(monthStart.slice(5, 7));

  return month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/* -------------------------------------------------------------------------- */
/* Response                                                                    */
/* -------------------------------------------------------------------------- */

export interface CrmDashboardLeadCounts {
  readonly today: number;
  readonly thisWeek: number;
  readonly thisMonth: number;
}

export interface CrmDashboardNextAppointment {
  readonly activityId: string;
  readonly leadId: string;
  readonly leadDisplayLabel: string;
  readonly activityType: CrmAppointmentActivityType;
  /** "Consultation" / "Site Visit" — resolved here so the phone does not map. */
  readonly activityLabel: string;
  readonly title: string;
  readonly dueAt: string;
}

export interface CrmDashboardAppointments {
  /** Every non-cancelled appointment scheduled inside today, IST. */
  readonly totalToday: number;
  /** Open, and still ahead of `capturedAt`. */
  readonly upcoming: number;
  /**
   * Open, and already past `capturedAt`. These are the ones that need
   * attention: the time came and nothing was recorded against them.
   */
  readonly pending: number;
  /** The earliest upcoming one, or null when the day has none left. */
  readonly next: CrmDashboardNextAppointment | null;
}

export interface CrmDashboardSummary {
  readonly capturedAt: string;
  readonly localDate: string;
  readonly leads: CrmDashboardLeadCounts;
  readonly appointments: CrmDashboardAppointments;
}
