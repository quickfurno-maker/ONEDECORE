/**
 * Phase 8 P0 — shared project delivery contract tests.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createProjectRef,
  isHandoverExecutionEligible,
  PROJECT_HANDOVER_STATES,
  PROJECT_STAGE_TRANSITION_ERROR_CODES,
  resolveProjectPermissionCapabilities,
  validateProjectEvidenceRef,
  validateProjectReference,
  PROJECT_COMMERCIAL_BOUNDARY_RULE,
} from "../contracts/index.ts";

describe("Phase 8 P0 project reference contracts", () => {
  test("validates project reference pattern", () => {
    assert.equal(validateProjectReference("OD-P-2026-0001"), null);
    assert.match(validateProjectReference("short") ?? "", /at least 10/);
    assert.match(validateProjectReference("INVALID-REF-001") ?? "", /OD-P-/);
  });

  test("creates project ref with accepted quotation linkage", () => {
    const ref = createProjectRef({
      projectReference: "OD-P-2026-0001",
      leadReference: "OD-L-2026-0042",
      acceptedQuotationReference: "OD-Q-2026-0007",
      acceptedRevisionNumber: 2,
    });
    assert.equal(ref.acceptedRevisionNumber, 2);
  });
});

describe("Phase 8 P0 handover lifecycle contracts", () => {
  test("handover states match ADR-0020 sequence", () => {
    assert.deepEqual(PROJECT_HANDOVER_STATES, [
      "awaiting_project_manager_assignment",
      "awaiting_project_manager_acceptance",
      "handover_accepted",
    ]);
  });

  test("execution eligible only after handover accepted", () => {
    assert.equal(
      isHandoverExecutionEligible("awaiting_project_manager_assignment"),
      false
    );
    assert.equal(
      isHandoverExecutionEligible("awaiting_project_manager_acceptance"),
      false
    );
    assert.equal(isHandoverExecutionEligible("handover_accepted"), true);
  });
});

describe("Phase 8 P0 permission capabilities", () => {
  test("sales manager can assign PM and designers", () => {
    const caps = resolveProjectPermissionCapabilities({
      profileId: "sm-1",
      role: "sales_manager",
      isAssignedPrimaryPm: false,
      isAssignedLeadDesigner: false,
      isAssignedSupportingDesigner: false,
      isOwningSalesExecutive: false,
    });
    assert.equal(caps.canAssignProjectManager, true);
    assert.equal(caps.canAssignDesigners, true);
    assert.equal(caps.canUpdateExecutionStages, false);
  });

  test("sales executive is read-only high-level for own won lead", () => {
    const caps = resolveProjectPermissionCapabilities({
      profileId: "se-1",
      role: "sales_executive",
      isAssignedPrimaryPm: false,
      isAssignedLeadDesigner: false,
      isAssignedSupportingDesigner: false,
      isOwningSalesExecutive: true,
    });
    assert.equal(caps.canAssignProjectManager, false);
    assert.equal(caps.canReadHighLevelStatus, true);
    assert.equal(caps.canReadFullProjectWorkspace, false);
    assert.equal(caps.canUpdateExecutionStages, false);
  });

  test("assigned PM can accept handover and update execution", () => {
    const caps = resolveProjectPermissionCapabilities({
      profileId: "pm-1",
      role: "project_manager",
      isAssignedPrimaryPm: true,
      isAssignedLeadDesigner: false,
      isAssignedSupportingDesigner: false,
      isOwningSalesExecutive: false,
    });
    assert.equal(caps.canAcceptPmHandover, true);
    assert.equal(caps.canUpdateExecutionStages, true);
    assert.equal(caps.canAssignDesigners, false);
    assert.equal(caps.canRequestDesignerAssignment, true);
  });

  test("lead designer can approve production ready; supporting cannot", () => {
    const lead = resolveProjectPermissionCapabilities({
      profileId: "d-1",
      role: "designer",
      isAssignedPrimaryPm: false,
      isAssignedLeadDesigner: true,
      isAssignedSupportingDesigner: false,
      isOwningSalesExecutive: false,
    });
    const supporting = resolveProjectPermissionCapabilities({
      profileId: "d-2",
      role: "designer",
      isAssignedPrimaryPm: false,
      isAssignedLeadDesigner: false,
      isAssignedSupportingDesigner: true,
      isOwningSalesExecutive: false,
    });
    assert.equal(lead.canApproveProductionReady, true);
    assert.equal(supporting.canApproveProductionReady, false);
    assert.equal(lead.canUpdateDesignWorkflow, true);
    assert.equal(supporting.canUpdateDesignWorkflow, false);
  });
});

describe("Phase 8 P0 evidence and transition contracts", () => {
  test("evidence ref validation bounds note length", () => {
    const error = validateProjectEvidenceRef({
      evidenceRef: "ev-1",
      evidenceType: "client_approval",
      version: 1,
      capturedAt: "2026-08-07T00:00:00.000Z",
      capturedByProfileId: "staff-1",
      note: "a".repeat(2001),
      supersedesEvidenceRef: null,
    });
    assert.match(error ?? "", /maximum length/);
  });

  test("transition error codes are normalized", () => {
    assert.ok(PROJECT_STAGE_TRANSITION_ERROR_CODES.includes("PROJECT_UNAUTHORIZED"));
    assert.ok(
      PROJECT_STAGE_TRANSITION_ERROR_CODES.includes("PROJECT_COMMERCIAL_PREREQUISITE")
    );
  });
});

describe("Phase 8 P0 commercial boundary", () => {
  test("documents no recalculation rule", () => {
    assert.match(PROJECT_COMMERCIAL_BOUNDARY_RULE, /Never recalculate/);
    assert.match(PROJECT_COMMERCIAL_BOUNDARY_RULE, /read-only/i);
  });
});
