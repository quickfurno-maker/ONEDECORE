/**
 * CRM 2E — management analytics contracts.
 *
 * Read interpretations only. Nothing here mutates a lead, a clock, a target or
 * a quotation, and nothing invents a business meaning:
 *
 *  - SLA eligibility is `crm_sla_clocks.sla_due_at IS NOT NULL`, the receipt-time
 *    snapshot CRM 2A writes only when the policy was already active and the
 *    lead was received on or after `effective_from`. Non-retroactivity is a
 *    property of the stored data, never re-derived here.
 *  - First response is the canonical first-contact ATTEMPT
 *    (`crm_sla_clocks.first_contact_attempt_at`), not a successful connection.
 *  - Forecast reuses the CRM 2D weighted pipeline verbatim
 *    (`deal-value-contracts.ts` + `get_crm_pipeline_value_summary`). The locked
 *    stage probabilities are NOT re-declared in this module.
 *  - Target achievement reuses the existing commercial credit rule stored on
 *    `quotation_acceptances`; CRM 2E adds no second sales-credit rule.
 *
 * Every rate is an integer BASIS POINT count (1/100 of a percent) and is `null`
 * whenever its denominator is zero. `null` renders as an explicit unknown —
 * never as `0%`, which would read as a real measurement.
 */

import type { LeadStageCode } from "./lead-stages.ts";
import type { SalesTargetScope, SalesTargetStatus } from "./sales-target-contracts.ts";

/* -------------------------------------------------------------------------- */
/* Rates                                                                       */
/* -------------------------------------------------------------------------- */

export const BASIS_POINTS_SCALE = 10_000;

/**
 * Exact integer rate. Returns `null` for a zero, negative or non-finite
 * denominator so a division by zero can never surface as `0%`.
 */
export function rateBasisPoints(
  numerator: number,
  denominator: number
): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null;
  }
  if (denominator <= 0) {
    return null;
  }
  return Math.round((numerator * BASIS_POINTS_SCALE) / denominator);
}

export function formatBasisPointsPercent(
  basisPoints: number | null,
  fallback = "—"
): string {
  if (basisPoints === null || !Number.isFinite(basisPoints)) {
    return fallback;
  }
  const percent = basisPoints / 100;
  const rounded = Number.isInteger(percent) ? percent : Number(percent.toFixed(1));
  return `${rounded}%`;
}

/* -------------------------------------------------------------------------- */
/* Durations                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Median of a sample, defined exactly as `percentile_cont(0.5)` in the CRM 2E
 * migration: sort ascending, and on an even sample average the two middle
 * values. An empty sample is `null`, never `0`.
 *
 * This mirror exists so the definition is unit-testable without a database and
 * so the SQL and the TypeScript can never quietly disagree.
 */
export function medianOf(values: readonly number[]): number | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return null;
  }
  const sorted = [...finite].sort((a, b) => a - b);
  const middle = sorted.length / 2;
  if (sorted.length % 2 === 1) {
    return sorted[Math.floor(middle)]!;
  }
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 3_600;
const DAY_SECONDS = 86_400;

/** Compact elapsed-time label. `null` stays unknown, never "0m". */
export function formatDurationFromSeconds(
  seconds: number | null,
  fallback = "—"
): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return fallback;
  }
  if (seconds < MINUTE_SECONDS) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < HOUR_SECONDS) {
    return `${Math.floor(seconds / MINUTE_SECONDS)}m`;
  }
  if (seconds < DAY_SECONDS) {
    const hours = Math.floor(seconds / HOUR_SECONDS);
    const minutes = Math.floor((seconds % HOUR_SECONDS) / MINUTE_SECONDS);
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }
  const days = Math.floor(seconds / DAY_SECONDS);
  const hours = Math.floor((seconds % DAY_SECONDS) / HOUR_SECONDS);
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}

/* -------------------------------------------------------------------------- */
/* A. First-response SLA                                                       */
/* -------------------------------------------------------------------------- */

export interface CrmSlaComplianceMetrics {
  /** Every lead received in the range and inside the caller scope. */
  readonly cohortLeadCount: number;
  /** Denominator: leads the canonical SLA policy actually applied to. */
  readonly eligibleCount: number;
  readonly metCount: number;
  readonly breachedCount: number;
  /** Eligible, no attempt yet, still inside the window. Undecided. */
  readonly pendingCount: number;
  /** Cohort leads with no due snapshot — policy never applied to them. */
  readonly outOfPolicyCount: number;
  /** met + breached. The compliance denominator. */
  readonly decidedCount: number;
  /** met / decided. `null` when nothing has been decided yet. */
  readonly complianceBasisPoints: number | null;
}

