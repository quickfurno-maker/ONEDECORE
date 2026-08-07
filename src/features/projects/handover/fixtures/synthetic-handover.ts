/**
 * Privacy-safe synthetic handover fixtures for tests and UI prebuild.
 */

import { createProjectRef, type ProjectRef } from "../../contracts/reference.ts";
import type { ProjectCommercialSnapshotView } from "../../contracts/commercial.ts";
import type { ProjectHandoverState } from "../../contracts/lifecycle.ts";
import type { ProjectStaffingSnapshot } from "../../contracts/assignment.ts";
import type { ProjectSummary } from "../../contracts/summary.ts";
import type { ProjectEvidenceRef } from "../../contracts/evidence.ts";

const FIXTURE_TIMESTAMP = "2026-08-07T10:00:00.000Z";

export interface SyntheticHandoverFixture {
  readonly ref: ProjectRef;
  readonly summary: ProjectSummary;
  readonly handoverState: ProjectHandoverState;
  readonly commercial: ProjectCommercialSnapshotView;
  readonly staffing: ProjectStaffingSnapshot;
  readonly handoverEvidence: ProjectEvidenceRef | null;
}

function commercialSnapshot(
  quotationReference: string,
  revisionNumber: number,
  taxableBasePaise: number,
  grandTotalPaise: number
): ProjectCommercialSnapshotView {
  return {
    quotationReference,
    revisionNumber,
    acceptedAt: FIXTURE_TIMESTAMP,
    currency: "INR",
    taxableBasePaise,
    grandTotalPaise,
    grandTotalLabel: `₹${(grandTotalPaise / 100).toLocaleString("en-IN")}`,
    scopeSummary: "Modular kitchen and wardrobe scope — synthetic fixture",
    contentHash: `fixture-hash-${quotationReference}-r${revisionNumber}`,
  };
}

function summary(
  projectReference: string,
  leadReference: string,
  handoverState: ProjectHandoverState,
  primaryProjectManagerId: string | null
): ProjectSummary {
  return {
    ref: createProjectRef({
      projectReference,
      leadReference,
      acceptedQuotationReference: `OD-Q-${projectReference.slice(-4)}`,
      acceptedRevisionNumber: 1,
    }),
    clientDisplayName: "Sample Client A",
    projectLabel: "Kitchen & Wardrobe — Fixture",
    handoverState,
    highLevelStatusLabel: handoverStateLabel(handoverState),
    owningSalesExecutiveId: "se-fixture-001",
    primaryProjectManagerId,
    leadDesignerId: null,
    createdAt: FIXTURE_TIMESTAMP,
  };
}

function handoverStateLabel(state: ProjectHandoverState): string {
  switch (state) {
    case "awaiting_project_manager_assignment":
      return "Awaiting PM assignment";
    case "awaiting_project_manager_acceptance":
      return "Awaiting PM acceptance";
    case "handover_accepted":
      return "Handover accepted";
    default:
      return state;
  }
}

export function buildAwaitingPmAssignmentFixture(): SyntheticHandoverFixture {
  const projectReference = "OD-P-2026-0101";
  const staffing: ProjectStaffingSnapshot = {
    primaryProjectManager: null,
    leadDesigner: null,
    supportingDesigners: [],
  };

  return {
    ref: createProjectRef({
      projectReference,
      leadReference: "OD-L-2026-0101",
      acceptedQuotationReference: "OD-Q-2026-0101",
      acceptedRevisionNumber: 1,
    }),
    summary: summary(projectReference, "OD-L-2026-0101", "awaiting_project_manager_assignment", null),
    handoverState: "awaiting_project_manager_assignment",
    commercial: commercialSnapshot("OD-Q-2026-0101", 1, 145000000, 17050400),
    staffing,
    handoverEvidence: null,
  };
}

export function buildAwaitingPmAcceptanceFixture(): SyntheticHandoverFixture {
  const projectReference = "OD-P-2026-0102";
  const staffing: ProjectStaffingSnapshot = {
    primaryProjectManager: {
      staffProfileId: "pm-fixture-001",
      displayName: "Fixture PM One",
      role: "primary_project_manager",
      assignedAt: FIXTURE_TIMESTAMP,
      assignedByProfileId: "sm-fixture-001",
    },
    leadDesigner: null,
    supportingDesigners: [],
  };

  return {
    ref: createProjectRef({
      projectReference,
      leadReference: "OD-L-2026-0102",
      acceptedQuotationReference: "OD-Q-2026-0102",
      acceptedRevisionNumber: 2,
    }),
    summary: summary(
      projectReference,
      "OD-L-2026-0102",
      "awaiting_project_manager_acceptance",
      "pm-fixture-001"
    ),
    handoverState: "awaiting_project_manager_acceptance",
    commercial: commercialSnapshot("OD-Q-2026-0102", 2, 98000000, 11564000),
    staffing,
    handoverEvidence: null,
  };
}

export function buildHandoverAcceptedFixture(): SyntheticHandoverFixture {
  const projectReference = "OD-P-2026-0103";
  const staffing: ProjectStaffingSnapshot = {
    primaryProjectManager: {
      staffProfileId: "pm-fixture-001",
      displayName: "Fixture PM One",
      role: "primary_project_manager",
      assignedAt: FIXTURE_TIMESTAMP,
      assignedByProfileId: "sm-fixture-001",
    },
    leadDesigner: null,
    supportingDesigners: [],
  };

  const handoverEvidence: ProjectEvidenceRef = {
    evidenceRef: "ev-handover-fixture-001",
    evidenceType: "handover_acknowledgement",
    version: 1,
    capturedAt: FIXTURE_TIMESTAMP,
    capturedByProfileId: "pm-fixture-001",
    note: "Scope and commercial summary reviewed — synthetic fixture",
    supersedesEvidenceRef: null,
  };

  return {
    ref: createProjectRef({
      projectReference,
      leadReference: "OD-L-2026-0103",
      acceptedQuotationReference: "OD-Q-2026-0103",
      acceptedRevisionNumber: 1,
    }),
    summary: summary(
      projectReference,
      "OD-L-2026-0103",
      "handover_accepted",
      "pm-fixture-001"
    ),
    handoverState: "handover_accepted",
    commercial: commercialSnapshot("OD-Q-2026-0103", 1, 210000000, 24780000),
    staffing,
    handoverEvidence,
  };
}

export function buildHandoverEvidenceFixture(): ProjectEvidenceRef {
  return {
    evidenceRef: "ev-handover-fixture-accept",
    evidenceType: "handover_acknowledgement",
    version: 1,
    capturedAt: FIXTURE_TIMESTAMP,
    capturedByProfileId: "pm-fixture-001",
    note: "Commercial snapshot and scope reviewed — fixture acknowledgement",
    supersedesEvidenceRef: null,
  };
}

export const SYNTHETIC_HANDOVER_FIXTURE_PROFILES = {
  superAdmin: { profileId: "sa-fixture-001", role: "super_admin" as const },
  salesManager: { profileId: "sm-fixture-001", role: "sales_manager" as const },
  salesExecutive: { profileId: "se-fixture-001", role: "sales_executive" as const },
  primaryPm: { profileId: "pm-fixture-001", role: "project_manager" as const },
  otherPm: { profileId: "pm-fixture-002", role: "project_manager" as const },
  designer: { profileId: "d-fixture-001", role: "designer" as const },
};
