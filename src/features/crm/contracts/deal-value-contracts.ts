/**
 * CRM 2D-2 — canonical deal value and weighted pipeline contracts
 * (owner locks Q4, Q5, Q7).
 *
 * Deal value is ALWAYS `taxable_base_paise` (ex-tax, INR) — the measure
 * `quotation_acceptances` credits to sales achievement and the measure
 * `sales_targets.revenue_target_paise` is denominated in. `grand_total_paise`
 * is nullable until a tax profile is applied and is deliberately never used.
 *
 * Weighted pipeline is a READ INTERPRETATION. Nothing here mutates a lead
 * stage, and probability is a function of stage alone — never of the score.
 */

import { formatInrFromPaise } from "./sales-target-contracts.ts";
import type { LeadStageCode } from "./lead-stages.ts";

/* -------------------------------------------------------------------------- */
/* Commercial state                                                            */
/* -------------------------------------------------------------------------- */

export const CRM_COMMERCIAL_STATES = [
  "unknown",
  "draft",
  "finalized",
  "issued",
  "accepted",
] as const;

export type CrmCommercialState = (typeof CRM_COMMERCIAL_STATES)[number];

export const CRM_COMMERCIAL_STATE_LABELS: Readonly<
  Record<CrmCommercialState, string>
> = {
  unknown: "No quotation",
  draft: "Draft",
  finalized: "Finalized",
  issued: "Issued to client",
  accepted: "Accepted",
};

/**
 * Precedence rank (Q4). Higher wins. Mirrors the CASE ladder inside
 * `private.crm_lead_deal_values` so the TypeScript and SQL orderings cannot
 * silently diverge.
 */
export const CRM_COMMERCIAL_STATE_RANK: Readonly<
  Record<CrmCommercialState, number>
> = {
  unknown: 0,
  draft: 1,
  finalized: 2,
  issued: 3,
  accepted: 4,
};

export interface CrmLeadCommercialState {
  readonly state: CrmCommercialState;
  readonly quotationId: string | null;
  readonly quotationNumber: string | null;
  readonly versionNumber: number | null;
  /** Ex-tax paise. `null` means UNKNOWN — never coerce to 0. */
  readonly taxableBasePaise: number | null;
  readonly at: string | null;
}

export const UNKNOWN_COMMERCIAL_STATE: CrmLeadCommercialState = {
  state: "unknown",
  quotationId: null,
  quotationNumber: null,
  versionNumber: null,
  taxableBasePaise: null,
  at: null,
};

/* -------------------------------------------------------------------------- */
/* Stage probability (Q5, Q7)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Basis points (1/100 of a percent) so every probability is an exact integer
 * and weighted arithmetic never touches a float. 6500 bp = 65%.
 *
 * This table is the TypeScript mirror of the CASE expression in
 * `20260831140000_crm_lead_commercial_read_models.sql`; a certification test
 * asserts the migration source carries the identical numbers.
 */
export const CRM_STAGE_PROBABILITY_BASIS_POINTS: Readonly<
  Record<LeadStageCode, number>
> = {
  new: 500,
  assigned: 1_000,
  contacted: 2_000,
  qualified: 3_500,
  consultation_scheduled: 5_000,
  proposal_sent: 6_500,
  negotiation: 8_000,
  closed_won: 10_000,
  closed_lost: 0,
  on_hold: 0,
};

/** Stages excluded from ACTIVE weighted-pipeline totals (Q5). */
export const CRM_PARKED_STAGES = ["on_hold"] as const;

export function isParkedStage(stage: LeadStageCode): boolean {
  return (CRM_PARKED_STAGES as readonly string[]).includes(stage);
}

export function stageProbabilityBasisPoints(stage: LeadStageCode): number {
  return CRM_STAGE_PROBABILITY_BASIS_POINTS[stage];
}

export function formatProbabilityLabel(basisPoints: number): string {
  return `${basisPoints / 100}%`;
}

/* -------------------------------------------------------------------------- */
/* Weighted value                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Integer-safe paise arithmetic: round per lead, then sum. Never sum-then-
 * multiply, so a card's displayed weighted value always adds up to its column
 * total. Unknown deal value stays unknown — it is NOT treated as zero.
 */
export function computeWeightedValuePaise(
  dealValuePaise: number | null,
  stage: LeadStageCode
): number | null {
  if (dealValuePaise === null || !Number.isFinite(dealValuePaise)) {
    return null;
  }
  const basisPoints = stageProbabilityBasisPoints(stage);
  return Math.round((dealValuePaise * basisPoints) / 10_000);
}

/** `null` renders as an explicit unknown string, never `₹0`. */
export function formatDealValue(paise: number | null): string {
  if (paise === null) {
    return "Value unknown";
  }
  return formatInrFromPaise(paise);
}

/** Compact Indian abbreviation for dense surfaces (column headers). */
export function formatCompactInrFromPaise(paise: number | null): string {
  if (paise === null) {
    return "Value unknown";
  }
  const rupees = paise / 100;
  if (rupees >= 10_000_000) {
    return `₹${(rupees / 10_000_000).toFixed(2)}Cr`;
  }
  if (rupees >= 100_000) {
    return `₹${(rupees / 100_000).toFixed(2)}L`;
  }
  if (rupees >= 1_000) {
    return `₹${(rupees / 1_000).toFixed(1)}K`;
  }
  return formatInrFromPaise(paise);
}

/* -------------------------------------------------------------------------- */
/* Pipeline value summary                                                      */
/* -------------------------------------------------------------------------- */

export interface CrmPipelineStageValue {
  readonly stage: LeadStageCode;
  readonly leadCount: number;
  /** Leads whose deal value is known. Never hidden behind the total. */
  readonly valuedLeadCount: number;
  readonly dealValuePaise: number;
  readonly weightedValuePaise: number;
  readonly probabilityBasisPoints: number;
}

export interface CrmPipelineValueSummary {
  readonly capturedAt: string;
  readonly scopeOwnerId: string | null;
  readonly isTeamScope: boolean;
  /** Active (non-parked, non-terminal) stages only. */
  readonly stages: readonly CrmPipelineStageValue[];
  readonly activeLeadCount: number;
  readonly activeValuedLeadCount: number;
  readonly activeDealValuePaise: number;
  readonly activeWeightedValuePaise: number;
  /** On Hold is reported separately and excluded from active totals (Q5). */
  readonly parkedLeadCount: number;
  readonly parkedValuedLeadCount: number;
  readonly parkedDealValuePaise: number;
}

export const EMPTY_PIPELINE_VALUE_SUMMARY: CrmPipelineValueSummary = {
  capturedAt: "",
  scopeOwnerId: null,
  isTeamScope: false,
  stages: [],
  activeLeadCount: 0,
  activeValuedLeadCount: 0,
  activeDealValuePaise: 0,
  activeWeightedValuePaise: 0,
  parkedLeadCount: 0,
  parkedValuedLeadCount: 0,
  parkedDealValuePaise: 0,
};
