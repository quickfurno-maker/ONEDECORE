/**
 * Phase 8 migration-independent — stage transition contracts.
 */

export const PROJECT_STAGE_TRANSITION_ERROR_CODES = [
  "PROJECT_INVALID_TRANSITION",
  "PROJECT_UNAUTHORIZED",
  "PROJECT_MISSING_EVIDENCE",
  "PROJECT_MISSING_REASON",
  "PROJECT_TERMINAL_STATE",
  "PROJECT_DUPLICATE_PRIMARY_PM",
  "PROJECT_DUPLICATE_LEAD_DESIGNER",
  "PROJECT_HANDOVER_NOT_ACCEPTED",
  "PROJECT_COMMERCIAL_PREREQUISITE",
] as const;

export type ProjectStageTransitionErrorCode =
  (typeof PROJECT_STAGE_TRANSITION_ERROR_CODES)[number];

export interface ProjectStageTransitionError {
  readonly code: ProjectStageTransitionErrorCode;
  readonly message: string;
}

export interface ProjectStageTransition {
  readonly fromState: string;
  readonly toState: string;
  readonly actorProfileId: string;
  readonly actorRole: string;
  readonly reason: string | null;
  readonly evidenceRefs: readonly string[];
  readonly transitionedAt: string;
}

export function createProjectStageTransitionError(
  code: ProjectStageTransitionErrorCode,
  message: string
): ProjectStageTransitionError {
  return { code, message };
}
