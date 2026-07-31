/**
 * Lead pipeline stage constants and allowed transition graph — aligned with
 * `private.transition_lead_status_impl` in Phase 5B migration.
 *
 * `new` and `assigned` are owned exclusively by `assign_lead`; they are not
 * valid targets for `transition_lead_status`.
 *
 * `on_hold` resume targets are dynamic (recorded `on_hold_previous_status` with
 * new/assigned reconciliation); only pause edges are listed statically here.
 */

export const LEAD_STAGE_CODES = [
  "new",
  "assigned",
  "contacted",
  "qualified",
  "consultation_scheduled",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
  "on_hold",
] as const;

export type LeadStageCode = (typeof LEAD_STAGE_CODES)[number];

export const TERMINAL_LEAD_STAGES = ["closed_won", "closed_lost"] as const;

export type TerminalLeadStageCode = (typeof TERMINAL_LEAD_STAGES)[number];

/** Assignment-synchronized stages — mutate only via assign_lead RPC. */
export const ASSIGNMENT_OWNED_STAGES = ["new", "assigned"] as const;

/** Closed-Won is terminal and blocked from direct RPC transition in Phase 5B. */
export const PHASE_5B_BLOCKED_TARGET_STAGES = ["closed_won", "assigned", "new"] as const;

/**
 * Allowed transitions from each stage via transition_lead_status only.
 * Terminal stages have no outgoing edges.
 * On-hold resume is dynamic and not enumerated here.
 */
export const LEAD_STAGE_TRANSITIONS: Readonly<
  Record<LeadStageCode, readonly LeadStageCode[]>
> = {
  new: ["closed_lost", "on_hold"],
  assigned: ["contacted", "closed_lost", "on_hold"],
  contacted: ["qualified", "closed_lost", "on_hold"],
  qualified: ["consultation_scheduled", "closed_lost", "on_hold"],
  consultation_scheduled: ["proposal_sent", "closed_lost", "on_hold"],
  proposal_sent: ["negotiation", "closed_lost", "on_hold"],
  negotiation: ["closed_lost", "on_hold"],
  on_hold: [],
  closed_won: [],
  closed_lost: [],
};

export function getAllowedLeadTransitions(
  from: LeadStageCode
): readonly LeadStageCode[] {
  return LEAD_STAGE_TRANSITIONS[from];
}

export function isLeadTransitionAllowed(
  from: LeadStageCode,
  to: LeadStageCode
): boolean {
  return getAllowedLeadTransitions(from).includes(to);
}

export function isTerminalLeadStage(
  stage: LeadStageCode
): stage is TerminalLeadStageCode {
  return (TERMINAL_LEAD_STAGES as readonly string[]).includes(stage);
}

export function isAssignmentOwnedStage(stage: LeadStageCode): boolean {
  return (ASSIGNMENT_OWNED_STAGES as readonly string[]).includes(stage);
}
