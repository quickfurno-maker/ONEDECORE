/**
 * CRM — the "lead received month" cohort.
 *
 * A lead belongs to the month it was RECEIVED, in Asia/Kolkata, from
 * `public.leads.created_at`. Never `updated_at`: a lead must not jump from
 * August to September merely because someone edited it in September.
 *
 * This is COHORT reporting, not outcome reporting. A lead received in August and
 * lost in September stays in the August cohort and is counted there. Anything
 * that needs "lost during September" belongs in Reports, keyed on the actual
 * transition timestamp — the UI copy here says so out loud so the two are never
 * confused.
 *
 * Asia/Kolkata is a fixed +05:30 with no DST, so the boundary arithmetic is
 * exact and needs no timezone database.
 */

/** Asia/Kolkata is UTC+05:30 year-round. */
export const IST_OFFSET_MINUTES = 330;

const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60_000;

export const LEAD_MONTH_ALL = "all" as const;

/** `2026-09` or the literal `all`. */
export type LeadMonthParam = string;

export interface LeadMonthCohort {
  /** Canonical URL token: `YYYY-MM`, or `all`. */
  readonly param: LeadMonthParam;
  readonly isAllTime: boolean;
  /** Calendar year in IST. Null for all-time. */
  readonly year: number | null;
  /** 1-12 in IST. Null for all-time. */
  readonly month: number | null;
  /** Inclusive lower bound as a UTC ISO instant. Null for all-time. */
  readonly startIso: string | null;
  /** EXCLUSIVE upper bound as a UTC ISO instant. Null for all-time. */
  readonly endIso: string | null;
  /** "September 2026", or "All time". */
  readonly label: string;
}

const MONTH_RE = /^(\d{4})-(\d{2})$/;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Years outside this range are treated as malformed rather than trusted. */
const MIN_YEAR = 2000;
const MAX_YEAR = 2999;

/**
 * The UTC instant at which the given IST calendar month begins.
 *
 * `Date.UTC` normalizes overflow, so month 13 rolls into January of the next
 * year — which is exactly what the December -> January boundary needs.
 */
export function istMonthStartUtcMs(year: number, month: number): number {
  return Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS;
}

/** The IST calendar month containing the given instant. */
export function istYearMonth(nowMs: number): {
  readonly year: number;
  readonly month: number;
} {
  const shifted = new Date(nowMs + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
}

export function formatLeadMonthParam(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function formatLeadMonthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function buildCohort(year: number, month: number): LeadMonthCohort {
  const startMs = istMonthStartUtcMs(year, month);
  // Month + 1, normalized by Date.UTC — December rolls to the next January.
  const endMs = istMonthStartUtcMs(year, month + 1);
  return {
    param: formatLeadMonthParam(year, month),
    isAllTime: false,
    year,
    month,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    label: formatLeadMonthLabel(year, month),
  };
}

export const LEAD_MONTH_ALL_COHORT: LeadMonthCohort = {
  param: LEAD_MONTH_ALL,
  isAllTime: true,
  year: null,
  month: null,
  startIso: null,
  endIso: null,
  label: "All time",
};

/**
 * Parses the `month` URL parameter.
 *
 * Anything malformed — a bad shape, month 00 or 13, an implausible year —
 * falls back to the CURRENT IST month rather than erroring or silently widening
 * to all-time. A typo must not quietly turn a scoped view into a full-table read.
 */
export function parseLeadMonthParam(
  raw: string | undefined | null,
  nowMs: number = Date.now()
): LeadMonthCohort {
  const trimmed = (raw ?? "").trim().toLowerCase();

  if (trimmed === LEAD_MONTH_ALL) {
    return LEAD_MONTH_ALL_COHORT;
  }

  const match = MONTH_RE.exec(trimmed);
  if (match) {
    const year = Number.parseInt(match[1]!, 10);
    const month = Number.parseInt(match[2]!, 10);
    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      year >= MIN_YEAR &&
      year <= MAX_YEAR &&
      month >= 1 &&
      month <= 12
    ) {
      return buildCohort(year, month);
    }
  }

  const current = istYearMonth(nowMs);
  return buildCohort(current.year, current.month);
}

export function currentLeadMonthCohort(
  nowMs: number = Date.now()
): LeadMonthCohort {
  const current = istYearMonth(nowMs);
  return buildCohort(current.year, current.month);
}

/** The cohort `delta` calendar months away. Handles year boundaries. */
export function shiftLeadMonthCohort(
  cohort: LeadMonthCohort,
  delta: number
): LeadMonthCohort | null {
  if (cohort.isAllTime || cohort.year === null || cohort.month === null) {
    return null;
  }
  // Date.UTC normalizes month 0 -> December of the previous year and month 13
  // -> January of the next, so both boundaries fall out of the same call.
  const shifted = new Date(Date.UTC(cohort.year, cohort.month - 1 + delta, 1));
  return buildCohort(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1);
}

/**
 * Whether moving forward is meaningful: there is nothing to see in a month that
 * has not started yet in IST.
 */
export function canAdvanceLeadMonth(
  cohort: LeadMonthCohort,
  nowMs: number = Date.now()
): boolean {
  if (cohort.isAllTime || cohort.year === null || cohort.month === null) {
    return false;
  }
  const next = istMonthStartUtcMs(cohort.year, cohort.month + 1);
  return next <= nowMs;
}

/** Owner-facing copy that keeps cohort and outcome reporting distinct. */
export const LEAD_MONTH_SEMANTICS_NOTE =
  "Month groups leads by when they were received (Asia/Kolkata), not by when they were won or lost.";

export function leadMonthCohortHeading(cohort: LeadMonthCohort): string {
  return cohort.isAllTime
    ? "Leads received — all time"
    : `Leads received in ${cohort.label}`;
}
