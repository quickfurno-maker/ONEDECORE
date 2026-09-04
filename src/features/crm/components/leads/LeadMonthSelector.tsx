import Link from "next/link";
import {
  buildLeadListHref,
  type LeadListQuery,
} from "../../contracts/lead-list-query.ts";
import {
  LEAD_MONTH_ALL,
  LEAD_MONTH_SEMANTICS_NOTE,
  canAdvanceLeadMonth,
  currentLeadMonthCohort,
  shiftLeadMonthCohort,
} from "../../contracts/lead-month-cohort.ts";

/**
 * Received-month navigation.
 *
 * The copy says "received" out loud, and the note below spells out that this is
 * a COHORT view. A lead received in August and lost in September is still an
 * August lead here — labelling that count "lost in August" would be false, and
 * outcome-period reporting belongs in Reports against the real transition
 * timestamp.
 *
 * Forward navigation is hidden once the next month has not begun in IST: there
 * is nothing to look at in a month that has not started.
 */

interface LeadMonthSelectorProps {
  readonly query: LeadListQuery;
  /**
   * REQUIRED, and supplied by the page from the read model's `capturedAt`.
   *
   * Reading the clock during render would make the component impure and could
   * let the strip's counts and this selector's idea of "now" disagree across a
   * month boundary. One server-captured instant drives the whole render.
   */
  readonly nowMs: number;
}

export function LeadMonthSelector({ query, nowMs }: LeadMonthSelectorProps) {
  const now = nowMs;
  const cohort = query.month;

  const previous = shiftLeadMonthCohort(cohort, -1);
  const next = shiftLeadMonthCohort(cohort, 1);
  const current = currentLeadMonthCohort(now);
  const canAdvance = next !== null && canAdvanceLeadMonth(cohort, now);

  // Changing the month resets to page 1: a different cohort is a different
  // result set, and page 4 of August is meaningless in September.
  const hrefFor = (month: string) =>
    buildLeadListHref(query, undefined, { month, page: 1 });

  const navButton =
    "inline-flex min-h-9 min-w-9 items-center justify-center rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 text-[13px] font-medium text-[var(--crm-text-secondary)] transition hover:border-[var(--crm-border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)]";

  return (
    <section
      aria-label="Lead received month"
      className="crm-surface rounded-[14px] p-3"
      data-testid="crm-lead-month-selector"
      data-month={cohort.param}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium text-[var(--crm-muted)]">
          Received
        </span>

        {previous ? (
          <Link
            href={hrefFor(previous.param)}
            className={navButton}
            data-testid="crm-month-previous"
            aria-label={`Previous month: ${previous.label}`}
          >
            <span aria-hidden>‹</span>
          </Link>
        ) : null}

        <span
          className="inline-flex min-h-9 items-center rounded-[10px] border border-[var(--crm-primary)] bg-[var(--crm-primary-soft)] px-3 text-[13px] font-semibold text-[var(--crm-primary)]"
          data-testid="crm-month-current"
        >
          {cohort.label}
        </span>

        {canAdvance && next ? (
          <Link
            href={hrefFor(next.param)}
            className={navButton}
            data-testid="crm-month-next"
            aria-label={`Next month: ${next.label}`}
          >
            <span aria-hidden>›</span>
          </Link>
        ) : null}

        {cohort.param === current.param ? null : (
          <Link
            href={hrefFor(current.param)}
            className={navButton}
            data-testid="crm-month-this-month"
          >
            This month
          </Link>
        )}

        <Link
          href={hrefFor(cohort.isAllTime ? current.param : LEAD_MONTH_ALL)}
          className={
            cohort.isAllTime
              ? "inline-flex min-h-9 items-center rounded-[10px] border border-[var(--crm-primary)] bg-[var(--crm-primary-soft)] px-3 text-[13px] font-semibold text-[var(--crm-primary)]"
              : navButton
          }
          data-testid="crm-month-all-time"
          aria-pressed={cohort.isAllTime}
        >
          All time
        </Link>
      </div>

      <p className="mt-2 text-[11px] text-[var(--crm-muted)]">
        {LEAD_MONTH_SEMANTICS_NOTE}
      </p>
    </section>
  );
}
