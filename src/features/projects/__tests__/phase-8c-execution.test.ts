/**
 * Phase 8C — execution workspace domain and UI contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  EXECUTION_MAIN_PATH_STATES,
  getNextMainPathState,
  type ExecutionState,
} from "../execution/contracts/execution-states.ts";
import {
  canTransitionExecutionState,
  getAllowedExecutionTransitions,
  walkMainExecutionPath,
} from "../execution/domain/execution-state-machine.ts";
import {
  canActorRequestExecutionTransition,
  canActorUpdateExecutionStages,
  deniesPmExecutionControlForDesigner,
  deniesPmExecutionControlForSalesExecutive,
  deniesUnassignedProjectManager,
  resolveExecutionWorkspaceAccess,
} from "../execution/domain/pm-execution-authority.ts";
import {
  buildExecutionHoldRecord,
  canResumeExecutionHold,
  validateExecutionHoldRecord,
} from "../execution/domain/hold-delay-contract.ts";
import {
  buildSnagSummary,
  validateSnagItem,
} from "../execution/domain/snag-contract.ts";
import {
  canTransitionToCompleted,
  canTransitionToHandover,
  validateCompletionAcknowledgement,
  validateHandoverAcknowledgement,
} from "../execution/domain/handover-completion.ts";
import {
  buildAssignedPmActor,
  buildLeadDesignerActor,
  buildOtherPmActor,
  buildSalesExecutiveActor,
  buildSyntheticActiveExecutionProject,
  buildSyntheticCancelledProject,
  buildSyntheticCompletedProject,
  buildSyntheticCompletionAcknowledgement,
  buildSyntheticExecutionHoldProject,
  buildSyntheticHandoverAcknowledgement,
  buildSyntheticHandoverProject,
  buildSyntheticSnagFixture,
  buildSyntheticSnagResolutionProject,
} from "../execution/fixtures/synthetic-execution.ts";

const root = process.cwd();

describe("Phase 8C execution main path", () => {
  test("walks full ADR-0020 execution sequence", () => {
    assert.deepEqual(walkMainExecutionPath(), EXECUTION_MAIN_PATH_STATES);
    assert.equal(EXECUTION_MAIN_PATH_STATES.length, 12);
    assert.equal(EXECUTION_MAIN_PATH_STATES[0], "project_created");
    assert.equal(EXECUTION_MAIN_PATH_STATES.at(-1), "completed");
  });

  test("allows adjacent forward transitions with evidence when required", () => {
    let state: ExecutionState = EXECUTION_MAIN_PATH_STATES[0];
    for (let index = 1; index < EXECUTION_MAIN_PATH_STATES.length; index += 1) {
      const next = EXECUTION_MAIN_PATH_STATES[index];
      const needsEvidence = next !== "design_development" && next !== "production";
      const result = canTransitionExecutionState(state, next, {
        evidenceRefs: needsEvidence ? ["ev-test"] : [],
      });
      assert.equal(result.allowed, true, `${state} → ${next}`);
      state = next;
    }
  });

  test("denies invalid skip transitions", () => {
    const result = canTransitionExecutionState("project_created", "production");
    assert.equal(result.allowed, false);
    assert.equal(result.error?.code, "PROJECT_INVALID_TRANSITION");
  });

  test("completed is terminal", () => {
    const allowed = getAllowedExecutionTransitions("completed");
    assert.deepEqual(allowed, []);
    const holdAttempt = canTransitionExecutionState("completed", "on_hold", {
      reason: "Should not be possible for completed project.",
    });
    assert.equal(holdAttempt.allowed, false);
  });
});

describe("Phase 8C hold and cancel branches", () => {
  test("hold requires reason and blocks completed", () => {
    const missingReason = canTransitionExecutionState("production", "on_hold", {
      reason: "short",
    });
    assert.equal(missingReason.allowed, false);
    assert.equal(missingReason.error?.code, "PROJECT_MISSING_REASON");

    const allowed = canTransitionExecutionState("production", "on_hold", {
      reason: "Client requested pause pending kitchen layout confirmation.",
    });
    assert.equal(allowed.allowed, true);

    const completedHold = canTransitionExecutionState("completed", "on_hold", {
      reason: "Attempting to hold after completion.",
    });
    assert.equal(completedHold.allowed, false);
  });

  test("resume from hold returns to recorded target", () => {
    const holdProject = buildSyntheticExecutionHoldProject();
    assert.ok(holdProject.holdRecord);
    const resume = canTransitionExecutionState(
      "on_hold",
      holdProject.holdRecord.resumeTarget,
      { resumeTarget: holdProject.holdRecord.resumeTarget }
    );
    assert.equal(resume.allowed, true);
    assert.equal(
      canResumeExecutionHold("on_hold", holdProject.holdRecord),
      true
    );
  });

  test("cancelled is terminal with reason and authority contract", () => {
    const missingReason = canTransitionExecutionState("installation", "cancelled", {
      reason: "too short",
    });
    assert.equal(missingReason.allowed, false);

    const allowed = canTransitionExecutionState("installation", "cancelled", {
      reason: "Client relocation — project cannot proceed on current site.",
    });
    assert.equal(allowed.allowed, true);

    const cancelled = buildSyntheticCancelledProject();
    assert.equal(cancelled.executionState, "cancelled");
    assert.deepEqual(getAllowedExecutionTransitions("cancelled"), []);
  });

  test("hold record validation enforces resume target", () => {
    const record = buildExecutionHoldRecord({
      holdId: "hold-1",
      reasonCode: "material_delay",
      humanNote: "Factory batch delayed beyond agreed lead time.",
      enteredFromState: "production",
      enteredAt: "2026-08-07T00:00:00.000Z",
      enteredByProfileId: "pm-synth-001",
      actorCanUpdateExecution: true,
    });
    assert.equal(validateExecutionHoldRecord(record), null);
  });
});

describe("Phase 8C PM execution authority", () => {
  const handoverAccepted = "handover_accepted" as const;

  test("assigned PM may update execution after handover acceptance", () => {
    const context = {
      actor: buildAssignedPmActor(),
      handoverState: handoverAccepted,
    };
    assert.equal(canActorUpdateExecutionStages(context), true);
    assert.equal(resolveExecutionWorkspaceAccess(context), "full");
  });

  test("other PM is denied", () => {
    const context = {
      actor: buildOtherPmActor(),
      handoverState: handoverAccepted,
    };
    assert.equal(canActorUpdateExecutionStages(context), false);
    assert.equal(deniesUnassignedProjectManager(context), true);
  });

  test("sales executive is read-only", () => {
    const context = {
      actor: buildSalesExecutiveActor(),
      handoverState: handoverAccepted,
    };
    assert.equal(canActorUpdateExecutionStages(context), false);
    assert.equal(resolveExecutionWorkspaceAccess(context), "high_level");
    assert.equal(deniesPmExecutionControlForSalesExecutive(context), true);
  });

  test("designer has no execution control", () => {
    const context = {
      actor: buildLeadDesignerActor(),
      handoverState: handoverAccepted,
    };
    assert.equal(canActorUpdateExecutionStages(context), false);
    assert.equal(deniesPmExecutionControlForDesigner(context), true);
  });

  test("PM denied before handover acceptance", () => {
    const context = {
      actor: buildAssignedPmActor(),
      handoverState: "awaiting_project_manager_acceptance" as const,
    };
    assert.equal(canActorUpdateExecutionStages(context), false);
  });

  test("unauthorized actor cannot request transition", () => {
    const result = canActorRequestExecutionTransition(
      {
        actor: buildSalesExecutiveActor(),
        handoverState: handoverAccepted,
      },
      {
        fromState: "production",
        toState: "ready_for_dispatch",
        evidenceRefs: ["ev-1"],
      }
    );
    assert.equal(result.allowed, false);
    assert.equal(result.error?.code, "PROJECT_UNAUTHORIZED");
  });
});

describe("Phase 8C snag and handover contracts", () => {
  test("snag summary counts open items", () => {
    const summary = buildSnagSummary(buildSyntheticSnagFixture());
    assert.equal(summary.total, 2);
    assert.equal(summary.open, 1);
    assert.equal(summary.blockingHandover, true);
  });

  test("resolved snag requires evidence metadata", () => {
    const invalid = validateSnagItem({
      snagRef: "snag-1",
      description: "Gap at filler panel.",
      status: "resolved",
      evidenceRefs: [],
      createdAt: "2026-08-07T00:00:00.000Z",
      createdByProfileId: "pm-1",
      resolvedAt: null,
      resolvedByProfileId: null,
    });
    assert.match(invalid ?? "", /Resolved snags require/);
  });

  test("handover acknowledgement validates checklist", () => {
    const valid = validateHandoverAcknowledgement(buildSyntheticHandoverAcknowledgement());
    assert.equal(valid, null);

    const handoverProject = buildSyntheticHandoverProject();
    const gate = canTransitionToHandover(
      "snag_resolution",
      buildSnagSummary(handoverProject.snags),
      ["ev-handover"]
    );
    assert.equal(gate.allowed, true);
  });

  test("completion acknowledgement is terminal guard", () => {
    const acknowledgement = buildSyntheticCompletionAcknowledgement();
    assert.equal(validateCompletionAcknowledgement(acknowledgement), null);

    const completed = buildSyntheticCompletedProject();
    assert.equal(completed.executionState, "completed");

    const gate = canTransitionToCompleted(
      "handover",
      acknowledgement,
      ["ev-completion"]
    );
    assert.equal(gate.allowed, true);
  });

  test("open snags block handover transition", () => {
    const snagProject = buildSyntheticSnagResolutionProject();
    const gate = canTransitionToHandover(
      "snag_resolution",
      buildSnagSummary(snagProject.snags),
      ["ev-handover"]
    );
    assert.equal(gate.allowed, false);
  });
});

describe("Phase 8C synthetic fixtures", () => {
  test("active, hold, snag, handover, completed, and cancelled fixtures", () => {
    assert.equal(buildSyntheticActiveExecutionProject().executionState, "production");
    assert.equal(buildSyntheticExecutionHoldProject().executionState, "on_hold");
    assert.equal(buildSyntheticSnagResolutionProject().snags.length, 2);
    assert.equal(buildSyntheticHandoverProject().executionState, "handover");
    assert.equal(buildSyntheticCompletedProject().executionState, "completed");
    assert.equal(buildSyntheticCancelledProject().executionState, "cancelled");
  });

  test("next main path helper is sequential", () => {
    assert.equal(getNextMainPathState("project_created"), "site_measurement");
    assert.equal(getNextMainPathState("completed"), null);
  });
});

describe("Phase 8C UI component contracts", () => {
  test("execution workspace composes child panels with callbacks only", () => {
    const src = readFileSync(
      join(root, "src/features/projects/components/execution/ProjectExecutionWorkspace.tsx"),
      "utf8"
    );
    assert.match(src, /ExecutionStageTimeline/);
    assert.match(src, /StageTransitionPanel/);
    assert.match(src, /ProjectHoldPanel/);
    assert.match(src, /onStageTransition/);
    assert.match(src, /onEnterHold/);
    assert.match(src, /onResumeHold/);
    assert.doesNotMatch(src, /supabase/i);
    assert.doesNotMatch(src, /purchase order|procurement|inventory|warehouse|gst filing/i);
  });

  test("stage transition panel guards pending actions", () => {
    const src = readFileSync(
      join(root, "src/features/projects/components/execution/StageTransitionPanel.tsx"),
      "utf8"
    );
    assert.match(src, /if \(pending/);
    assert.match(src, /aria-live/);
    assert.match(src, /Advance to next stage/);
  });

  test("hold panel exposes reason code and resume", () => {
    const src = readFileSync(
      join(root, "src/features/projects/components/execution/ProjectHoldPanel.tsx"),
      "utf8"
    );
    assert.match(src, /EXECUTION_HOLD_REASON_CODES/);
    assert.match(src, /Resume execution/);
    assert.match(src, /aria-label="Hold reason code"/);
  });

  test("snag list resolves via callback with evidence", () => {
    const src = readFileSync(
      join(root, "src/features/projects/components/execution/SnagList.tsx"),
      "utf8"
    );
    assert.match(src, /onResolveSnag/);
    assert.match(src, /Evidence reference is required/);
  });

  test("client update preview requires human review banner", () => {
    const src = readFileSync(
      join(root, "src/features/projects/components/execution/ProjectClientUpdatePreview.tsx"),
      "utf8"
    );
    assert.match(src, /Human review required/);
    assert.match(src, /draft\.draftText/);
  });

  test("no execution admin routes activated", () => {
    assert.equal(
      (() => {
        try {
          readFileSync(join(root, "src/app/admin/projects/execution/page.tsx"), "utf8");
          return true;
        } catch {
          return false;
        }
      })(),
      false
    );
  });
});

describe("Phase 8C no ERP guard", () => {
  test("execution domain files avoid ERP scope", () => {
    const paths = [
      "src/features/projects/execution/domain/execution-state-machine.ts",
      "src/features/projects/execution/domain/hold-delay-contract.ts",
      "src/features/projects/execution/domain/snag-contract.ts",
      "src/features/projects/components/execution/ProjectExecutionWorkspace.tsx",
    ];
    for (const rel of paths) {
      const src = readFileSync(join(root, rel), "utf8").toLowerCase();
      assert.doesNotMatch(src, /purchase order|procurement|inventory|warehouse|vendor payment|labour attendance|gst filing|accounting ledger/);
    }
  });
});