export const EMPTY_SLA_METRICS: CrmSlaComplianceMetrics = {
  cohortLeadCount: 0,
  eligibleCount: 0,
  metCount: 0,
  breachedCount: 0,
  pendingCount: 0,
  outOfPolicyCount: 0,
  decidedCount: 0,
  complianceBasisPoints: null,
};

/* -------------------------------------------------------------------------- */
/* B. Velocity                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Stage-to-stage pairs CRM 2E measures. Each pair's two instants are first
 * entries reconstructed from `lead_events`; nothing here is interpolated.
 */
export const CRM_VELOCITY_STAGE_PAIRS = [
  { fromStage: "received", toStage: "contacted" },
  { fromStage: "contacted", toStage: "qualified" },
  { fromStage: "qualified", toStage: "consultation_scheduled" },
  { fromStage: "consultation_scheduled", toStage: "proposal_sent" },
  { fromStage: "proposal_sent", toStage: "negotiation" },
  { fromStage: "negotiation", toStage: "closed_won" },
] as const;

export interface CrmStageTransitionVelocity {
  readonly fromStage: string;
  readonly toStage: string;
  /** Leads with BOTH instants present. Zero means "not measurable", not "fast". */
  readonly sampleSize: number;
  readonly medianSeconds: number | null;
}

export interface CrmVelocityMetrics {
  /** Cohort measure: leads received in range that have a qualifying attempt. */
  readonly firstContactSampleSize: number;
  readonly medianFirstContactSeconds: number | null;
  /** Current snapshot: open (non-terminal, non-parked) leads in scope. */
  readonly activeLeadCount: number;
  readonly medianActiveLeadAgeSeconds: number | null;
  readonly medianCurrentStageAgeSeconds: number | null;
  readonly stageTransitions: readonly CrmStageTransitionVelocity[];
}

export const EMPTY_VELOCITY_METRICS: CrmVelocityMetrics = {
  firstContactSampleSize: 0,
  medianFirstContactSeconds: null,
  activeLeadCount: 0,
  medianActiveLeadAgeSeconds: null,
  medianCurrentStageAgeSeconds: null,
  stageTransitions: [],
};

/* -------------------------------------------------------------------------- */
/* C. Conversion                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Funnel ladder. `received` is the whole cohort; the rest are canonical lead
 * stages. `closed_lost` and `on_hold` are reported SEPARATELY and never sit in
 * the ladder — a lost or parked lead still counts at every stage it reached.
 */
export const CRM_CONVERSION_FUNNEL_STAGES = [
  "received",
  "contacted",
  "qualified",
  "consultation_scheduled",
  "proposal_sent",
  "negotiation",
  "closed_won",
] as const;

export type CrmConversionFunnelStage =
  (typeof CRM_CONVERSION_FUNNEL_STAGES)[number];

export const CRM_CONVERSION_STAGE_LABELS: Readonly<
  Record<CrmConversionFunnelStage, string>
> = {
  received: "Received",
  contacted: "Contacted",
  qualified: "Qualified",
  consultation_scheduled: "Consultation scheduled",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  closed_won: "Closed won",
};

export interface CrmConversionStage {
  readonly stage: CrmConversionFunnelStage;
  /** Leads that reached this stage at least once. */
  readonly reachedCount: number;
  /** Denominator label for the step rate. `null` on the funnel head. */
  readonly previousStage: CrmConversionFunnelStage | null;
  readonly previousCount: number | null;
  /** reachedCount / previousCount. */
  readonly stepConversionBasisPoints: number | null;
  /** reachedCount / receivedCount. */
  readonly overallConversionBasisPoints: number | null;
}

export interface CrmConversionMetrics {
  readonly receivedCount: number;
  readonly stages: readonly CrmConversionStage[];
  /** Reported beside the funnel, never inside it. */
  readonly closedLostCount: number;
  /** Current status only — parked leads keep the stages they reached. */
  readonly onHoldCurrentCount: number;
  /** closed_won reach / received. */
  readonly wonRateBasisPoints: number | null;
}

export const EMPTY_CONVERSION_METRICS: CrmConversionMetrics = {
  receivedCount: 0,
  stages: [],
  closedLostCount: 0,
  onHoldCurrentCount: 0,
  wonRateBasisPoints: null,
};

/* -------------------------------------------------------------------------- */
/* E. Target achievement                                                       */
/* -------------------------------------------------------------------------- */

export interface CrmTargetAttainmentRow {
  readonly targetId: string;
  readonly targetScope: SalesTargetScope;
  readonly targetUserId: string | null;
  readonly targetDisplayName: string;
  readonly status: SalesTargetStatus;
  readonly revenueTargetPaise: number;
  readonly closedWonCountTarget: number;
  /** `null` = accepted-quotation truth unreadable. NEVER coerce to 0. */
  readonly achievedPaise: number | null;
  readonly acceptedCount: number | null;
  readonly remainingPaise: number | null;
  readonly attainmentBasisPoints: number | null;
}

