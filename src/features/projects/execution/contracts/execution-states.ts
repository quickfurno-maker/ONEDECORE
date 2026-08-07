/**
 * Phase 8C migration-independent — execution stage contracts (ADR-0020).
 */

export const EXECUTION_MAIN_PATH_STATES = [
  "project_created",
  "site_measurement",
  "design_development",
  "design_approval",
  "material_finalisation",
  "production",
  "ready_for_dispatch",
  "delivery",
  "installation",
  "snag_resolution",
  "handover",
  "completed",
] as const;

export type ExecutionMainPathState = (typeof EXECUTION_MAIN_PATH_STATES)[number];

export const EXECUTION_BRANCH_STATES = ["on_hold", "cancelled"] as const;

export type ExecutionBranchState = (typeof EXECUTION_BRANCH_STATES)[number];

export const EXECUTION_STATES = [
  ...EXECUTION_MAIN_PATH_STATES,
  ...EXECUTION_BRANCH_STATES,
] as const;

export type ExecutionState = (typeof EXECUTION_STATES)[number];

export const TERMINAL_EXECUTION_STATES = ["completed", "cancelled"] as const;

export type TerminalExecutionState = (typeof TERMINAL_EXECUTION_STATES)[number];

export const EXECUTION_STATE_LABELS: Readonly<Record<ExecutionState, string>> = {
  project_created: "Project Created",
  site_measurement: "Site Measurement",
  design_development: "Design Development",
  design_approval: "Design Approval",
  material_finalisation: "Material Finalisation",
  production: "Production",
  ready_for_dispatch: "Ready for Dispatch",
  delivery: "Delivery",
  installation: "Installation",
  snag_resolution: "Snag Resolution",
  handover: "Handover",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

export function isExecutionState(value: string): value is ExecutionState {
  return (EXECUTION_STATES as readonly string[]).includes(value);
}

export function isTerminalExecutionState(state: ExecutionState): boolean {
  return (TERMINAL_EXECUTION_STATES as readonly string[]).includes(state);
}

export function isExecutionMainPathState(state: ExecutionState): state is ExecutionMainPathState {
  return (EXECUTION_MAIN_PATH_STATES as readonly string[]).includes(state);
}

export function getExecutionStateLabel(state: ExecutionState): string {
  return EXECUTION_STATE_LABELS[state];
}

export function getNextMainPathState(
  state: ExecutionMainPathState
): ExecutionMainPathState | null {
  const index = EXECUTION_MAIN_PATH_STATES.indexOf(state);
  if (index < 0 || index >= EXECUTION_MAIN_PATH_STATES.length - 1) {
    return null;
  }
  return EXECUTION_MAIN_PATH_STATES[index + 1] ?? null;
}
