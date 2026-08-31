/**
 * CRM 2D-2 — deterministic rule-based lead scoring (owner locks Q1, Q2, Q3).
 *
 * PURE derivation. No persistence, no snapshot, no history, no scheduler, no
 * AI/ML/external enrichment. The score is a total function of
 * `(CrmLeadScoreSignals, nowMs)` and is therefore reproducible from canonical
 * ONEDECORE data at any time.
 *
 * NON-DISCRIMINATION (hard rule, enforced by the shape of
 * `CrmLeadScoreSignals` and by certification tests): the score never reads a
 * name, email address, phone number, contact display name, locality, or any
 * free-text field. Locality in particular is a proxy for socio-economic and
 * community status and must never enter a sales priority ranking. No
 * protected-attribute column exists in the schema and CRM 2D adds none.
 *
 * Also excluded by owner lock: `budget_comfort_code`, `leads.estimate_snapshot`,
 * and every WhatsApp reply/inbound signal (blocked by the unresolved
 * conversation lead-link defect — see the CRM 2D design doc §P.1).
 */

import type { CrmCommercialState } from "./deal-value-contracts.ts";
import { CRM_COMMERCIAL_STATE_RANK } from "./deal-value-contracts.ts";
import type { LeadStageCode } from "./lead-stages.ts";

/* -------------------------------------------------------------------------- */
/* Bands (Q2)                                                                  */
/* -------------------------------------------------------------------------- */

export const CRM_LEAD_SCORE_BANDS = ["HOT", "WARM", "NURTURE", "COLD"] as const;
export type CrmLeadScoreBand = (typeof CRM_LEAD_SCORE_BANDS)[number];

export const CRM_LEAD_SCORE_BAND_MIN: Readonly<
  Record<CrmLeadScoreBand, number>
> = {
  HOT: 70,
  WARM: 45,
  NURTURE: 20,
  COLD: 0,
};

export const CRM_LEAD_SCORE_MIN = 0;
export const CRM_LEAD_SCORE_MAX = 100;

export function resolveScoreBand(score: number): CrmLeadScoreBand {
  if (score >= CRM_LEAD_SCORE_BAND_MIN.HOT) {
    return "HOT";
  }
  if (score >= CRM_LEAD_SCORE_BAND_MIN.WARM) {
    return "WARM";
  }
  if (score >= CRM_LEAD_SCORE_BAND_MIN.NURTURE) {
    return "NURTURE";
  }
  return "COLD";
}

/* -------------------------------------------------------------------------- */
/* Risk flags (Q3) — orthogonal, zero points, never alter the number           */
/* -------------------------------------------------------------------------- */

/**
 * Owner-locked risk vocabulary. Every flag is orthogonal to the priority score
 * and never alters it.
 *
 * `STALE` carries the owner-locked staleness threshold (see
 * `CRM_STALE_AFTER_HOURS`). It lives here rather than in `pipeline-contracts.ts`
 * so CRM 2B's deliberately unthresholded stage-age policy
 * (`pipelineStageAgeDays`) stays untouched — CRM 2D adds a sales-touch recency
 * rule, not a second stage-age rule.
 */
export const CRM_LEAD_RISK_FLAGS = [
  "SLA_BREACH",
  "OVERDUE_NEXT_ACTION",
  "NO_PRIMARY_NEXT_ACTION",
  "UNASSIGNED",
  "PARKED",
  "STALE",
] as const;

export type CrmLeadRiskFlag = (typeof CRM_LEAD_RISK_FLAGS)[number];

/** Every flag CRM 2D emits. */
export const CRM_LEAD_EMITTED_RISK_FLAGS = [
  "SLA_BREACH",
  "OVERDUE_NEXT_ACTION",
  "NO_PRIMARY_NEXT_ACTION",
  "UNASSIGNED",
  "STALE",
  "PARKED",
] as const satisfies readonly CrmLeadRiskFlag[];

export const CRM_LEAD_RISK_FLAG_LABELS: Readonly<
  Record<CrmLeadRiskFlag, string>
> = {
  SLA_BREACH: "SLA breach",
  OVERDUE_NEXT_ACTION: "Overdue",
  NO_PRIMARY_NEXT_ACTION: "No next action",
  UNASSIGNED: "Unassigned",
  PARKED: "Parked",
  STALE: "Stale",
};

