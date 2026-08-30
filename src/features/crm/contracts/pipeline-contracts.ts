/**
 * CRM 2B-2 — dedicated premium pipeline contracts.
 *
 * Reuses the canonical stage taxonomy (`lead-stages.ts`) and the canonical
 * transition guards (`lifecycle-contracts.ts`). This module introduces NO second
 * stage model and NO second transition state machine: it only derives board
 * presentation, deterministic urgency ordering, and the user-facing reason a
 * drop is refused before `transition_lead_status` is ever called.
 */

import { calendarLocalDate } from "./calendar-contracts.ts";
import type { LeadStageCode } from "./lead-stages.ts";
import {
  isLeadTransitionAllowed,
  isTerminalLeadStage,
  ASSIGNMENT_OWNED_STAGES,
  PHASE_5B_BLOCKED_TARGET_STAGES,
} from "./lead-stages.ts";
import { getForwardTransitionOptions } from "./lifecycle-contracts.ts";

/**
 * Board columns — the working funnel plus the on-hold parking lane.
 *
 * Terminal stages (`closed_won`, `closed_lost`) are deliberately not columns:
 * they have no outgoing transitions, they grow without bound, and the Leads
 * table remains the canonical workspace for closed leads.
 */
export const CRM_PIPELINE_BOARD_STAGES = [
  "new",
  "assigned",
  "contacted",
  "qualified",
  "consultation_scheduled",
  "proposal_sent",
  "negotiation",
  "on_hold",
] as const satisfies readonly LeadStageCode[];

export type CrmPipelineBoardStage = (typeof CRM_PIPELINE_BOARD_STAGES)[number];

/** Bounded per-column fetch. Totals stay exact; cards are the urgent head. */
export const CRM_PIPELINE_STAGE_FETCH_LIMIT = 30;

/** Bounded scan for stage-entry events across a fetched board. */
export const CRM_PIPELINE_STAGE_EVENT_SCAN_LIMIT = 1_200;

/**
 * Lead events that define entry into the current stage. Mirrors the event types
 * emitted by `assign_lead` and `transition_lead_status`.
 */
export const CRM_PIPELINE_STAGE_ENTRY_EVENT_TYPES = [
  "lead.created",
  "lead.assigned",
  "lead.status_changed",
  "lead.on_hold",
  "lead.resumed",
] as const;

/**
 * Deterministic urgency ladder (highest first). Every signal is already
 * canonical in CRM 2A — nothing here is scored, weighted or inferred.
 */
export const CRM_PIPELINE_URGENCY_CODES = [
  "sla_breach",
  "no_next_action",
  "overdue",
  "new_uncontacted",
  "due_today",
  "upcoming",
  "none",
] as const;

export type CrmPipelineUrgencyCode = (typeof CRM_PIPELINE_URGENCY_CODES)[number];

const URGENCY_RANK: Readonly<Record<CrmPipelineUrgencyCode, number>> = {
  sla_breach: 0,
  no_next_action: 1,
  overdue: 2,
  new_uncontacted: 3,
  due_today: 4,
  upcoming: 5,
  none: 6,
};

export const CRM_PIPELINE_URGENCY_LABELS: Readonly<
  Record<CrmPipelineUrgencyCode, string>
> = {
  sla_breach: "SLA breach",
  no_next_action: "No next action",
  overdue: "Overdue",
  new_uncontacted: "Uncontacted",
  due_today: "Due today",
  upcoming: "Scheduled",
  none: "—",
};

export interface CrmPipelineCard {
  readonly leadId: string;
  readonly displayName: string;
  readonly status: CrmPipelineBoardStage;
  readonly serviceCode: string;
  readonly locality: string | null;
  readonly sourceLabel: string;
  readonly assigneeId: string | null;
  readonly assigneeLabel: string;
  readonly primaryNextActionTitle: string | null;
  readonly primaryNextActionType: string | null;
  readonly primaryNextActionDueAt: string | null;
  /** True only when an SLA policy is actually configured and the clock breached. */
  readonly slaBreached: boolean;
  /** Canonical `crm_sla_clocks.first_contact_attempt_at is null` on an assigned lead. */
  readonly newUncontacted: boolean;
  /** Instant the lead entered its current stage, from canonical lead events. */
  readonly stageEnteredAt: string;
  /** `event` when derived from a stage-entry event, `created` when falling back. */
  readonly stageEnteredSource: "event" | "created";
  readonly createdAt: string;
}

export interface CrmPipelineStageColumn {
  readonly stage: CrmPipelineBoardStage;
  readonly total: number;
  readonly cards: readonly CrmPipelineCard[];
  readonly truncated: boolean;
}

export interface CrmPipelineBoard {
  readonly columns: readonly CrmPipelineStageColumn[];
  readonly capturedAt: string;
  readonly scopeOwnerId: string | null;
  readonly isTeamScope: boolean;
  /**
   * False whenever no active SLA policy produced a usable clock, so the UI never
   * implies SLA coverage that is not configured.
   */
  readonly slaSignalAvailable: boolean;
}

