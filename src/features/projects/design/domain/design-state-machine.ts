/**
 * Phase 8B — pure design workflow transitions (ADR-0020).
 */

import {
  DESIGN_HOLD_ELIGIBLE_STATES,
  DESIGN_REVISION_RETURN_STATES,
  DESIGN_REVISION_SOURCE_STATES,
  type DesignState,
  isDesignTerminalState,
} from "../../contracts/design-states.ts";
import { createProjectStageTransitionError } from "../../contracts/transition.ts";
import type { ProjectStageTransitionError } from "../../contracts/transition.ts";

const MAIN_PATH_TRANSITIONS: Readonly<Record<DesignState, readonly DesignState[]>> = {
  brief_received: ["measurement_pending"],
  measurement_pending: ["measurement_completed"],
  measurement_completed: ["concept_design"],
  concept_design: ["internal_review"],
  internal_review: ["client_review", "revision_required"],
  client_review: ["client_approved", "revision_required"],
  client_approved: ["production_drawings"],
  production_drawings: ["production_ready"],
  production_ready: ["design_completed"],
  design_completed: [],
  revision_required: [...DESIGN_REVISION_RETURN_STATES],
  design_on_hold: [],
};

export interface DesignTransitionContext {
  /** Required when resuming from design_on_hold. */
  readonly heldFromState?: DesignState;
  /** Optional explicit revision return target; defaults to concept_design. */
  readonly revisionReturnState?: DesignState;
}

export interface DesignTransitionResult {
  readonly ok: boolean;
  readonly error: ProjectStageTransitionError | null;
}

function isHoldEligible(state: DesignState): boolean {
  return (DESIGN_HOLD_ELIGIBLE_STATES as readonly string[]).includes(state);
}

function isRevisionSource(state: DesignState): boolean {
  return (DESIGN_REVISION_SOURCE_STATES as readonly string[]).includes(state);
}

function isRevisionReturn(state: DesignState): boolean {
  return (DESIGN_REVISION_RETURN_STATES as readonly string[]).includes(state);
}

export function canTransitionDesignState(
  from: DesignState,
  to: DesignState,
  context: DesignTransitionContext = {}
): boolean {
  if (from === to) {
    return true;
  }

  if (isDesignTerminalState(from)) {
    return false;
  }

  if (to === "design_on_hold") {
    return isHoldEligible(from);
  }

  if (from === "design_on_hold") {
    const resumeTarget = context.heldFromState;
    return resumeTarget !== undefined && resumeTarget === to && isHoldEligible(resumeTarget);
  }

  if (to === "revision_required") {
    return isRevisionSource(from);
  }

  if (from === "revision_required") {
    const target = context.revisionReturnState ?? "concept_design";
    return to === target && isRevisionReturn(target);
  }

  return (MAIN_PATH_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function validateDesignTransition(
  from: DesignState,
  to: DesignState,
  context: DesignTransitionContext = {}
): DesignTransitionResult {
  if (from === to) {
    return { ok: true, error: null };
  }

  if (isDesignTerminalState(from)) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_TERMINAL_STATE",
        `Design workflow is terminal at ${from}.`
      ),
    };
  }

  if (to === "design_on_hold" && !isHoldEligible(from)) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        `Cannot place design on hold from ${from}.`
      ),
    };
  }

  if (from === "design_on_hold") {
    if (!context.heldFromState) {
      return {
        ok: false,
        error: createProjectStageTransitionError(
          "PROJECT_MISSING_REASON",
          "Resume target is required when leaving design on hold."
        ),
      };
    }
    if (context.heldFromState !== to) {
      return {
        ok: false,
        error: createProjectStageTransitionError(
          "PROJECT_INVALID_TRANSITION",
          `Design on hold must resume to ${context.heldFromState}, not ${to}.`
        ),
      };
    }
  }

  if (to === "revision_required" && !isRevisionSource(from)) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        `Revision required may only branch from internal or client review.`
      ),
    };
  }

  if (from === "revision_required") {
    const target = context.revisionReturnState ?? "concept_design";
    if (to !== target || !isRevisionReturn(target)) {
      return {
        ok: false,
        error: createProjectStageTransitionError(
          "PROJECT_INVALID_TRANSITION",
          `Revision must return to an appropriate design stage (${DESIGN_REVISION_RETURN_STATES.join(", ")}).`
        ),
      };
    }
  }

  if (!canTransitionDesignState(from, to, context)) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        `Transition from ${from} to ${to} is not permitted.`
      ),
    };
  }

  return { ok: true, error: null };
}

export function getPermittedDesignTransitions(
  from: DesignState,
  context: DesignTransitionContext = {}
): readonly DesignState[] {
  if (isDesignTerminalState(from)) {
    return [];
  }

  const main = MAIN_PATH_TRANSITIONS[from] ?? [];
  const extras: DesignState[] = [];

  if (isHoldEligible(from)) {
    extras.push("design_on_hold");
  }

  if (from === "design_on_hold" && context.heldFromState) {
    return [context.heldFromState];
  }

  if (from === "revision_required") {
    const target = context.revisionReturnState ?? "concept_design";
    return isRevisionReturn(target) ? [target] : [...DESIGN_REVISION_RETURN_STATES];
  }

  return [...new Set([...main, ...extras])];
}