/* -------------------------------------------------------------------------- */
/* Weights (Q3)                                                                */
/* -------------------------------------------------------------------------- */

/** Maturity from stage alone. Max 60. */
export const CRM_SCORE_MATURITY_POINTS: Readonly<
  Record<LeadStageCode, number>
> = {
  new: 0,
  assigned: 5,
  contacted: 15,
  qualified: 25,
  consultation_scheduled: 35,
  proposal_sent: 50,
  negotiation: 60,
  closed_won: 60,
  closed_lost: 0,
  on_hold: 0,
};

export const CRM_SCORE_MATURITY_MAX = 60;
export const CRM_SCORE_ENGAGEMENT_MAX = 40;

export const CRM_SCORE_ENGAGEMENT_POINTS = {
  FIRST_CONTACT_ATTEMPT: 5,
  MEANINGFUL_OUTCOME: 10,
  CONSULTATION_OR_SITE_VISIT: 10,
  LIVE_ISSUED_QUOTATION: 10,
  RECENT_MEANINGFUL_ACTIVITY: 5,
} as const;

/** Outcome codes that count as a meaningful contact result (Q3). */
export const CRM_SCORE_MEANINGFUL_OUTCOME_CODES = [
  "connected",
  "callback_requested",
] as const;

/** Recency window for the "recent meaningful activity" factor, in days. */
export const CRM_SCORE_RECENT_ACTIVITY_DAYS = 7;

/**
 * OWNER-LOCKED staleness threshold: 168 hours (7 x 24) without a meaningful
 * sales touch marks an active lead STALE.
 *
 * `latestMeaningfulSalesTouchAt` is MAX(completed non-`internal_task` activity
 * `completed_at`, lead note `created_at`, client-visible quotation event
 * `occurred_at`), falling back to the lead's receipt instant when none exists.
 *
 * This is a RISK FLAG ONLY. It never changes the priority score, the stage
 * probability, or the weighted value.
 */
export const CRM_STALE_AFTER_HOURS = 168;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/* -------------------------------------------------------------------------- */
/* Reasons                                                                     */
/* -------------------------------------------------------------------------- */

export const CRM_SCORE_REASON_CODES = [
  "MATURITY_STAGE",
  "FIRST_CONTACT_ATTEMPT",
  "MEANINGFUL_OUTCOME",
  "CONSULTATION_OR_SITE_VISIT",
  "LIVE_ISSUED_QUOTATION",
  "RECENT_MEANINGFUL_ACTIVITY",
  "TERMINAL_WON_OVERRIDE",
  "TERMINAL_LOST_OVERRIDE",
  "PARKED_OVERRIDE",
] as const;

export type CrmScoreReasonCode = (typeof CRM_SCORE_REASON_CODES)[number];

export interface CrmLeadScoreReason {
  readonly code: CrmScoreReasonCode;
  readonly label: string;
  /** Points contributed. An override reason states the final value it forced. */
  readonly points: number;
}

/* -------------------------------------------------------------------------- */
/* Signals — the ONLY inputs. Nothing sensitive may ever be added here.        */
/* -------------------------------------------------------------------------- */

export interface CrmLeadScoreSignals {
  readonly status: LeadStageCode;
  readonly isAssigned: boolean;
  /** `crm_sla_clocks.first_contact_attempt_at is not null`. */
  readonly hasFirstContactAttempt: boolean;
  /** A completed activity carrying `connected` or `callback_requested`. */
  readonly hasMeaningfulOutcome: boolean;
  /** A non-cancelled `consultation` / `site_visit` activity exists. */
  readonly hasConsultationOrSiteVisit: boolean;
  /** Commercial state from the canonical resolver. */
  readonly commercialState: CrmCommercialState;
  /** Most recent completed non-`internal_task` activity, ISO or null. */
  readonly lastMeaningfulActivityAt: string | null;
  /**
   * MAX(completed non-`internal_task` activity, lead note, client-visible
   * quotation event), ISO or null. Drives STALE only — never the score.
   */
  readonly latestMeaningfulSalesTouchAt: string | null;
  /** Lead receipt instant, the STALE fallback when no touch exists. */
  readonly receivedAt: string;
  /** An open primary next action exists. */
  readonly hasOpenPrimaryNextAction: boolean;
  /** Due instant of that primary, ISO or null. */
  readonly primaryNextActionDueAt: string | null;
  /** `crm_sla_clocks.sla_due_at` — null whenever no SLA policy is active. */
  readonly slaDueAt: string | null;
}

