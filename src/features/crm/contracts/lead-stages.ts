/**
 * Lead pipeline stage constants and allowed transition graph — aligned with
 * `private.transition_lead_status_impl` in Phase 5B migration.
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

/** Closed-Won is terminal and blocked from direct RPC transition in Phase 5B. */
export const PHASE_5B_BLOCKED_TARGET_STAGES = ["closed_won"] as const;

/**
 * Allowed transitions from each stage. Terminal stages have no outgoing edges.
 * Mirrors the `v_allowed` case expression in `transition_lead_status_impl`.
 */
export const LEAD_STAGE_TRANSITIONS: Readonly<
  Record<LeadStageCode, readonly LeadStageCode[]>
> = {
  new: ["assigned", "contacted", "closed_lost", "on_hold"],
  assigned: ["contacted", "closed_lost", "on_hold", "new"],
  contacted: ["qualified", "closed_lost", "on_hold"],
  qualified: ["consultation_scheduled", "closed_lost", "on_hold"],
  consultation_scheduled: ["proposal_sent", "closed_lost", "on_hold"],
  proposal_sent: ["negotiation", "closed_lost", "on_hold"],
  negotiation: ["closed_lost", "on_hold"],
  on_hold: [
    "new",
    "assigned",
    "contacted",
    "qualified",
    "consultation_scheduled",
    "proposal_sent",
    "negotiation",
  ],
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