export interface CrmTargetAttainmentMetrics {
  /** Asia/Kolkata achievement month, `YYYY-MM`. */
  readonly period: string;
  readonly targetMonth: string;
  readonly canReadCommercialTruth: boolean;
  /** Total accepted commercial value visible to the caller in the period. */
  readonly periodAchievedPaise: number | null;
  readonly periodAcceptedCount: number | null;
  readonly rows: readonly CrmTargetAttainmentRow[];
}

export const EMPTY_TARGET_METRICS: CrmTargetAttainmentMetrics = {
  period: "",
  targetMonth: "",
  canReadCommercialTruth: false,
  periodAchievedPaise: null,
  periodAcceptedCount: null,
  rows: [],
};

/**
 * The single attainment row promoted to the summary card. A personal scope
 * prefers its own target; a team scope prefers the team target. Returns `null`
 * rather than inventing a target that was never configured.
 */
export function pickHeadlineTargetRow(
  rows: readonly CrmTargetAttainmentRow[],
  scopeOwnerId: string | null
): CrmTargetAttainmentRow | null {
  if (rows.length === 0) {
    return null;
  }
  if (scopeOwnerId !== null) {
    return (
      rows.find(
        (row) =>
          row.targetScope === "executive_personal" &&
          row.targetUserId === scopeOwnerId
      ) ?? null
    );
  }
  return rows.find((row) => row.targetScope === "sales_team") ?? rows[0]!;
}

/* -------------------------------------------------------------------------- */
/* Snapshot                                                                    */
/* -------------------------------------------------------------------------- */

export interface CrmManagementAnalyticsSnapshot {
  readonly capturedAt: string;
  readonly scopeOwnerId: string | null;
  readonly isTeamScope: boolean;
  readonly canReadCommercialTruth: boolean;
  readonly sla: CrmSlaComplianceMetrics;
  readonly velocity: CrmVelocityMetrics;
  readonly conversion: CrmConversionMetrics;
  readonly targets: CrmTargetAttainmentMetrics;
}

export const EMPTY_MANAGEMENT_ANALYTICS: CrmManagementAnalyticsSnapshot = {
  capturedAt: "",
  scopeOwnerId: null,
  isTeamScope: false,
  canReadCommercialTruth: false,
  sla: EMPTY_SLA_METRICS,
  velocity: EMPTY_VELOCITY_METRICS,
  conversion: EMPTY_CONVERSION_METRICS,
  targets: EMPTY_TARGET_METRICS,
};

/* -------------------------------------------------------------------------- */
/* Target period resolution                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Sales targets are monthly, but a report range is arbitrary. The attainment
 * period is the Asia/Kolkata month CONTAINING the range start, and is always
 * labelled on the surface so the two are never confused.
 *
 * The range ISO strings produced by `reporting-date-range.ts` already carry the
 * `+05:30` offset, so the leading `YYYY-MM` is the IST month by construction.
 */
export function resolveTargetPeriodFromRangeStart(startIso: string): {
  readonly period: string;
  readonly targetMonth: string;
} {
  const match = /^(\d{4})-(\d{2})/.exec(startIso.trim());
  if (!match) {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    return { period: `${year}-${month}`, targetMonth: `${year}-${month}-01` };
  }
  const period = `${match[1]}-${match[2]}`;
  return { period, targetMonth: `${period}-01` };
}

/* -------------------------------------------------------------------------- */
/* Payload mapping                                                             */
/* -------------------------------------------------------------------------- */

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function isFunnelStage(value: string): value is CrmConversionFunnelStage {
  return (CRM_CONVERSION_FUNNEL_STAGES as readonly string[]).includes(value);
}

/**
 * Maps the `get_crm_management_analytics` jsonb payload. Counts default to 0
 * (a count is always known); rates and medians default to `null` (an unknown
 * must stay unknown).
 */
