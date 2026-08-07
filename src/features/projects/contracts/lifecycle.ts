/**
 * Phase 8 migration-independent — project lifecycle and handover states (ADR-0020).
 */

export const PROJECT_HANDOVER_STATES = [
  "awaiting_project_manager_assignment",
  "awaiting_project_manager_acceptance",
  "handover_accepted",
] as const;

export type ProjectHandoverState = (typeof PROJECT_HANDOVER_STATES)[number];

export const PROJECT_LIFECYCLE_PHASES = [
  "handover",
  "design",
  "execution",
] as const;

export type ProjectLifecyclePhase = (typeof PROJECT_LIFECYCLE_PHASES)[number];

export interface ProjectLifecycle {
  readonly phase: ProjectLifecyclePhase;
  readonly handoverState: ProjectHandoverState;
  readonly designState: string | null;
  readonly executionState: string | null;
  readonly isTerminal: boolean;
}

export function isHandoverExecutionEligible(state: ProjectHandoverState): boolean {
  return state === "handover_accepted";
}

export function isProjectHandoverState(value: string): value is ProjectHandoverState {
  return (PROJECT_HANDOVER_STATES as readonly string[]).includes(value);
}
