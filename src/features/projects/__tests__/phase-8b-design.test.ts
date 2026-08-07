/**
 * Phase 8B — design workflow domain and UI contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  DESIGN_MAIN_PATH_STATES,
  DESIGN_STATES,
  getDesignStateLabel,
  isDesignTerminalState,
} from "../contracts/design-states.ts";
import {
  canTransitionDesignState,
  getPermittedDesignTransitions,
  validateDesignTransition,
} from "../design/domain/design-state-machine.ts";
import {
  applyDesignerAssignmentChange,
  validateDesignerAssignmentChange,
  validateDesignerStaffingSnapshot,
} from "../design/domain/designer-staffing-validator.ts";
import { validateClientApprovalEvidence } from "../design/domain/client-approval-evidence.ts";
import { validateProductionReadyTransition } from "../design/domain/production-ready-validator.ts";
import {
  registerDeliverableVersion,
  supersedeDeliverableVersions,
} from "../design/domain/versioned-deliverables.ts";
import {
  buildClientApprovalEvidence,
  buildDesignDeliverableEvidence,
  buildDesignOnHoldWorkspace,
  buildEmptyDesignStaffing,
  buildLeadDesignerStaffing,
  buildProductionReadyEvidence,
  buildProductionReadyWorkspace,
  buildRevisionRequiredWorkspace,
  buildSyntheticDesignWorkspace,
} from "../design/fixtures/synthetic-design.ts";

const root = process.cwd();

describe("Phase 8B design state contracts", () => {
  test("all ADR-0020 design states are defined", () => {
    assert.deepEqual(DESIGN_MAIN_PATH_STATES, [
      "brief_received",
      "measurement_pending",
      "measurement_completed",
      "concept_design",
      "internal_review",
      "client_review",
      "client_approved",
      "production_drawings",
      "production_ready",
      "design_completed",
    ]);
    assert.equal(DESIGN_STATES.length, 12);
    assert.equal(getDesignStateLabel("client_review"), "Client Review");
  });

  test("only design_completed is terminal", () => {
    assert.equal(isDesignTerminalState("design_completed"), true);
    assert.equal(isDesignTerminalState("production_ready"), false);
    assert.equal(isDesignTerminalState("design_on_hold"), false);
  });
});

describe("Phase 8B design state machine", () => {
  test("main path transitions follow ADR-0020 sequence", () => {
    const path = DESIGN_MAIN_PATH_STATES;
    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index]!;
      const to = path[index + 1]!;
      assert.equal(canTransitionDesignState(from, to), true, `${from} -> ${to}`);
    }
  });

  test("revision branches from internal and client review only", () => {
    assert.equal(canTransitionDesignState("internal_review", "revision_required"), true);
    assert.equal(canTransitionDesignState("client_review", "revision_required"), true);
    assert.equal(canTransitionDesignState("concept_design", "revision_required"), false);
  });

  test("revision returns to appropriate design stages", () => {
    assert.equal(
      canTransitionDesignState("revision_required", "concept_design"),
      true
    );
    assert.equal(
      canTransitionDesignState("revision_required", "internal_review", {
        revisionReturnState: "internal_review",
      }),
      true
    );
    assert.equal(
      canTransitionDesignState("revision_required", "client_review"),
      false
    );
  });

  test("design on hold from active stages and resumes to held state", () => {
    assert.equal(canTransitionDesignState("client_review", "design_on_hold"), true);
    assert.equal(canTransitionDesignState("design_completed", "design_on_hold"), false);
    assert.equal(
      canTransitionDesignState("design_on_hold", "client_review", {
        heldFromState: "client_review",
      }),
      true
    );
    const invalidResume = validateDesignTransition("design_on_hold", "concept_design", {
      heldFromState: "client_review",
    });
    assert.equal(invalidResume.ok, false);
  });

  test("terminal state blocks further transitions", () => {
    assert.equal(canTransitionDesignState("design_completed", "production_ready"), false);
    const result = validateDesignTransition("design_completed", "production_ready");
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "PROJECT_TERMINAL_STATE");
  });

  test("permitted transitions include hold branch when eligible", () => {
    const permitted = getPermittedDesignTransitions("concept_design");
    assert.ok(permitted.includes("internal_review"));
    assert.ok(permitted.includes("design_on_hold"));
  });
});

describe("Phase 8B designer staffing validator", () => {
  test("valid lead and supporting staffing passes", () => {
    const result = validateDesignerStaffingSnapshot(buildLeadDesignerStaffing());
    assert.equal(result.ok, true);
  });

  test("duplicate lead designer rejected", () => {
    const staffing = buildLeadDesignerStaffing();
    const duplicate = {
      ...staffing,
      supportingDesigners: [
        ...staffing.supportingDesigners,
        {
          staffProfileId: staffing.leadDesigner!.staffProfileId,
          displayName: "Duplicate",
          role: "supporting_designer" as const,
          assignedAt: "2026-08-07T11:00:00.000Z",
          assignedByProfileId: "sm-1",
        },
      ],
    };
    const result = validateDesignerStaffingSnapshot(duplicate);
    assert.equal(result.ok, false);
  });

  test("sales manager may assign designers; PM and designer may not", () => {
    const staffing = buildEmptyDesignStaffing();
    const smResult = validateDesignerAssignmentChange({
      action: "assign_lead",
      actorRole: "sales_manager",
      actorProfileId: "sm-1",
      targetProfileId: "ld-1",
      currentStaffing: staffing,
    });
    assert.equal(smResult.ok, true);

    const pmResult = validateDesignerAssignmentChange({
      action: "assign_lead",
      actorRole: "project_manager",
      actorProfileId: "pm-1",
      targetProfileId: "ld-1",
      currentStaffing: staffing,
    });
    assert.equal(pmResult.ok, false);
    assert.equal(pmResult.error?.code, "PROJECT_UNAUTHORIZED");

    const designerResult = validateDesignerAssignmentChange({
      action: "assign_supporting",
      actorRole: "designer",
      actorProfileId: "d-1",
      targetProfileId: "sd-1",
      currentStaffing: staffing,
    });
    assert.equal(designerResult.ok, false);
  });

  test("applyDesignerAssignmentChange assigns lead designer", () => {
    const change = {
      action: "assign_lead" as const,
      actorRole: "sales_manager" as const,
      actorProfileId: "sm-1",
      targetProfileId: "ld-1",
      currentStaffing: buildEmptyDesignStaffing(),
    };
    const result = applyDesignerAssignmentChange(change, {
      staffProfileId: "ld-1",
      displayName: "Lead Designer",
      assignedAt: "2026-08-07T10:00:00.000Z",
      assignedByProfileId: "sm-1",
    });
    assert.ok(!("ok" in result));
    assert.equal(result.leadDesigner?.staffProfileId, "ld-1");
  });
});

describe("Phase 8B client approval evidence", () => {
  test("client_approved requires client_approval evidence", () => {
    const missing = validateClientApprovalEvidence({
      targetState: "client_approved",
      evidence: null,
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.error?.code, "PROJECT_MISSING_EVIDENCE");

    const valid = validateClientApprovalEvidence({
      targetState: "client_approved",
      evidence: buildClientApprovalEvidence(),
    });
    assert.equal(valid.ok, true);
  });

  test("non-approval states do not require client evidence", () => {
    const result = validateClientApprovalEvidence({
      targetState: "concept_design",
      evidence: null,
    });
    assert.equal(result.ok, true);
  });
});

describe("Phase 8B production ready validator", () => {
  test("requires lead designer authority and production_ready evidence", () => {
    const workspace = buildProductionReadyWorkspace();
    const missingEvidence = validateProductionReadyTransition({
      targetState: "production_ready",
      actor: {
        profileId: "ld-1",
        role: "designer",
        isAssignedPrimaryPm: false,
        isAssignedLeadDesigner: true,
        isAssignedSupportingDesigner: false,
        isOwningSalesExecutive: false,
      },
      staffing: workspace.staffing,
      evidence: null,
    });
    assert.equal(missingEvidence.ok, false);

    const valid = validateProductionReadyTransition({
      targetState: "production_ready",
      actor: {
        profileId: "ld-1",
        role: "designer",
        isAssignedPrimaryPm: false,
        isAssignedLeadDesigner: true,
        isAssignedSupportingDesigner: false,
        isOwningSalesExecutive: false,
      },
      staffing: workspace.staffing,
      evidence: buildProductionReadyEvidence(),
    });
    assert.equal(valid.ok, true);
  });

  test("supporting designer cannot approve production ready", () => {
    const result = validateProductionReadyTransition({
      targetState: "production_ready",
      actor: {
        profileId: "sd-1",
        role: "designer",
        isAssignedPrimaryPm: false,
        isAssignedLeadDesigner: false,
        isAssignedSupportingDesigner: true,
        isOwningSalesExecutive: false,
      },
      staffing: buildLeadDesignerStaffing(),
      evidence: buildProductionReadyEvidence(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.error?.code, "PROJECT_UNAUTHORIZED");
  });
});

describe("Phase 8B versioned deliverables", () => {
  test("registers sequential versions without overwrite", () => {
    const first = registerDeliverableVersion({
      deliverableId: "concept-board",
      kind: "concept_board",
      label: "Concept board v1",
      evidence: buildDesignDeliverableEvidence(1),
      existingVersions: [],
    });
    assert.equal(first.ok, true);
    assert.equal(first.version?.version, 1);

    const second = registerDeliverableVersion({
      deliverableId: "concept-board",
      kind: "concept_board",
      label: "Concept board v2",
      evidence: buildDesignDeliverableEvidence(2),
      existingVersions: first.version ? [first.version] : [],
    });
    assert.equal(second.ok, true);
    assert.equal(second.version?.supersedesVersion, 1);

    const overwrite = registerDeliverableVersion({
      deliverableId: "concept-board",
      kind: "concept_board",
      label: "Concept board v2 duplicate",
      evidence: buildDesignDeliverableEvidence(2),
      existingVersions: first.version ? [first.version, second.version!] : [],
    });
    assert.equal(overwrite.ok, false);
    assert.match(overwrite.error?.message ?? "", /overwritten/i);
  });

  test("supersedeDeliverableVersions marks current version", () => {
    const v1 = registerDeliverableVersion({
      deliverableId: "drawing-set",
      kind: "production_drawing",
      label: "Drawing v1",
      evidence: buildDesignDeliverableEvidence(1),
      existingVersions: [],
    }).version!;
    const v2 = registerDeliverableVersion({
      deliverableId: "drawing-set",
      kind: "production_drawing",
      label: "Drawing v2",
      evidence: buildDesignDeliverableEvidence(2),
      existingVersions: [v1],
    }).version!;
    const updated = supersedeDeliverableVersions([v1, v2], "drawing-set", 2);
    assert.equal(updated.find((v) => v.version === 2)?.isCurrent, true);
    assert.equal(updated.find((v) => v.version === 1)?.isCurrent, false);
  });
});

describe("Phase 8B synthetic fixtures", () => {
  test("buildSyntheticDesignWorkspace defaults to concept design", () => {
    const workspace = buildSyntheticDesignWorkspace();
    assert.equal(workspace.designState, "concept_design");
    assert.equal(workspace.staffing.leadDesigner?.staffProfileId, "ld-1");
  });

  test("hold and revision fixtures expose branch metadata", () => {
    const hold = buildDesignOnHoldWorkspace();
    assert.equal(hold.designState, "design_on_hold");
    assert.equal(hold.heldFromState, "client_review");

    const revision = buildRevisionRequiredWorkspace();
    assert.equal(revision.designState, "revision_required");
  });
});

describe("Phase 8B component contracts", () => {
  const componentPaths = [
    "src/features/projects/components/design/DesignWorkspaceShell.tsx",
    "src/features/projects/components/design/DesignerTeamPanel.tsx",
    "src/features/projects/components/design/DesignStageTimeline.tsx",
    "src/features/projects/components/design/DesignEvidencePanel.tsx",
    "src/features/projects/components/design/DesignRevisionPanel.tsx",
    "src/features/projects/components/design/ClientApprovalPanel.tsx",
    "src/features/projects/components/design/ProductionReadyPanel.tsx",
    "src/features/projects/components/design/DesignHoldBanner.tsx",
  ] as const;

  for (const rel of componentPaths) {
    test(`${rel} is callback-driven without persistence`, () => {
      const src = readFileSync(join(root, rel), "utf8");
      assert.match(src, /callbacks/);
      assert.doesNotMatch(src, /supabase/i);
      assert.doesNotMatch(src, /fetch\(/i);
    });
  }

  test("revision panel requires note and exposes aria-live status", () => {
    const src = readFileSync(
      join(root, "src/features/projects/components/design/DesignRevisionPanel.tsx"),
      "utf8"
    );
    assert.match(src, /aria-live/);
    assert.match(src, /if \(pending\)/);
    assert.match(src, /10 characters/);
  });

  test("production ready panel requires lead designer label", () => {
    const src = readFileSync(
      join(root, "src/features/projects/components/design/ProductionReadyPanel.tsx"),
      "utf8"
    );
    assert.match(src, /leadDesignerName/);
    assert.match(src, /onApproveProductionReady/);
  });

  test("no design routes activated", () => {
    assert.equal(
      (() => {
        try {
          readFileSync(join(root, "src/app/projects/design/page.tsx"), "utf8");
          return true;
        } catch {
          return false;
        }
      })(),
      false
    );
  });
});
