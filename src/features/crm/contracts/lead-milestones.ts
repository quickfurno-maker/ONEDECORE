/**
 * CRM — SITE VISIT and QUOTATION as milestone facts of their own.
 *
 * These are NOT buckets and NOT stages. The owner lock is explicit: a lead can
 * be HOT with a completed site visit and an issued quotation, and another can be
 * LOST with exactly the same two milestones. They may feed the canonical score
 * as input signals where the architecture already uses them, but they never
 * become the lead's sales bucket.
 *
 * Both are derived from canonical sources only:
 *   site visit  <- public.lead_follow_ups where activity_type = 'site_visit'
 *   quotation   <- the canonical commercial state already read for deal value
 *
 * The site-visit state is NEVER inferred from the `consultation_scheduled`
 * pipeline stage: that stage is a different fact, it can be reached without any
 * site visit existing, and reading it here would quietly turn one milestone into
 * a proxy for another.
 */

import {
  CRM_COMMERCIAL_STATE_LABELS,
  type CrmCommercialState,
} from "./deal-value-contracts.ts";

/**
 * `lead_follow_ups.status` is the canonical vocabulary and has exactly three
 * values: open, completed, cancelled. `scheduled` here means "an OPEN
 * site_visit activity exists" — it is a display name for that canonical status,
 * not a fourth stored value. `none` means no site-visit activity exists at all.
 */
export const CRM_SITE_VISIT_STATES = [
  "none",
  "scheduled",
  "completed",
  "cancelled",
] as const;

export type CrmSiteVisitState = (typeof CRM_SITE_VISIT_STATES)[number];

export const CRM_SITE_VISIT_STATE_LABELS: Readonly<
  Record<CrmSiteVisitState, string>
> = {
  none: "None",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * Resolves one lead's site-visit milestone from its site_visit activities.
 *
 * Precedence is completed > scheduled(open) > cancelled > none: a lead that has
 * already been visited reads as visited even if a later visit was cancelled,
 * and an upcoming visit outranks an abandoned one.
 */
export function resolveSiteVisitState(counts: {
  readonly completed: number;
  readonly open: number;
  readonly cancelled: number;
}): CrmSiteVisitState {
  if (counts.completed > 0) {
    return "completed";
  }
  if (counts.open > 0) {
    return "scheduled";
  }
  if (counts.cancelled > 0) {
    return "cancelled";
  }
  return "none";
}

/** The canonical quotation labels — no second quotation state model. */
export const CRM_LEAD_QUOTATION_STATE_LABELS = CRM_COMMERCIAL_STATE_LABELS;

export type CrmLeadQuotationState = CrmCommercialState;

/**
 * Compact list label. `unknown` means no quotation exists for the lead, which
 * reads better as "None" in a dense milestone column than "No quotation".
 */
export function formatLeadQuotationState(state: CrmLeadQuotationState): string {
  return state === "unknown" ? "None" : CRM_COMMERCIAL_STATE_LABELS[state];
}
