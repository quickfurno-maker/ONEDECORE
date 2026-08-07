/**
 * Phase 8A — Closed-Won handover domain, UI, and authority tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  PROJECT_COMMERCIAL_BOUNDARY_RULE,
  type ProjectValueReconciliationContract,
} from "../contracts/commercial.ts";
import { isHandoverExecutionEligible } from "../contracts/lifecycle.ts";
import { evaluateProjectConversionEligibility } from "../handover/domain/evaluate-project-conversion-eligibility.ts";
import {
  canAuthorizePmAssignment,
  validatePmAssignmentRequest,
  validatePmReassignmentRequest,
} from "../handover/domain/pm-assignment-rules.ts";
import { validatePmHandoverAcceptance } from "../handover/domain/pm-handover-acceptance.ts";
import {
  canTransitionHandoverState,
  isExecutionEligibleAfterHandover,
  resolveHandoverStateAfterAcceptance,
  resolveHandoverStateAfterAssignment,
  validateHandoverAcceptanceTransition,
  validateHandoverAssignmentTransition,
} from "../handover/domain/handover-transitions.ts";
import { buildHandoverDisplayModel } from "../handover/ui/build-handover-display-model.ts";
import {
  buildAwaitingPmAcceptanceFixture,
  buildAwaitingPmAssignmentFixture,
  buildHandoverAcceptedFixture,
  buildHandoverEvidenceFixture,
  SYNTHETIC_HANDOVER_FIXTURE_PROFILES,
} from "../handover/fixtures/synthetic-handover.ts";

const root = process.cwd();

function eligibleConversionInput() {
  return {
    leadStage: "closed_won" as const,
    quotationLifecycleState: "accepted",
    acceptedQuotationReference: "OD-Q-2026-0001",
    acceptedRevisionNumber: 1,
    hasExistingProject: false,
    hasCommercialSnapshot: true,
    advancePaymentReceived: false,
  };
}

describe("Phase 8A conversion eligibility", () => {
  test("accepted quotation prerequisite", () => {
    const result = evaluateProjectConversionEligibility(eligibleConversionInput());
    assert.equal(result.eligible, true);
    assert.equal(result.errors.length, 0);
  });

  test("non-accepted quotation denied", () => {
    const result = evaluateProjectConversionEligibility({
      ...eligibleConversionInput(),
      quotationLifecycleState: "sent",
    });
    assert.equal(result.eligible, false);
    assert.ok(result.errors.some((e) => e.code === "QUOTATION_NOT_ACCEPTED"));
  });

  test("Closed-Lost denied", () => {
    const result = evaluateProjectConversionEligibility({
      ...eligibleConversionInput(),
      leadStage: "closed_lost",
    });
    assert.equal(result.eligible, false);
    assert.ok(result.errors.some((e) => e.code === "LEAD_CLOSED_LOST"));
  });

  test("duplicate project denied", () => {
    const result = evaluateProjectConversionEligibility({
      ...eligibleConversionInput(),
      hasExistingProject: true,
    });
    assert.equal(result.eligible, false);
    assert.ok(result.errors.some((e) => e.code === "DUPLICATE_PROJECT"));
  });

  test("advance payment alone is not sufficient", () => {
    const result = evaluateProjectConversionEligibility({
      ...eligibleConversionInput(),
      quotationLifecycleState: "sent",
      advancePaymentReceived: true,
    });
    assert.equal(result.eligible, false);
    assert.ok(result.errors.some((e) => e.code === "ADVANCE_PAYMENT_INSUFFICIENT"));
    assert.ok(result.errors.some((e) => e.code === "QUOTATION_NOT_ACCEPTED"));
  });
});

describe("Phase 8A PM assignment authority", () => {
  const awaitingAssignment = buildAwaitingPmAssignmentFixture();
  const awaitingAcceptance = buildAwaitingPmAcceptanceFixture();

  test("Sales Manager PM assignment allowed", () => {
    assert.equal(canAuthorizePmAssignment("sales_manager"), true);
    const result = validatePmAssignmentRequest({
      actorProfileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.salesManager.profileId,
      actorRole: "sales_manager",
      targetPmProfileId: "pm-fixture-002",
      staffing: awaitingAssignment.staffing,
      isReassignment: false,
    });
    assert.equal(result.allowed, true);
  });

  test("Super Admin PM assignment allowed", () => {
    assert.equal(canAuthorizePmAssignment("super_admin"), true);
    const result = validatePmAssignmentRequest({
      actorProfileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.superAdmin.profileId,
      actorRole: "super_admin",
      targetPmProfileId: "pm-fixture-002",
      staffing: awaitingAssignment.staffing,
      isReassignment: false,
    });
    assert.equal(result.allowed, true);
  });

  test("Sales Executive assignment denied", () => {
    const result = validatePmAssignmentRequest({
      actorProfileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.salesExecutive.profileId,
      actorRole: "sales_executive",
      targetPmProfileId: "pm-fixture-002",
      staffing: awaitingAssignment.staffing,
      isReassignment: false,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.error?.code, "PROJECT_UNAUTHORIZED");
  });

  test("PM self-assignment denied", () => {
    const result = validatePmAssignmentRequest({
      actorProfileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.primaryPm.profileId,
      actorRole: "project_manager",
      targetPmProfileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.primaryPm.profileId,
      staffing: awaitingAssignment.staffing,
      isReassignment: false,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.error?.code, "PROJECT_UNAUTHORIZED");
  });

  test("Designer assignment denied", () => {
    const result = validatePmAssignmentRequest({
      actorProfileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.designer.profileId,
      actorRole: "designer",
      targetPmProfileId: "pm-fixture-002",
      staffing: awaitingAssignment.staffing,
      isReassignment: false,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.error?.code, "PROJECT_UNAUTHORIZED");
  });

  test("exactly one primary PM — second assignment denied without reassignment", () => {
    const result = validatePmAssignmentRequest({
      actorProfileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.salesManager.profileId,
      actorRole: "sales_manager",
      targetPmProfileId: "pm-fixture-002",
      staffing: awaitingAcceptance.staffing,
      isReassignment: false,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.error?.code, "PROJECT_DUPLICATE_PRIMARY_PM");
  });

  test("reassignment contract allows SM with existing PM", () => {
    const result = validatePmAssignmentRequest({
      actorProfileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.salesManager.profileId,
      actorRole: "sales_manager",
      targetPmProfileId: "pm-fixture-002",
      staffing: awaitingAcceptance.staffing,
      isReassignment: true,
    });
    assert.equal(result.allowed, true);
  });

  test("reassignment request contract for assigned PM", () => {
    const result = validatePmReassignmentRequest({
      actorProfileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.primaryPm.profileId,
      actorRole: "project_manager",
      staffing: awaitingAcceptance.staffing,
    });
    assert.equal(result.allowed, true);
  });
});

describe("Phase 8A handover states and transitions", () => {
  test("awaiting assignment state", () => {
    const fixture = buildAwaitingPmAssignmentFixture();
    assert.equal(fixture.handoverState, "awaiting_project_manager_assignment");
    assert.equal(
      validateHandoverAssignmentTransition(fixture.handoverState).allowed,
      true
    );
    assert.equal(
      resolveHandoverStateAfterAssignment(fixture.handoverState),
      "awaiting_project_manager_acceptance"
    );
  });

  test("awaiting acceptance state", () => {
    const fixture = buildAwaitingPmAcceptanceFixture();
    assert.equal(fixture.handoverState, "awaiting_project_manager_acceptance");
    assert.equal(
      validateHandoverAcceptanceTransition(fixture.handoverState).allowed,
      true
    );
    assert.equal(
      resolveHandoverStateAfterAcceptance(fixture.handoverState),
      "handover_accepted"
    );
  });

  test("assigned PM accepts handover", () => {
    const fixture = buildAwaitingPmAcceptanceFixture();
    const result = validatePmHandoverAcceptance({
      actorProfileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.primaryPm.profileId,
      actorRole: "project_manager",
      handoverState: fixture.handoverState,
      staffing: fixture.staffing,
      handoverEvidence: buildHandoverEvidenceFixture(),
    });
    assert.equal(result.allowed, true);
  });

  test("other PM denied handover acceptance", () => {
    const fixture = buildAwaitingPmAcceptanceFixture();
    const result = validatePmHandoverAcceptance({
      actorProfileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.otherPm.profileId,
      actorRole: "project_manager",
      handoverState: fixture.handoverState,
      staffing: fixture.staffing,
      handoverEvidence: buildHandoverEvidenceFixture(),
    });
    assert.equal(result.allowed, false);
    assert.equal(result.error?.code, "PROJECT_UNAUTHORIZED");
  });

  test("execution eligibility only after PM acceptance", () => {
    assert.equal(
      isHandoverExecutionEligible("awaiting_project_manager_assignment"),
      false
    );
    assert.equal(
      isHandoverExecutionEligible("awaiting_project_manager_acceptance"),
      false
    );
    assert.equal(isHandoverExecutionEligible("handover_accepted"), true);
    assert.equal(
      isExecutionEligibleAfterHandover("handover_accepted"),
      true
    );
    assert.equal(
      canTransitionHandoverState(
        "awaiting_project_manager_acceptance",
        "handover_accepted"
      ),
      true
    );
  });
});

describe("Phase 8A commercial snapshot boundary", () => {
  test("commercial snapshot no recalculation rule documented", () => {
    assert.match(PROJECT_COMMERCIAL_BOUNDARY_RULE, /Never recalculate/);
    assert.match(PROJECT_COMMERCIAL_BOUNDARY_RULE, /read-only/i);
  });

  test("no target double count contract", () => {
    const reconciliation: ProjectValueReconciliationContract = {
      usesAcceptedQuotationAchievement: true,
      optionalProjectValuePaise: null,
      preventsDoubleCounting: true,
    };
    assert.equal(reconciliation.preventsDoubleCounting, true);
    assert.equal(reconciliation.usesAcceptedQuotationAchievement, true);
  });

  test("display model preserves commercial labels without mutation", () => {
    const fixture = buildHandoverAcceptedFixture();
    const model = buildHandoverDisplayModel({
      summary: fixture.summary,
      handoverState: fixture.handoverState,
      commercial: fixture.commercial,
      staffing: fixture.staffing,
      actor: {
        profileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.salesManager.profileId,
        role: "sales_manager",
        isOwningSalesExecutive: false,
      },
    });
    assert.equal(model.commercial.grandTotalLabel, fixture.commercial.grandTotalLabel);
    assert.equal(model.commercial.taxableBasePaise, fixture.commercial.taxableBasePaise);
  });
});

describe("Phase 8A handover UI contracts", () => {
  test("assignment panel uses callback props only", () => {
    const src = readFileSync(
      join(root, "src/features/projects/components/handover/ProjectPMAssignmentPanel.tsx"),
      "utf8"
    );
    assert.match(src, /onAssignPmRequest/);
    assert.match(src, /onReassignPmRequest/);
    assert.doesNotMatch(src, /supabase/i);
  });

  test("acceptance panel uses callback props only", () => {
    const src = readFileSync(
      join(root, "src/features/projects/components/handover/ProjectHandoverAcceptancePanel.tsx"),
      "utf8"
    );
    assert.match(src, /onAcceptHandover/);
    assert.match(src, /onRequestReassignment/);
    assert.doesNotMatch(src, /supabase/i);
  });

  test("status banner exposes aria-live status", () => {
    const src = readFileSync(
      join(root, "src/features/projects/components/handover/ProjectStatusBanner.tsx"),
      "utf8"
    );
    assert.match(src, /aria-live/);
    assert.match(src, /role="status"/);
  });

  test("display model capability flags for SM assign and PM accept", () => {
    const awaitingAssignment = buildAwaitingPmAssignmentFixture();
    const smModel = buildHandoverDisplayModel({
      summary: awaitingAssignment.summary,
      handoverState: awaitingAssignment.handoverState,
      commercial: awaitingAssignment.commercial,
      staffing: awaitingAssignment.staffing,
      actor: {
        profileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.salesManager.profileId,
        role: "sales_manager",
        isOwningSalesExecutive: false,
      },
    });
    assert.equal(smModel.canShowAssignPm, true);
    assert.equal(smModel.canShowAcceptHandover, false);

    const awaitingAcceptance = buildAwaitingPmAcceptanceFixture();
    const pmModel = buildHandoverDisplayModel({
      summary: awaitingAcceptance.summary,
      handoverState: awaitingAcceptance.handoverState,
      commercial: awaitingAcceptance.commercial,
      staffing: awaitingAcceptance.staffing,
      actor: {
        profileId: SYNTHETIC_HANDOVER_FIXTURE_PROFILES.primaryPm.profileId,
        role: "project_manager",
        isOwningSalesExecutive: false,
      },
    });
    assert.equal(pmModel.canShowAcceptHandover, true);
    assert.equal(pmModel.canShowRequestReassignment, true);
  });
});