export interface CrmLeadScore {
  readonly priorityScore: number;
  readonly band: CrmLeadScoreBand;
  readonly reasons: readonly CrmLeadScoreReason[];
  readonly riskFlags: readonly CrmLeadRiskFlag[];
  readonly maturityPoints: number;
  readonly engagementPoints: number;
  /** False for closed_won, closed_lost and on_hold (Q2). */
  readonly isActivePriorityRankable: boolean;
  readonly computedAt: string;
  /** Honest disclosure of signals that could not be read. */
  readonly signalsAvailable: {
    readonly slaPolicyActive: boolean;
    readonly whatsappLinked: boolean;
  };
}

/* -------------------------------------------------------------------------- */
/* Derivation                                                                  */
/* -------------------------------------------------------------------------- */

function clampScore(value: number): number {
  if (value < CRM_LEAD_SCORE_MIN) {
    return CRM_LEAD_SCORE_MIN;
  }
  if (value > CRM_LEAD_SCORE_MAX) {
    return CRM_LEAD_SCORE_MAX;
  }
  return Math.round(value);
}

function deriveRiskFlags(
  signals: CrmLeadScoreSignals,
  nowMs: number
): readonly CrmLeadRiskFlag[] {
  const flags: CrmLeadRiskFlag[] = [];
  const isTerminal =
    signals.status === "closed_won" || signals.status === "closed_lost";

  if (isTerminal) {
    return flags;
  }

  const parked = signals.status === "on_hold";

  // SLA breach only exists when a policy actually produced a deadline.
  if (
    !parked &&
    signals.slaDueAt !== null &&
    !signals.hasFirstContactAttempt &&
    Date.parse(signals.slaDueAt) < nowMs
  ) {
    flags.push("SLA_BREACH");
  }

  if (
    signals.hasOpenPrimaryNextAction &&
    signals.primaryNextActionDueAt !== null &&
    Date.parse(signals.primaryNextActionDueAt) < nowMs
  ) {
    flags.push("OVERDUE_NEXT_ACTION");
  }

  // ON_HOLD_PRIMARY_RESERVED guarantees an on-hold lead already holds the
  // review activity as its primary, so the flag would always be noise there.
  if (!parked && signals.isAssigned && !signals.hasOpenPrimaryNextAction) {
    flags.push("NO_PRIMARY_NEXT_ACTION");
  }

  if (!parked && !signals.isAssigned) {
    flags.push("UNASSIGNED");
  }

  // Owner-locked STALE: active, non-parked leads only. Terminal leads already
  // returned above; on_hold is excluded because a parked lead is deliberately
  // not being worked.
  if (!parked) {
    const touchAt = signals.latestMeaningfulSalesTouchAt ?? signals.receivedAt;
    const touchMs = Date.parse(touchAt);
    if (
      !Number.isNaN(touchMs) &&
      nowMs - touchMs >= CRM_STALE_AFTER_HOURS * HOUR_MS
    ) {
      flags.push("STALE");
    }
  }

  if (parked) {
    flags.push("PARKED");
  }

  return flags;
}

/**
 * Deterministic, bounded, explainable. Identical inputs always produce an
 * identical result; `nowMs` is threaded in rather than read from the clock, so
 * server and client renders agree — the same discipline as
 * `sortPipelineCards(cards, now)`.
 */
