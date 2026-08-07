/**
 * Phase 8B migration-independent — design workflow states (ADR-0020).
 */

export const DESIGN_MAIN_PATH_STATES = [
  "brief_received",
  "measurement_pending",
  "measurement_completed",
  "concept_design",
  "internal_review",
  "client_review",
  "client_approved",
  "production_drawings",
  "production_ready",
  "design_completed",
] as const;

export type DesignMainPathState = (typeof DESIGN_MAIN_PATH_STATES)[number];

export const DESIGN_BRANCH_STATES = [
  "revision_required",
  "design_on_hold",
] as const;

export type DesignBranchState = (typeof DESIGN_BRANCH_STATES)[number];

export const DESIGN_STATES = [
  ...DESIGN_MAIN_PATH_STATES,
  ...DESIGN_BRANCH_STATES,
] as const;

export type DesignState = (typeof DESIGN_STATES)[number];

export const DESIGN_TERMINAL_STATES = ["design_completed"] as const;

export type DesignTerminalState = (typeof DESIGN_TERMINAL_STATES)[number];

/** Stages that may enter revision_required (ADR-0020). */
export const DESIGN_REVISION_SOURCE_STATES = [
  "internal_review",
  "client_review",
] as const satisfies readonly DesignState[];

/** Stages revision_required may return to (ADR-0020 loop). */
export const DESIGN_REVISION_RETURN_STATES = [
  "concept_design",
  "internal_review",
] as const satisfies readonly DesignState[];

/** Active non-terminal stages permitted to enter design_on_hold. */
export const DESIGN_HOLD_ELIGIBLE_STATES = DESIGN_MAIN_PATH_STATES.filter(
  (state) => state !== "design_completed"
) as readonly DesignMainPathState[];

export const DESIGN_STATE_LABELS: Readonly<Record<DesignState, string>> = {
  brief_received: "Brief Received",
  measurement_pending: "Measurement Pending",
  measurement_completed: "Measurement Completed",
  concept_design: "Concept Design",
  internal_review: "Internal Review",
  client_review: "Client Review",
  client_approved: "Client Approved",
  production_drawings: "Production Drawings",
  production_ready: "Production Ready",
  design_completed: "Design Completed",
  revision_required: "Revision Required",
  design_on_hold: "Design On Hold",
};

export function isDesignState(value: string): value is DesignState {
  return (DESIGN_STATES as readonly string[]).includes(value);
}

export function isDesignTerminalState(state: DesignState): state is DesignTerminalState {
  return (DESIGN_TERMINAL_STATES as readonly string[]).includes(state);
}

export function getDesignStateLabel(state: DesignState): string {
  return DESIGN_STATE_LABELS[state];
}
