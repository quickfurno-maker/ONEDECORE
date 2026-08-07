/**
 * Pure execution state machine — main path, on_hold, and cancelled (ADR-0020).
 */

import {
  EXECUTION_MAIN_PATH_STATES,
  type ExecutionMainPathState,
  type ExecutionState,
  isExecutionMainPathState,
  isTerminalExecutionState,
} from "../contracts/execution-states.ts";
import {
  createProjectStageTransitionError,
  type ProjectStageTransitionError,
} from "../../contracts/transition.ts";

export const EXECUTION_TRANSITIONS_REQUIRING_EVIDENCE: Readonly<
  Partial<Record<ExecutionMainPathState, readonly string[]>>
> = {
  site_measurement: ["stage_transition"],
  design_approval: ["client_approval", "stage_transition"],
  material_finalisation: ["stage_transition"],
  ready_for_dispatch: ["production_ready", "stage_transition"],
  delivery: ["stage_transition"],
  installation: ["stage_transition"],
  snag_resolution: ["snag_resolution", "stage_transition"],
  handover: ["handover_acknowledgement", "stage_transition"],
  completed: ["completion_acknowledgement", "stage_transition"],
};

export interface ExecutionTransitionRequest {
  readonly fromState: ExecutionState;
  readonly toState: ExecutionState;
  readonly resumeTarget?: ExecutionMainPathState | null;
  readonly evidenceRefs?: readonly string[];
  readonly reason?: string | null;
}

export interface ExecutionTransitionResult {
  readonly allowed: boolean;
  readonly error: ProjectStageTransitionError | null;
}

function isAdjacentMainPathTransition(
  from: ExecutionMainPathState,
  to: ExecutionMainPathState
): boolean {
  const fromIndex = EXECUTION_MAIN_PATH_STATES.indexOf(from);
  const toIndex = EXECUTION_MAIN_PATH_STATES.indexOf(to);
  return toIndex === fromIndex + 1;
}

function canEnterHold(fromState: ExecutionState): boolean {
  if (fromState === "on_hold" || isTerminalExecutionState(fromState)) {
    return false;
  }
  return true;
}

function canCancel(fromState: ExecutionState): boolean {
  return !isTerminalExecutionState(fromState) && fromState !== "on_hold";
}

function canCancelFromHold(): boolean {
  return true;
}

function validateEvidence(
  toState: ExecutionMainPathState,
  evidenceRefs: readonly string[]
): ProjectStageTransitionError | null {
  const requiredTypes = EXECUTION_TRANSITIONS_REQUIRING_EVIDENCE[toState];
  if (!requiredTypes || requiredTypes.length === 0) {
    return null;
  }
  if (evidenceRefs.length === 0) {
    return createProjectStageTransitionError(
      "PROJECT_MISSING_EVIDENCE",
      `Transition into ${toState} requires supporting evidence.`
    );
  }
  return null;
}

export function canTransitionExecutionState(
  fromState: ExecutionState,
  toState: ExecutionState,
  options: {
    readonly resumeTarget?: ExecutionMainPathState | null;
    readonly evidenceRefs?: readonly string[];
    readonly reason?: string | null;
  } = {}
): ExecutionTransitionResult {
  if (fromState === toState) {
    return { allowed: true, error: null };
  }

  if (isTerminalExecutionState(fromState)) {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_TERMINAL_STATE",
        `Cannot transition from terminal state ${fromState}.`
      ),
    };
  }

  if (toState === "on_hold") {
    if (!canEnterHold(fromState)) {
      return {
        allowed: false,
        error: createProjectStageTransitionError(
          "PROJECT_INVALID_TRANSITION",
          `Cannot place ${fromState} on hold.`
        ),
      };
    }
    const reason = options.reason?.trim() ?? "";
    if (reason.length < 10) {
      return {
        allowed: false,
        error: createProjectStageTransitionError(
          "PROJECT_MISSING_REASON",
          "On hold requires a reason of at least 10 characters."
        ),
      };
    }
    return { allowed: true, error: null };
  }

  if (toState === "cancelled") {
    const permitted =
      fromState === "on_hold" ? canCancelFromHold() : canCancel(fromState);
    if (!permitted) {
      return {
        allowed: false,
        error: createProjectStageTransitionError(
          "PROJECT_INVALID_TRANSITION",
          `Cannot cancel from ${fromState}.`
        ),
      };
    }
    const reason = options.reason?.trim() ?? "";
    if (reason.length < 10) {
      return {
        allowed: false,
        error: createProjectStageTransitionError(
          "PROJECT_MISSING_REASON",
          "Cancellation requires a reason of at least 10 characters."
        ),
      };
    }
    return { allowed: true, error: null };
  }

  if (fromState === "on_hold") {
    const resumeTarget = options.resumeTarget;
    if (!resumeTarget || !isExecutionMainPathState(resumeTarget)) {
      return {
        allowed: false,
        error: createProjectStageTransitionError(
          "PROJECT_INVALID_TRANSITION",
          "Resume from on hold requires an explicit main-path resume target."
        ),
      };
    }
    if (toState !== resumeTarget) {
      return {
        allowed: false,
        error: createProjectStageTransitionError(
          "PROJECT_INVALID_TRANSITION",
          "On hold may only resume to the recorded resume target."
        ),
      };
    }
    return { allowed: true, error: null };
  }

  if (!isExecutionMainPathState(fromState) || !isExecutionMainPathState(toState)) {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        `Invalid execution transition ${fromState} → ${toState}.`
      ),
    };
  }

  if (!isAdjacentMainPathTransition(fromState, toState)) {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        `Cannot skip execution stages from ${fromState} to ${toState}.`
      ),
    };
  }

  const evidenceError = validateEvidence(toState, options.evidenceRefs ?? []);
  if (evidenceError) {
    return { allowed: false, error: evidenceError };
  }

  return { allowed: true, error: null };
}

export function assertExecutionTransition(
  request: ExecutionTransitionRequest
): ExecutionTransitionResult {
  return canTransitionExecutionState(request.fromState, request.toState, {
    resumeTarget: request.resumeTarget,
    evidenceRefs: request.evidenceRefs,
    reason: request.reason,
  });
}

export function getAllowedExecutionTransitions(
  fromState: ExecutionState
): readonly ExecutionState[] {
  if (isTerminalExecutionState(fromState)) {
    return [];
  }

  if (fromState === "on_hold") {
    return [];
  }

  const allowed: ExecutionState[] = [];

  if (isExecutionMainPathState(fromState)) {
    const next = EXECUTION_MAIN_PATH_STATES[
      EXECUTION_MAIN_PATH_STATES.indexOf(fromState) + 1
    ] as ExecutionMainPathState | undefined;
    if (next) {
      allowed.push(next);
    }
  }

  if (canEnterHold(fromState)) {
    allowed.push("on_hold");
  }

  if (canCancel(fromState)) {
    allowed.push("cancelled");
  }

  return allowed;
}

export function walkMainExecutionPath(): readonly ExecutionMainPathState[] {
  return EXECUTION_MAIN_PATH_STATES;
}