export function deriveLeadScore(
  signals: CrmLeadScoreSignals,
  nowMs: number
): CrmLeadScore {
  const reasons: CrmLeadScoreReason[] = [];

  const maturityPoints = CRM_SCORE_MATURITY_POINTS[signals.status];
  if (maturityPoints > 0) {
    reasons.push({
      code: "MATURITY_STAGE",
      label: `Pipeline stage: ${signals.status.replace(/_/g, " ")}`,
      points: maturityPoints,
    });
  }

  let engagementPoints = 0;

  if (signals.hasFirstContactAttempt) {
    engagementPoints += CRM_SCORE_ENGAGEMENT_POINTS.FIRST_CONTACT_ATTEMPT;
    reasons.push({
      code: "FIRST_CONTACT_ATTEMPT",
      label: "First contact attempt recorded",
      points: CRM_SCORE_ENGAGEMENT_POINTS.FIRST_CONTACT_ATTEMPT,
    });
  }

  if (signals.hasMeaningfulOutcome) {
    engagementPoints += CRM_SCORE_ENGAGEMENT_POINTS.MEANINGFUL_OUTCOME;
    reasons.push({
      code: "MEANINGFUL_OUTCOME",
      label: "Reached the client (connected or callback requested)",
      points: CRM_SCORE_ENGAGEMENT_POINTS.MEANINGFUL_OUTCOME,
    });
  }

  if (signals.hasConsultationOrSiteVisit) {
    engagementPoints += CRM_SCORE_ENGAGEMENT_POINTS.CONSULTATION_OR_SITE_VISIT;
    reasons.push({
      code: "CONSULTATION_OR_SITE_VISIT",
      label: "Consultation or site visit on record",
      points: CRM_SCORE_ENGAGEMENT_POINTS.CONSULTATION_OR_SITE_VISIT,
    });
  }

  // A live issued grant is the canonical proof the client actually holds the
  // quotation — the same evidence the CRM 2C proposal_sent gate requires.
  if (
    CRM_COMMERCIAL_STATE_RANK[signals.commercialState] >=
    CRM_COMMERCIAL_STATE_RANK.issued
  ) {
    engagementPoints += CRM_SCORE_ENGAGEMENT_POINTS.LIVE_ISSUED_QUOTATION;
    reasons.push({
      code: "LIVE_ISSUED_QUOTATION",
      label: "Quotation issued to the client",
      points: CRM_SCORE_ENGAGEMENT_POINTS.LIVE_ISSUED_QUOTATION,
    });
  }

  if (signals.lastMeaningfulActivityAt !== null) {
    const lastMs = Date.parse(signals.lastMeaningfulActivityAt);
    if (
      !Number.isNaN(lastMs) &&
      nowMs - lastMs <= CRM_SCORE_RECENT_ACTIVITY_DAYS * DAY_MS &&
      lastMs <= nowMs
    ) {
      engagementPoints += CRM_SCORE_ENGAGEMENT_POINTS.RECENT_MEANINGFUL_ACTIVITY;
      reasons.push({
        code: "RECENT_MEANINGFUL_ACTIVITY",
        label: `Client-facing activity completed in the last ${CRM_SCORE_RECENT_ACTIVITY_DAYS} days`,
        points: CRM_SCORE_ENGAGEMENT_POINTS.RECENT_MEANINGFUL_ACTIVITY,
      });
    }
  }

  engagementPoints = Math.min(engagementPoints, CRM_SCORE_ENGAGEMENT_MAX);

  let priorityScore = clampScore(maturityPoints + engagementPoints);
  let isActivePriorityRankable = true;

  if (signals.status === "closed_won") {
    priorityScore = CRM_LEAD_SCORE_MAX;
    isActivePriorityRankable = false;
    reasons.push({
      code: "TERMINAL_WON_OVERRIDE",
      label: "Closed Won — score fixed at 100, excluded from active ranking",
      points: CRM_LEAD_SCORE_MAX,
    });
  } else if (signals.status === "closed_lost") {
    priorityScore = CRM_LEAD_SCORE_MIN;
    isActivePriorityRankable = false;
    reasons.push({
      code: "TERMINAL_LOST_OVERRIDE",
      label: "Closed Lost — score fixed at 0",
      points: CRM_LEAD_SCORE_MIN,
    });
  } else if (signals.status === "on_hold") {
    priorityScore = CRM_LEAD_SCORE_MIN;
    isActivePriorityRankable = false;
    reasons.push({
      code: "PARKED_OVERRIDE",
      label: "On hold — parked, excluded from active ranking",
      points: CRM_LEAD_SCORE_MIN,
    });
  }

  return {
    priorityScore,
    band: resolveScoreBand(priorityScore),
    reasons,
    riskFlags: deriveRiskFlags(signals, nowMs),
    maturityPoints,
    engagementPoints,
    isActivePriorityRankable,
    computedAt: new Date(nowMs).toISOString(),
    signalsAvailable: {
      slaPolicyActive: signals.slaDueAt !== null,
      // Blocked until whatsapp_conversations.lead_id gains a canonical writer.
      whatsappLinked: false,
    },
  };
}

export function formatScoreBandLabel(band: CrmLeadScoreBand): string {
  return band;
}
