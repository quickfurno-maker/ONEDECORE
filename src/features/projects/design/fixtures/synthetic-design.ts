/**
 * Phase 8B — synthetic design workspace fixtures (no persistence).
 */

import type { ProjectEvidenceRef } from "../../contracts/evidence.ts";
import type { ProjectStaffingSnapshot } from "../../contracts/assignment.ts";
import type { DesignState } from "../../contracts/design-states.ts";
import type { DesignDeliverableVersion } from "../domain/versioned-deliverables.ts";

export interface SyntheticDesignWorkspace {
  readonly projectReference: string;
  readonly designState: DesignState;
  readonly heldFromState: DesignState | null;
  readonly staffing: ProjectStaffingSnapshot;
  readonly deliverableVersions: readonly DesignDeliverableVersion[];
  readonly evidence: readonly ProjectEvidenceRef[];
}

function evidence(
  partial: Omit<ProjectEvidenceRef, "note" | "supersedesEvidenceRef"> & {
    note?: string | null;
    supersedesEvidenceRef?: string | null;
  }
): ProjectEvidenceRef {
  return {
    note: partial.note ?? null,
    supersedesEvidenceRef: partial.supersedesEvidenceRef ?? null,
    ...partial,
  };
}

export function buildEmptyDesignStaffing(): ProjectStaffingSnapshot {
  return {
    primaryProjectManager: null,
    leadDesigner: null,
    supportingDesigners: [],
  };
}

export function buildLeadDesignerStaffing(): ProjectStaffingSnapshot {
  return {
    primaryProjectManager: {
      staffProfileId: "pm-1",
      displayName: "Priya Mehta",
      role: "primary_project_manager",
      assignedAt: "2026-08-07T09:00:00.000Z",
      assignedByProfileId: "sm-1",
    },
    leadDesigner: {
      staffProfileId: "ld-1",
      displayName: "Ananya Rao",
      role: "lead_designer",
      assignedAt: "2026-08-07T10:00:00.000Z",
      assignedByProfileId: "sm-1",
    },
    supportingDesigners: [
      {
        staffProfileId: "sd-1",
        displayName: "Rohan Das",
        role: "supporting_designer",
        assignedAt: "2026-08-07T10:05:00.000Z",
        assignedByProfileId: "sm-1",
      },
    ],
  };
}

export function buildClientApprovalEvidence(): ProjectEvidenceRef {
  return evidence({
    evidenceRef: "ev-client-approval-1",
    evidenceType: "client_approval",
    version: 1,
    capturedAt: "2026-08-07T12:00:00.000Z",
    capturedByProfileId: "ld-1",
    note: "Client signed approval pack via email.",
  });
}

export function buildProductionReadyEvidence(): ProjectEvidenceRef {
  return evidence({
    evidenceRef: "ev-production-ready-1",
    evidenceType: "production_ready",
    version: 1,
    capturedAt: "2026-08-07T15:00:00.000Z",
    capturedByProfileId: "ld-1",
    note: "Lead designer verified production drawing set.",
  });
}

export function buildDesignDeliverableEvidence(
  version: number
): ProjectEvidenceRef {
  return evidence({
    evidenceRef: `ev-deliverable-v${version}`,
    evidenceType: "design_deliverable",
    version,
    capturedAt: `2026-08-07T1${version}:00:00.000Z`,
    capturedByProfileId: "ld-1",
    note: `Concept board version ${version}.`,
  });
}

export function buildSyntheticDesignWorkspace(
  overrides: Partial<SyntheticDesignWorkspace> = {}
): SyntheticDesignWorkspace {
  return {
    projectReference: "OD-P-2026-0042",
    designState: "concept_design",
    heldFromState: null,
    staffing: buildLeadDesignerStaffing(),
    deliverableVersions: [],
    evidence: [],
    ...overrides,
  };
}

export function buildDesignOnHoldWorkspace(): SyntheticDesignWorkspace {
  return buildSyntheticDesignWorkspace({
    designState: "design_on_hold",
    heldFromState: "client_review",
  });
}

export function buildRevisionRequiredWorkspace(): SyntheticDesignWorkspace {
  return buildSyntheticDesignWorkspace({
    designState: "revision_required",
  });
}

export function buildProductionReadyWorkspace(): SyntheticDesignWorkspace {
  return buildSyntheticDesignWorkspace({
    designState: "production_drawings",
    evidence: [buildProductionReadyEvidence()],
  });
}
