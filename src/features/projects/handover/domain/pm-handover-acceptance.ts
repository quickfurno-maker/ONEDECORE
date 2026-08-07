/**
 * Pure PM handover acceptance rules (ADR-0020).
 */

import type { CrmRoleCode } from "../../../crm/contracts/permissions.ts";
import type { ProjectHandoverState } from "../../contracts/lifecycle.ts";
import type { ProjectStaffingSnapshot } from "../../contracts/assignment.ts";
import type { ProjectEvidenceRef } from "../../contracts/evidence.ts";
import { validateProjectEvidenceRef } from "../../contracts/evidence.ts";
import {
  createProjectStageTransitionError,
  type ProjectStageTransitionError,
} from "../../contracts/transition.ts";

export interface PmHandoverAcceptanceInput {
  readonly actorProfileId: string;
  readonly actorRole: CrmRoleCode;
  readonly handoverState: ProjectHandoverState;
  readonly staffing: ProjectStaffingSnapshot;
  readonly handoverEvidence: ProjectEvidenceRef | null;
}

export interface PmHandoverAcceptanceResult {
  readonly allowed: boolean;
  readonly error: ProjectStageTransitionError | null;
}

export function validatePmHandoverAcceptance(
  input: PmHandoverAcceptanceInput
): PmHandoverAcceptanceResult {
  if (input.handoverState !== "awaiting_project_manager_acceptance") {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        "Handover acceptance is only valid while awaiting project manager acceptance."
      ),
    };
  }

  if (input.actorRole !== "project_manager") {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_UNAUTHORIZED",
        "Only the assigned primary project manager may accept handover."
      ),
    };
  }

  const primaryPm = input.staffing.primaryProjectManager;
  if (!primaryPm || primaryPm.staffProfileId !== input.actorProfileId) {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_UNAUTHORIZED",
        "Handover acceptance requires the assigned primary project manager."
      ),
    };
  }

  if (!input.handoverEvidence) {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_MISSING_EVIDENCE",
        "Handover acknowledgement evidence is required."
      ),
    };
  }

  const evidenceError = validateProjectEvidenceRef(input.handoverEvidence);
  if (evidenceError) {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_MISSING_EVIDENCE",
        evidenceError
      ),
    };
  }

  if (input.handoverEvidence.evidenceType !== "handover_acknowledgement") {
    return {
      allowed: false,
      error: createProjectStageTransitionError(
        "PROJECT_MISSING_EVIDENCE",
        "Handover acknowledgement evidence type is required."
      ),
    };
  }

  return { allowed: true, error: null };
}
