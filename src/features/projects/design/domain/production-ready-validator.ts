/**
 * Phase 8B — production ready gate (ADR-0020).
 */

import type { ProjectEvidenceRef } from "../../contracts/evidence.ts";
import { validateProjectEvidenceRef } from "../../contracts/evidence.ts";
import type { ProjectActorContext } from "../../contracts/permissions.ts";
import { resolveProjectPermissionCapabilities } from "../../contracts/permissions.ts";
import { createProjectStageTransitionError } from "../../contracts/transition.ts";
import type { ProjectStageTransitionError } from "../../contracts/transition.ts";
import type { DesignState } from "../../contracts/design-states.ts";
import {
  countLeadDesigners,
  type ProjectStaffingSnapshot,
} from "../../contracts/assignment.ts";

export interface ProductionReadyValidationInput {
  readonly targetState: DesignState;
  readonly actor: ProjectActorContext;
  readonly staffing: ProjectStaffingSnapshot;
  readonly evidence: ProjectEvidenceRef | null;
}

export interface ProductionReadyValidationResult {
  readonly ok: boolean;
  readonly error: ProjectStageTransitionError | null;
}

export function requiresProductionReadyGate(targetState: DesignState): boolean {
  return targetState === "production_ready" || targetState === "design_completed";
}

export function validateProductionReadyTransition(
  input: ProductionReadyValidationInput
): ProductionReadyValidationResult {
  if (!requiresProductionReadyGate(input.targetState)) {
    return { ok: true, error: null };
  }

  if (countLeadDesigners(input.staffing) !== 1) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_MISSING_EVIDENCE",
        "Production ready requires exactly one lead designer on the project."
      ),
    };
  }

  const capabilities = resolveProjectPermissionCapabilities(input.actor);
  if (!capabilities.canApproveProductionReady) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_UNAUTHORIZED",
        "Only the assigned lead designer may approve production ready."
      ),
    };
  }

  if (!input.evidence) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_MISSING_EVIDENCE",
        "Production ready requires lead designer evidence."
      ),
    };
  }

  if (input.evidence.evidenceType !== "production_ready") {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_MISSING_EVIDENCE",
        "Production ready evidence must use the production_ready type."
      ),
    };
  }

  const evidenceError = validateProjectEvidenceRef(input.evidence);
  if (evidenceError) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_MISSING_EVIDENCE",
        evidenceError
      ),
    };
  }

  return { ok: true, error: null };
}
