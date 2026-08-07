/**
 * Phase 8B — client approval evidence requirements (ADR-0020).
 */

import type { ProjectEvidenceRef } from "../../contracts/evidence.ts";
import { validateProjectEvidenceRef } from "../../contracts/evidence.ts";
import { createProjectStageTransitionError } from "../../contracts/transition.ts";
import type { ProjectStageTransitionError } from "../../contracts/transition.ts";
import type { DesignState } from "../../contracts/design-states.ts";

export interface ClientApprovalEvidenceInput {
  readonly targetState: DesignState;
  readonly evidence: ProjectEvidenceRef | null;
}

export interface ClientApprovalEvidenceResult {
  readonly ok: boolean;
  readonly error: ProjectStageTransitionError | null;
}

export function requiresClientApprovalEvidence(targetState: DesignState): boolean {
  return targetState === "client_approved";
}

export function validateClientApprovalEvidence(
  input: ClientApprovalEvidenceInput
): ClientApprovalEvidenceResult {
  if (!requiresClientApprovalEvidence(input.targetState)) {
    return { ok: true, error: null };
  }

  if (!input.evidence) {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_MISSING_EVIDENCE",
        "Client approval requires auditable evidence."
      ),
    };
  }

  if (input.evidence.evidenceType !== "client_approval") {
    return {
      ok: false,
      error: createProjectStageTransitionError(
        "PROJECT_MISSING_EVIDENCE",
        "Client approval evidence must use the client_approval type."
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
