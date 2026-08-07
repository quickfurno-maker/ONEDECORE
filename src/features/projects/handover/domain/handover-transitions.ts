/**
 * Pure handover state transition validators (ADR-0020).
 */

import type { ProjectHandoverState } from "../../contracts/lifecycle.ts";
import { isHandoverExecutionEligible } from "../../contracts/lifecycle.ts";
import {
  createProjectStageTransitionError,
  type ProjectStageTransitionError,
} from "../../contracts/transition.ts";

const ALLOWED_HANDOVER_TRANSITIONS: Readonly<
  Record<ProjectHandoverState, readonly ProjectHandoverState[]>
> = {
  awaiting_project_manager_assignment: ["awaiting_project_manager_acceptance"],
  awaiting_project_manager_acceptance: ["handover_accepted"],
  handover_accepted: [],
};

export function canTransitionHandoverState(
  from: ProjectHandoverState,
  to: ProjectHandoverState
): boolean {
  if (from === to) {
    return true;
  }
  return (ALLOWED_HANDOVER_TRANSITIONS[from] as readonly string[]).includes(to);
}

export interface HandoverTransitionValidationResult {
  readonly allowed: boolean;
  readonly error: ProjectStageTransitionError | null;
}

export function validateHandoverAssignmentTransition(
  from: ProjectHandoverState
): HandoverTransitionValidationResult {
  if (from !== "awaiting_project_manager_assignment") {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        "PM assignment is only valid while awaiting project manager assignment."
      ),
    };
  }

  return { allowed: true, error: null };
}

export function validateHandoverAcceptanceTransition(
  from: ProjectHandoverState
): HandoverTransitionValidationResult {
  if (from !== "awaiting_project_manager_acceptance") {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        "Handover acceptance is only valid while awaiting project manager acceptance."
      ),
    };
  }

  if (!canTransitionHandoverState(from, "handover_accepted")) {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        "Invalid handover acceptance transition."
      ),
    };
  }

  return { allowed: true, error: null };
}

export function resolveHandoverStateAfterAssignment(
  from: ProjectHandoverState
): ProjectHandoverState | null {
  if (!validateHandoverAssignmentTransition(from).allowed) {
    return null;
  }
  return "awaiting_project_manager_acceptance";
}

export function resolveHandoverStateAfterAcceptance(
  from: ProjectHandoverState
): ProjectHandoverState | null {
  if (!validateHandoverAcceptanceTransition(from).allowed) {
    return null;
  }
  return "handover_accepted";
}

export function isExecutionEligibleAfterHandover(
  handoverState: ProjectHandoverState
): boolean {
  return isHandoverExecutionEligible(handoverState);
}
