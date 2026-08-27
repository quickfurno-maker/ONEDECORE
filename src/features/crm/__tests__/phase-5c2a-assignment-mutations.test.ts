/**
 * Phase 5C2A — lead assignment mutation tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  validateLeadAssignmentInput,
} from "../contracts/assignment-contracts.ts";
import { CRM_ROLE_PERMISSIONS } from "../contracts/permissions.ts";

const root = process.cwd();

describe("Phase 5C2A assignment contracts", () => {
  test("canAssignLeads maps to leads.assign for authorized roles", () => {
    assert.ok(CRM_ROLE_PERMISSIONS.super_admin.includes("leads.assign"));
    assert.ok(CRM_ROLE_PERMISSIONS.sales_manager.includes("leads.assign"));
    assert.ok(CRM_ROLE_PERMISSIONS.management.includes("leads.assign"));
    assert.equal(CRM_ROLE_PERMISSIONS.sales_executive.includes("leads.assign"), false);
    assert.equal(CRM_ROLE_PERMISSIONS.project_manager.includes("leads.assign"), false);
    assert.equal(CRM_ROLE_PERMISSIONS.designer.includes("leads.assign"), false);
  });

  test("input schema accepts valid initial assignment", () => {
    const errors = validateLeadAssignmentInput({
      leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      targetAssigneeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      reason: null,
      expectedAssigneeId: null,
      expectedUpdatedAt: "2026-07-31T10:00:00.000Z",
      intent: "assign",
    });
    assert.equal(errors.length, 0);
  });

  test("input schema requires reassignment reason", () => {
    const errors = validateLeadAssignmentInput({
      leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      targetAssigneeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      reason: null,
      expectedAssigneeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      expectedUpdatedAt: "2026-07-31T10:00:00.000Z",
      intent: "reassign",
    });
    assert.ok(errors.some((entry) => entry.field === "reason"));
  });

  test("input schema requires unassignment reason", () => {
    const errors = validateLeadAssignmentInput({
      leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      targetAssigneeId: null,
      reason: "short",
      expectedAssigneeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      expectedUpdatedAt: "2026-07-31T10:00:00.000Z",
      intent: "unassign",
    });
    assert.ok(errors.some((entry) => entry.field === "reason"));
  });

  test("input schema enforces 500-character bound", () => {
    const errors = validateLeadAssignmentInput({
      leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      targetAssigneeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      reason: "x".repeat(501),
      expectedAssigneeId: null,
      expectedUpdatedAt: "2026-07-31T10:00:00.000Z",
      intent: "assign",
    });
    assert.ok(errors.some((entry) => entry.field === "reason"));
  });
});

describe("Phase 5C2A server architecture", () => {
  test("crm-access exposes canAssignLeads", () => {
    const src = readFileSync(
      join(root, "src/features/crm/contracts/crm-access.ts"),
      "utf8"
    );
    assert.match(src, /canAssignLeads/);
  });

  test("crm-permissions probes leads.assign", () => {
    const src = readFileSync(
      join(root, "src/features/crm/server/crm-permissions.ts"),
      "utf8"
    );
    assert.match(src, /probeCanAssignLeads/);
    assert.match(src, /leads\.assign/);
  });

  test("RPC adapter passes enforce expected state for Phase 5C2A calls", () => {
    const adapterSrc = readFileSync(
      join(root, "src/features/crm/server/crm-transition-adapters.ts"),
      "utf8"
    );
    assert.match(adapterSrc, /p_enforce_expected_state/);
    assert.match(adapterSrc, /p_expected_assignee/);
    assert.match(adapterSrc, /p_expected_updated_at/);
  });

  test("assignment service uses authenticated client and never service role", () => {
    const serviceSrc = readFileSync(
      join(root, "src/features/crm/server/crm-assignment-service.ts"),
      "utf8"
    );
    assert.match(serviceSrc, /createClient/);
    assert.doesNotMatch(serviceSrc, /service_role/i);
    assert.doesNotMatch(serviceSrc, /actor/i);
    assert.match(serviceSrc, /enforceExpectedState:\s*true/);
  });

  test("server action revalidates list and detail routes", () => {
    const actionSrc = readFileSync(
      join(root, "src/features/crm/server/crm-assignment-actions.ts"),
      "utf8"
    );
    assert.match(actionSrc, /revalidatePath\("\/admin\/crm\/leads"\)/);
    assert.match(actionSrc, /revalidatePath\(`\/admin\/crm\/leads\/\$\{leadId\}`\)/);
    assert.doesNotMatch(actionSrc, /service_role/i);
  });

  test("crm-errors maps assignment conflict and follow-up tokens", () => {
    const errorsSrc = readFileSync(
      join(root, "src/features/crm/server/crm-errors.ts"),
      "utf8"
    );
    assert.match(errorsSrc, /ASSIGNMENT_CONFLICT/);
    assert.match(errorsSrc, /OPEN_FOLLOW_UPS_BLOCK_ASSIGNMENT/);
    assert.match(errorsSrc, /crm_assignment_stale/i);
  });
});

describe("Phase 5C2A UI boundaries", () => {
  test("assignment panel renders controls only when canAssignLeads is true", () => {
    const panelSrc = readFileSync(
      join(root, "src/features/crm/components/leads/LeadDetailAssignmentPanel.tsx"),
      "utf8"
    );
    assert.match(panelSrc, /canAssignLeads/);
    assert.match(panelSrc, /LeadAssignmentDialog/);
    assert.doesNotMatch(panelSrc, /transitionLead/i);
    assert.doesNotMatch(panelSrc, /createLeadFollowUp/i);
  });

  test("lead detail page fetches assignee directory only for authorized broad callers", () => {
    const pageSrc = readFileSync(
      join(root, "src/app/admin/crm/leads/[leadId]/page.tsx"),
      "utf8"
    );
    assert.match(pageSrc, /fetchCrmAssigneeDirectory/);
    assert.match(pageSrc, /canAssignLeads/);
    assert.match(pageSrc, /canReadBroad/);
  });

  test("migration 13 exists with hardened assign_lead signature", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260731143050_crm_assignment_mutation_hardening.sql"
      ),
      "utf8"
    );
    assert.match(migration, /p_enforce_expected_state/);
    assert.match(migration, /crm_can_view_lead_by_id/);
    assert.match(migration, /CRM_ASSIGNMENT_OPEN_FOLLOW_UPS/);
  });

  test("pgTAP test 07 exists", () => {
    const testSql = readFileSync(
      join(root, "supabase/tests/database/07_crm_assignment_mutations_test.sql"),
      "utf8"
    );
    assert.match(testSql, /phase5c2a/);
  });
});

describe("CRM 2A-7 assignment automation contracts", () => {
  test("2A-7 migration exists with assignment first-contact automation", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260829140000_crm_assignment_first_contact_automation.sql"
      ),
      "utf8"
    );
    assert.match(migration, /ensure_sla_first_contact_primary/);
    assert.match(migration, /sync_open_activities_on_assignment/);
    assert.match(migration, /follow_up\.auto_created/);
    assert.match(migration, /source = 'sla_auto'/);
    assert.match(migration, /First Contact/);
  });

  test("pgTAP test 35 exists for 2A-7", () => {
    const testSql = readFileSync(
      join(
        root,
        "supabase/tests/database/35_crm_assignment_first_contact_automation_test.sql"
      ),
      "utf8"
    );
    assert.match(testSql, /2A7/);
    assert.match(testSql, /follow_up\.auto_created/);
  });

  test("assignment service still calls same assign_lead RPC without UI changes", () => {
    const adapterSrc = readFileSync(
      join(root, "src/features/crm/server/crm-transition-adapters.ts"),
      "utf8"
    );
    const serviceSrc = readFileSync(
      join(root, "src/features/crm/server/crm-assignment-service.ts"),
      "utf8"
    );
    assert.match(adapterSrc, /assign_lead/);
    assert.match(adapterSrc, /p_enforce_expected_state/);
    assert.match(serviceSrc, /callAssignLead/);
    assert.doesNotMatch(serviceSrc, /First Contact/i);
    assert.doesNotMatch(serviceSrc, /createLeadActivity/i);
  });

  test("assignment dialog unchanged — no First Contact UI", () => {
    const dialogSrc = readFileSync(
      join(root, "src/features/crm/components/leads/LeadAssignmentDialog.tsx"),
      "utf8"
    );
    assert.doesNotMatch(dialogSrc, /First Contact/i);
    assert.doesNotMatch(dialogSrc, /sla_auto/i);
    assert.match(dialogSrc, /assignLeadAction/);
  });
});