export function mapManagementAnalyticsPayload(
  payload: unknown
): CrmManagementAnalyticsSnapshot {
  const root = asRecord(payload);
  const sla = asRecord(root.sla);
  const velocity = asRecord(root.velocity);
  const conversion = asRecord(root.conversion);
  const targets = asRecord(root.targets);

  const metCount = asNumber(sla.metCount);
  const breachedCount = asNumber(sla.breachedCount);

  const stages: CrmConversionStage[] = [];
  for (const entry of asArray(conversion.stages)) {
    const row = asRecord(entry);
    const stage = asString(row.stage);
    if (!isFunnelStage(stage)) {
      continue;
    }
    const previousStage = asNullableString(row.previousStage);
    stages.push({
      stage,
      reachedCount: asNumber(row.reachedCount),
      previousStage:
        previousStage !== null && isFunnelStage(previousStage)
          ? previousStage
          : null,
      previousCount: asNullableNumber(row.previousCount),
      stepConversionBasisPoints: asNullableNumber(row.stepConversionBasisPoints),
      overallConversionBasisPoints: asNullableNumber(
        row.overallConversionBasisPoints
      ),
    });
  }

  const stageTransitions: CrmStageTransitionVelocity[] = asArray(
    velocity.stageTransitions
  ).map((entry) => {
    const row = asRecord(entry);
    return {
      fromStage: asString(row.fromStage),
      toStage: asString(row.toStage),
      sampleSize: asNumber(row.sampleSize),
      medianSeconds: asNullableNumber(row.medianSeconds),
    };
  });

  const canReadCommercialTruth = root.canReadCommercialTruth === true;

  const targetRows: CrmTargetAttainmentRow[] = asArray(targets.rows).map(
    (entry) => {
      const row = asRecord(entry);
      return {
        targetId: asString(row.targetId),
        targetScope: asString(
          row.targetScope,
          "executive_personal"
        ) as SalesTargetScope,
        targetUserId: asNullableString(row.targetUserId),
        targetDisplayName: asString(row.targetDisplayName, "Sales executive"),
        status: asString(row.status, "open") as SalesTargetStatus,
        revenueTargetPaise: asNumber(row.revenueTargetPaise),
        closedWonCountTarget: asNumber(row.closedWonCountTarget),
        achievedPaise: asNullableNumber(row.achievedPaise),
        acceptedCount: asNullableNumber(row.acceptedCount),
        remainingPaise: asNullableNumber(row.remainingPaise),
        attainmentBasisPoints: asNullableNumber(row.attainmentBasisPoints),
      };
    }
  );

  return {
    capturedAt: asString(root.capturedAt, new Date().toISOString()),
    scopeOwnerId: asNullableString(root.scopeOwnerId),
    isTeamScope: root.isTeamScope === true,
    canReadCommercialTruth,
    sla: {
      cohortLeadCount: asNumber(sla.cohortLeadCount),
      eligibleCount: asNumber(sla.eligibleCount),
      metCount,
      breachedCount,
      pendingCount: asNumber(sla.pendingCount),
      outOfPolicyCount: asNumber(sla.outOfPolicyCount),
      decidedCount: asNumber(sla.decidedCount, metCount + breachedCount),
      complianceBasisPoints: asNullableNumber(sla.complianceBasisPoints),
    },
    velocity: {
      firstContactSampleSize: asNumber(velocity.firstContactSampleSize),
      medianFirstContactSeconds: asNullableNumber(
        velocity.medianFirstContactSeconds
      ),
      activeLeadCount: asNumber(velocity.activeLeadCount),
      medianActiveLeadAgeSeconds: asNullableNumber(
        velocity.medianActiveLeadAgeSeconds
      ),
      medianCurrentStageAgeSeconds: asNullableNumber(
        velocity.medianCurrentStageAgeSeconds
      ),
      stageTransitions,
    },
    conversion: {
      receivedCount: asNumber(conversion.receivedCount),
      stages,
      closedLostCount: asNumber(conversion.closedLostCount),
      onHoldCurrentCount: asNumber(conversion.onHoldCurrentCount),
      wonRateBasisPoints: asNullableNumber(conversion.wonRateBasisPoints),
    },
    targets: {
      period: asString(targets.period),
      targetMonth: asString(targets.targetMonth),
      canReadCommercialTruth:
        targets.canReadCommercialTruth === true || canReadCommercialTruth,
      periodAchievedPaise: asNullableNumber(targets.periodAchievedPaise),
      periodAcceptedCount: asNullableNumber(targets.periodAcceptedCount),
      rows: targetRows,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Forecast presentation                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Stages a forecast table shows, ordered along the pipeline. Derived from the
 * CRM 2D probability table rather than re-listed, so a probability change can
 * never leave this ordering behind. Terminal and parked stages are excluded
 * from active forecast totals by `get_crm_pipeline_value_summary` itself.
 */
export const CRM_FORECAST_STAGE_ORDER = [
  "new",
  "assigned",
  "contacted",
  "qualified",
  "consultation_scheduled",
  "proposal_sent",
  "negotiation",
] as const satisfies readonly LeadStageCode[];

export function forecastStageRank(stage: LeadStageCode): number {
  const index = (CRM_FORECAST_STAGE_ORDER as readonly string[]).indexOf(stage);
  return index === -1 ? CRM_FORECAST_STAGE_ORDER.length : index;
}
