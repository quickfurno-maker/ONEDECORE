/**
 * Phase 8B — versioned design deliverables (ADR-0020).
 */

import type { ProjectEvidenceRef } from "../../contracts/evidence.ts";
import { createProjectStageTransitionError } from "../../contracts/transition.ts";
import type { ProjectStageTransitionError } from "../../contracts/transition.ts";

export type DesignDeliverableKind =
  | "concept_board"
  | "measurement_sheet"
  | "client_presentation"
  | "production_drawing"
  | "approval_pack";

export interface DesignDeliverableVersion {
  readonly deliverableId: string;
  readonly kind: DesignDeliverableKind;
  readonly version: number;
  readonly label: string;
  readonly evidenceRef: string;
  readonly uploadedAt: string;
  readonly uploadedByProfileId: string;
  readonly supersedesVersion: number | null;
  readonly isCurrent: boolean;
}

export interface RegisterDeliverableVersionInput {
  readonly deliverableId: string;
  readonly kind: DesignDeliverableKind;
  readonly label: string;
  readonly evidence: ProjectEvidenceRef;
  readonly existingVersions: readonly DesignDeliverableVersion[];
}

export interface RegisterDeliverableVersionResult {
  readonly ok: boolean;
  readonly version: DesignDeliverableVersion | null;
  readonly error: ProjectStageTransitionError | null;
}

export function getCurrentDeliverableVersion(
  versions: readonly DesignDeliverableVersion[],
  deliverableId: string
): DesignDeliverableVersion | null {
  return (
    versions.find(
      (version) => version.deliverableId === deliverableId && version.isCurrent
    ) ?? null
  );
}

export function registerDeliverableVersion(
  input: RegisterDeliverableVersionInput
): RegisterDeliverableVersionResult {
  if (!input.evidence.evidenceRef.trim()) {
    return {
      ok: false,
      version: null,
      error: createProjectStageTransitionError(
        "PROJECT_MISSING_EVIDENCE",
        "Deliverable evidence reference is required."
      ),
    };
  }

  if (input.evidence.evidenceType !== "design_deliverable") {
    return {
      ok: false,
      version: null,
      error: createProjectStageTransitionError(
        "PROJECT_MISSING_EVIDENCE",
        "Design deliverables must reference design_deliverable evidence."
      ),
    };
  }

  const sameDeliverable = input.existingVersions.filter(
    (version) => version.deliverableId === input.deliverableId
  );

  const duplicateVersion = sameDeliverable.some(
    (version) => version.version === input.evidence.version
  );
  if (duplicateVersion) {
    return {
      ok: false,
      version: null,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        "Deliverable versions cannot be silently overwritten."
      ),
    };
  }

  const current = getCurrentDeliverableVersion(
    input.existingVersions,
    input.deliverableId
  );
  const nextVersion =
    sameDeliverable.length === 0
      ? 1
      : Math.max(...sameDeliverable.map((version) => version.version)) + 1;

  if (input.evidence.version !== nextVersion) {
    return {
      ok: false,
      version: null,
      error: createProjectStageTransitionError(
        "PROJECT_INVALID_TRANSITION",
        `Next deliverable version must be ${nextVersion}.`
      ),
    };
  }

  const created: DesignDeliverableVersion = {
    deliverableId: input.deliverableId,
    kind: input.kind,
    version: nextVersion,
    label: input.label,
    evidenceRef: input.evidence.evidenceRef,
    uploadedAt: input.evidence.capturedAt,
    uploadedByProfileId: input.evidence.capturedByProfileId,
    supersedesVersion: current?.version ?? null,
    isCurrent: true,
  };

  return { ok: true, version: created, error: null };
}

export function supersedeDeliverableVersions(
  versions: readonly DesignDeliverableVersion[],
  deliverableId: string,
  newCurrentVersion: number
): readonly DesignDeliverableVersion[] {
  return versions.map((version) => {
    if (version.deliverableId !== deliverableId) {
      return version;
    }
    return {
      ...version,
      isCurrent: version.version === newCurrentVersion,
    };
  });
}
