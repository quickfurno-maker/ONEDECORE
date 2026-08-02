/**
 * Phase 5C2C — lifecycle & collaboration mutation tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { CRM_ROLE_PERMISSIONS } from "../contracts/permissions.ts";
import {
  getForwardTransitionOptions,
  resolveOnHoldResumeStage,
  validateLeadFollowUpCreateInput,
  validateLeadNoteInput,
  validateLeadStatusTransitionInput,
} from "../contracts/lifecycle-contracts.ts";
import {
  getAllowedLeadTransitions,
  isLeadTransitionAllowed,
  PHASE_5B_BLOCKED_TARGET_STAGES,
} from "../contracts/lead-stages.ts";
import { crmErrorFromPostgresMessage } from "../server/crm-errors.ts";

const root = process.cwd();

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function assertAsyncOnlyServerActions(relativePath: string, expectedActions: string[]) {
  const actionsSrc = readSrc(relativePath);
  assert.match(actionsSrc, /"use server"/);
  assert.doesNotMatch(actionsSrc, /export\s*\{/);
  const runtimeValueExports = [
    ...actionsSrc.matchAll(
      /export\s+(?:const|let|var|class|enum|type(?!\s+\w+\s*=)|function(?!\s+async))\s+/g
    ),
  ];
  assert.equal(runtimeValueExports.length, 0);
  const asyncActionExports =
    actionsSrc.match(/export\s+async\s+function\s+(\w+)/g) ?? [];
  assert.deepEqual(
    new Set(asyncActionExports.map((entry) => entry.replace(/export\s+async\s+function\s+/, ""))),
    new Set(expectedActions)
  );
}

describe("Phase 5C2C permissions", () => {
  test("lifecycle permissions granted to sales roles only", () => {
    for (const role of [
      "super_admin",
      "sales_manager",
      "sales_executive",
      "management",
      "sales",
    ] as const) {
      assert.ok(CRM_ROLE_PERMISSIONS[role].includes("leads.transition"));
      assert.ok(CRM_ROLE_PERMISSIONS[role].includes("crm.notes.manage"));
      assert.ok(CRM_ROLE_PERMISSIONS[role].includes("crm.follow_ups.manage"));
    }

    assert.equal(CRM_ROLE_PERMISSIONS.project_manager.includes("leads.transition"), false);
    assert.equal(CRM_ROLE_PERMISSIONS.designer.includes("leads.transition"), false);
  });
});

describe("Phase 5C2C transition contracts", () => {
  test("forward options exclude blocked targets", () => {
    const options = getForwardTransitionOptions("assigned");
    assert.ok(options.includes("contacted"));
    assert.equal(options.includes("closed_won"), false);
    assert.equal(options.includes("new"), false);
    assert.equal(options.includes("assigned"), false);
  });

  test("closed_won blocked in validation", () => {
    const errors = validateLeadStatusTransitionInput(
      {
        leadId: "lead-1",
        newStatus: "closed_won",
      },
      "assigned"
    );
    assert.ok(errors.some((entry) => entry.field === "newStatus"));
  });

  test("on-hold requires bounded reason", () => {
    const errors = validateLeadStatusTransitionInput(
      {
        leadId: "lead-1",
        newStatus: "on_hold",
        reason: "no",
      },
      "contacted"
    );
    assert.ok(errors.some((entry) => entry.field === "reason"));
  });

  test("closed-lost requires reason code and note", () => {
    const errors = validateLeadStatusTransitionInput(
      {
        leadId: "lead-1",
        newStatus: "closed_lost",
        reason: "ab",
        closureReasonCode: "",
      },
      "negotiation"
    );
    assert.ok(errors.some((entry) => entry.field === "reason"));
    assert.ok(errors.some((entry) => entry.field === "closureReasonCode"));
  });

  test("resume target mirrors DB reconciliation", () => {
    assert.equal(resolveOnHoldResumeStage("assigned", "user-1"), "assigned");
    assert.equal(resolveOnHoldResumeStage("assigned", null), "new");
    assert.equal(resolveOnHoldResumeStage("qualified", "user-1"), "qualified");
  });

  test("graph matches allowed transitions for contacted", () => {
    assert.deepEqual(getAllowedLeadTransitions("contacted"), [
      "qualified",
      "closed_lost",
      "on_hold",
    ]);
    assert.equal(isLeadTransitionAllowed("contacted", "closed_won"), false);
    for (const blocked of PHASE_5B_BLOCKED_TARGET_STAGES) {
      assert.equal(isLeadTransitionAllowed("contacted", blocked), false);
    }
  });
});

describe("Phase 5C2C notes and follow-up contracts", () => {
  test("note validation enforces 1-4000 trimmed body", () => {
    assert.ok(validateLeadNoteInput({ leadId: "lead-1", body: "   " }).length > 0);
    assert.equal(
      validateLeadNoteInput({ leadId: "lead-1", body: "Valid note" }).length,
      0
    );
  });

  test("follow-up create rejects past due time", () => {
    const errors = validateLeadFollowUpCreateInput({
      leadId: "lead-1",
      dueAt: new Date(Date.now() - 60_000).toISOString(),
    });
    assert.ok(errors.some((entry) => entry.field === "dueAt"));
  });

  test("executive owner forced to self in service helper", () => {
    const src = readSrc("src/features/crm/server/crm-lifecycle-service.ts");
    assert.match(src, /if \(!context\.canReadBroad\)/);
    assert.match(src, /return context\.userId/);
  });
});

describe("Phase 5C2C architecture", () => {
  test("crm-access exposes lifecycle capability flags", () => {
    const src = readSrc("src/features/crm/contracts/crm-access.ts");
    assert.match(src, /canTransitionLeads/);
    assert.match(src, /canManageLeadNotes/);
    assert.match(src, /canManageLeadFollowUps/);
  });

  test("crm-permissions probes lifecycle permission codes", () => {
    const src = readSrc("src/features/crm/server/crm-permissions.ts");
    assert.match(src, /leads\.transition/);
    assert.match(src, /crm\.notes\.manage/);
    assert.match(src, /crm\.follow_ups\.manage/);
  });

  test("lifecycle modules exist", () => {
    for (const file of [
      "src/features/crm/contracts/lifecycle-contracts.ts",
      "src/features/crm/server/crm-lifecycle-service.ts",
      "src/features/crm/server/crm-lifecycle-actions.ts",
      "src/features/crm/components/leads/LeadStatusTransitionPanel.tsx",
      "src/features/crm/components/leads/LeadNoteComposer.tsx",
      "src/features/crm/components/leads/LeadFollowUpComposer.tsx",
    ]) {
      assert.ok(readSrc(file).length > 0);
    }
  });

  test("lifecycle service uses authenticated insert for notes only", () => {
    const src = readSrc("src/features/crm/server/crm-lifecycle-service.ts");
    assert.match(src, /\.from\("lead_notes"\)\.insert/);
    assert.match(src, /lead_id: input\.leadId/);
    assert.match(src, /body: input\.body\.trim\(\)/);
    assert.doesNotMatch(src, /created_by/);
    assert.doesNotMatch(src, /service role/i);
  });

  test("lifecycle actions revalidate list and detail paths", () => {
    const src = readSrc("src/features/crm/server/crm-lifecycle-actions.ts");
    assert.match(src, /revalidatePath\("\/admin\/crm\/leads"\)/);
    assert.match(src, /revalidatePath\(`\/admin\/crm\/leads\/\$\{leadId\}`\)/);
  });

  test("lead detail page stays server component and passes capability flags", () => {
    const pageSrc = readSrc("src/app/admin/crm/leads/[leadId]/page.tsx");
    assert.doesNotMatch(pageSrc, /"use client"/);
    assert.match(pageSrc, /canTransitionLeads/);
    assert.match(pageSrc, /canManageLeadNotes/);
    assert.match(pageSrc, /canManageLeadFollowUps/);
    assert.match(pageSrc, /LeadStatusTransitionPanel/);
  });

  test("repository exposes resume target and follow-up owner id", () => {
    const repoSrc = readSrc("src/features/crm/server/crm-lead-repository.ts");
    assert.match(repoSrc, /on_hold_previous_status/);
    assert.match(repoSrc, /resumeTargetStatus/);
    assert.match(repoSrc, /ownerId: followUp\.owner_id/);
  });

  test("errors normalize lifecycle postgres tokens", () => {
    assert.equal(
      crmErrorFromPostgresMessage("CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE").code,
      "INVALID_TRANSITION"
    );
    assert.equal(
      crmErrorFromPostgresMessage("Only open follow-ups can be completed").code,
      "FOLLOW_UP_NOT_OPEN"
    );
    assert.equal(
      crmErrorFromPostgresMessage("Follow-up abc not found").code,
      "FOLLOW_UP_NOT_FOUND"
    );
  });

  test("lifecycle server-action module exports async functions only", () => {
    assertAsyncOnlyServerActions("src/features/crm/server/crm-lifecycle-actions.ts", [
      "transitionLeadStatusAction",
      "addLeadNoteAction",
      "createLeadFollowUpAction",
      "completeLeadFollowUpAction",
      "cancelLeadFollowUpAction",
    ]);
  });

  test("assignment and manual lead server-action modules remain async-only", () => {
    assertAsyncOnlyServerActions("src/features/crm/server/crm-assignment-actions.ts", [
      "assignLeadAction",
    ]);
    assertAsyncOnlyServerActions("src/features/crm/server/crm-manual-lead-actions.ts", [
      "previewManualLeadDuplicateAction",
      "createManualLeadAction",
    ]);
  });
});