export function isPipelineBoardStage(
  status: string
): status is CrmPipelineBoardStage {
  return (CRM_PIPELINE_BOARD_STAGES as readonly string[]).includes(status);
}

export function formatPipelineStageLabel(stage: LeadStageCode): string {
  return stage
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/* Urgency                                                                     */
/* -------------------------------------------------------------------------- */

export function resolvePipelineUrgency(
  card: CrmPipelineCard,
  now: number = Date.now()
): CrmPipelineUrgencyCode {
  if (card.slaBreached) {
    return "sla_breach";
  }
  if (!card.primaryNextActionDueAt) {
    return "no_next_action";
  }

  const dueMs = Date.parse(card.primaryNextActionDueAt);
  if (Number.isNaN(dueMs)) {
    return "no_next_action";
  }
  if (dueMs < now) {
    return "overdue";
  }
  if (card.newUncontacted) {
    return "new_uncontacted";
  }
  if (calendarLocalDate(dueMs) === calendarLocalDate(now)) {
    return "due_today";
  }
  return "upcoming";
}

export function pipelineUrgencyRank(code: CrmPipelineUrgencyCode): number {
  return URGENCY_RANK[code];
}

/**
 * Total order for cards within a stage column: urgency ladder, then the soonest
 * primary next action, then the oldest lead, then id. Never `created_at` alone.
 */
export function comparePipelineCards(
  left: CrmPipelineCard,
  right: CrmPipelineCard,
  now: number = Date.now()
): number {
  const rankDelta =
    pipelineUrgencyRank(resolvePipelineUrgency(left, now)) -
    pipelineUrgencyRank(resolvePipelineUrgency(right, now));
  if (rankDelta !== 0) {
    return rankDelta;
  }

  const leftDue = left.primaryNextActionDueAt
    ? Date.parse(left.primaryNextActionDueAt)
    : Number.POSITIVE_INFINITY;
  const rightDue = right.primaryNextActionDueAt
    ? Date.parse(right.primaryNextActionDueAt)
    : Number.POSITIVE_INFINITY;
  if (leftDue !== rightDue) {
    return leftDue < rightDue ? -1 : 1;
  }

  const createdDelta = Date.parse(left.createdAt) - Date.parse(right.createdAt);
  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.leadId.localeCompare(right.leadId);
}

export function sortPipelineCards(
  cards: readonly CrmPipelineCard[],
  now: number = Date.now()
): readonly CrmPipelineCard[] {
  return [...cards].sort((left, right) => comparePipelineCards(left, right, now));
}

/** Whole days the lead has been sitting in its current stage. */
export function pipelineStageAgeDays(
  card: CrmPipelineCard,
  now: number = Date.now()
): number {
  const enteredMs = Date.parse(card.stageEnteredAt);
  if (Number.isNaN(enteredMs)) {
    return 0;
  }
  return Math.max(0, Math.floor((now - enteredMs) / 86_400_000));
}

export function formatPipelineStageAgeLabel(days: number): string {
  if (days <= 0) {
    return "Today in stage";
  }
  return `${days}d in stage`;
}

/* -------------------------------------------------------------------------- */
/* Stage movement guards                                                       */
/* -------------------------------------------------------------------------- */

/** Stages a card may be DRAGGED onto — forward transitions only. */
export function getPipelineDropTargets(
  from: LeadStageCode
): readonly LeadStageCode[] {
  if (isTerminalLeadStage(from) || from === "on_hold") {
    return [];
  }
  return getForwardTransitionOptions(from);
}

/**
 * User-facing refusal reason for a drop, or null when the drop may be sent to
 * `transition_lead_status`. The RPC stays the authority; this only prevents
 * pointless round-trips and gives an explicit, honest message.
 */
export function resolvePipelineDropRejection(
  from: LeadStageCode,
  to: LeadStageCode
): string | null {
  if (from === to) {
    return "Lead is already in this stage.";
  }

  if (to === "closed_won") {
    return "Closed Won is set by accepted quotation only.";
  }

  if ((ASSIGNMENT_OWNED_STAGES as readonly string[]).includes(to)) {
    return `${formatPipelineStageLabel(to)} is set by lead assignment, not by moving cards.`;
  }

  if ((PHASE_5B_BLOCKED_TARGET_STAGES as readonly string[]).includes(to)) {
    return `${formatPipelineStageLabel(to)} cannot be selected directly.`;
  }

  if (isTerminalLeadStage(from)) {
    return "Closed leads cannot be moved.";
  }

  if (from === "on_hold") {
    return "Resume this lead from its detail page before moving it.";
  }

  if (to === "on_hold") {
    return "Placing a lead on hold needs a reason — use Move stage.";
  }

  if (to === "closed_lost") {
    return "Closing a lead lost needs a reason — use Move stage.";
  }

  if (!isLeadTransitionAllowed(from, to)) {
    return `${formatPipelineStageLabel(from)} cannot move straight to ${formatPipelineStageLabel(
      to
    )}.`;
  }

  return null;
}

export function buildPipelineHref(ownerId?: string | null): string {
  return ownerId
    ? `/admin/crm/pipeline?owner=${encodeURIComponent(ownerId)}`
    : "/admin/crm/pipeline";
}
