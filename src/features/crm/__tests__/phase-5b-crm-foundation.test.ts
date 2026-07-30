/**
 * Phase 5B — CRM identity core foundation contract tests.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  CRM_ASSIGNMENT_METHODS,
  CRM_LEGACY_ROLE_CODES,
  CRM_PERMISSION_CODES,
  CRM_ROLE_CODES,
  CRM_ROLE_PERMISSIONS,
} from "../contracts/permissions.ts";
import {
  LEAD_STAGE_CODES,
  LEAD_STAGE_TRANSITIONS,
  PHASE_5B_BLOCKED_TARGET_STAGES,
  TERMINAL_LEAD_STAGES,
  getAllowedLeadTransitions,
  isLeadTransitionAllowed,
  isTerminalLeadStage,
  type LeadStageCode,
} from "../contracts/lead-stages.ts";
import {
  CRM_LEAD_LIST_ITEM_PUBLIC_KEYS,
  mapLeadRowToListItem,
  type CrmLeadListRow,
} from "../contracts/lead-dtos.ts";

const root = process.cwd();

const MIGRATION_TRANSITIONS: ReadonlyArray<readonly [LeadStageCode, LeadStageCode]> =
  [
    ["new", "assigned"],
    ["new", "contacted"],
    ["new", "closed_lost"],
    ["new", "on_hold"],
    ["assigned", "contacted"],
    ["assigned", "closed_lost"],
    ["assigned", "on_hold"],
    ["assigned", "new"],
    ["contacted", "qualified"],
    ["contacted", "closed_lost"],
    ["contacted", "on_hold"],
    ["qualified", "consultation_scheduled"],
    ["qualified", "closed_lost"],
    ["qualified", "on_hold"],
    ["consultation_scheduled", "proposal_sent"],
    ["consultation_scheduled", "closed_lost"],
    ["consultation_scheduled", "on_hold"],
    ["proposal_sent", "negotiation"],
    ["proposal_sent", "closed_lost"],
    ["proposal_sent", "on_hold"],
    ["negotiation", "closed_lost"],
    ["negotiation", "on_hold"],
    ["on_hold", "new"],
    ["on_hold", "assigned"],
    ["on_hold", "contacted"],
    ["on_hold", "qualified"],
    ["on_hold", "consultation_scheduled"],
    ["on_hold", "proposal_sent"],
    ["on_hold", "negotiation"],
  ];

function sampleLeadRow(overrides: Partial<CrmLeadListRow> = {}): CrmLeadListRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "new",
    submitted_name: "Test Lead",
    service_code: "complete-home-interiors",
    locality: "Koregaon Park",
    assigned_to: null,
    created_at: "2026-07-30T10:00:00.000Z",
    updated_at: "2026-07-30T10:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 5B CRM permission constants", () => {
  test("permission catalogue matches migration insert block", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260730184426_crm_identity_core_foundation.sql"
      ),
      "utf8"
    );

    for (const code of CRM_PERMISSION_CODES) {
      assert.match(migration, new RegExp(`'${code}'`));
    }

    assert.equal(CRM_PERMISSION_CODES.length, 13);
  });

  test("canonical and legacy role codes are declared", () => {
    assert.deepEqual([...CRM_ROLE_CODES], [
      "super_admin",
      "sales_manager",
      "sales_executive",
      "project_manager",
      "designer",
    ]);
    assert.deepEqual([...CRM_LEGACY_ROLE_CODES], [
      "management",
      "sales",
      "project_operations",
    ]);
  });

  test("role permission grants mirror migration matrix", () => {
    assert.ok(CRM_ROLE_PERMISSIONS.super_admin.includes("sources.manage"));
    assert.ok(CRM_ROLE_PERMISSIONS.sales_manager.includes("leads.assign"));
    assert.ok(!CRM_ROLE_PERMISSIONS.sales_executive.includes("leads.assign"));
    assert.ok(!CRM_ROLE_PERMISSIONS.sales.includes("leads.read"));
    assert.ok(CRM_ROLE_PERMISSIONS.sales.includes("leads.read_assigned"));
    assert.deepEqual(CRM_ROLE_PERMISSIONS.project_manager, []);
    assert.deepEqual(CRM_ROLE_PERMISSIONS.designer, []);
    assert.deepEqual(CRM_ROLE_PERMISSIONS.project_operations, []);
  });

  test("assignment methods match RPC constraint", () => {
    assert.deepEqual([...CRM_ASSIGNMENT_METHODS], [
      "manual",
      "manager",
      "super_admin",
      "source_rule",
      "system",
    ]);
  });
});

describe("Phase 5B CRM lead stage graph", () => {
  test("stage codes match migration status constraint", () => {
    assert.deepEqual([...LEAD_STAGE_CODES], [
      "new",
      "assigned",
      "contacted",
      "qualified",
      "consultation_scheduled",
      "proposal_sent",
      "negotiation",
      "closed_won",
      "closed_lost",
      "on_hold",
    ]);
  });

  test("migration-permitted transitions are allowed by graph helper", () => {
    for (const [from, to] of MIGRATION_TRANSITIONS) {
      assert.equal(
        isLeadTransitionAllowed(from, to),
        true,
        `expected ${from} -> ${to}`
      );
    }
  });

  test("terminal stages have no outgoing transitions", () => {
    for (const stage of TERMINAL_LEAD_STAGES) {
      assert.equal(getAllowedLeadTransitions(stage).length, 0);
      assert.equal(isTerminalLeadStage(stage), true);
    }
  });

  test("closed-won is not a permitted RPC target in Phase 5B", () => {
    for (const stage of LEAD_STAGE_CODES) {
      if (stage === "closed_won") {
        continue;
      }
      assert.equal(
        isLeadTransitionAllowed(stage, "closed_won"),
        false,
        `closed_won must not be reachable from ${stage}`
      );
    }

    assert.deepEqual([...PHASE_5B_BLOCKED_TARGET_STAGES], ["closed_won"]);
  });

  test("transition map is internally consistent", () => {
    for (const stage of LEAD_STAGE_CODES) {
      const allowed = LEAD_STAGE_TRANSITIONS[stage];
      assert.ok(Array.isArray(allowed));
      for (const target of allowed) {
        assert.ok(
          (LEAD_STAGE_CODES as readonly string[]).includes(target),
          `${stage} -> ${target} references unknown stage`
        );
      }
    }
  });
});

describe("Phase 5B CRM server-only boundaries", () => {
  const serverFiles = [
    "src/features/crm/server/crm-errors.ts",
    "src/features/crm/server/crm-lead-repository.ts",
    "src/features/crm/server/crm-transition-adapters.ts",
  ];

  const contractFiles = [
    "src/features/crm/contracts/permissions.ts",
    "src/features/crm/contracts/lead-stages.ts",
    "src/features/crm/contracts/lead-dtos.ts",
  ];

  test("server modules declare server-only", () => {
    for (const file of serverFiles) {
      const src = readFileSync(join(root, file), "utf8");
      assert.match(src, /import "server-only"/);
    }
  });

  test("contract modules remain server-only free", () => {
    for (const file of contractFiles) {
      const src = readFileSync(join(root, file), "utf8");
      assert.doesNotMatch(src, /server-only/);
    }
  });

  test("CRM server modules are not referenced from public-site sources", () => {
    const offenders: string[] = [];

    function scan(relativeDir: string) {
      for (const entry of readdirSync(join(root, relativeDir))) {
        const full = join(relativeDir, entry);
        if (statSync(join(root, full)).isDirectory()) {
          scan(full);
          continue;
        }
        if (!full.endsWith(".ts") && !full.endsWith(".tsx")) {
          continue;
        }
        const src = readFileSync(join(root, full), "utf8");
        if (src.includes("features/crm/server")) {
          offenders.push(full);
        }
      }
    }

    scan("src/features/public-site");
    assert.deepEqual(offenders, []);
  });
});

describe("Phase 5B CRM lead list DTO minimization", () => {
  test("list mapper exposes only scoped fields", () => {
    const item = mapLeadRowToListItem(sampleLeadRow());
    assert.deepEqual(Object.keys(item).sort(), [...CRM_LEAD_LIST_ITEM_PUBLIC_KEYS].sort());
  });

  test("list DTO omits intake, contact, and audit payload fields", () => {
    const item = mapLeadRowToListItem(
      sampleLeadRow({
        submitted_name: "Scoped Lead",
      })
    );
    const serialised = JSON.stringify(item);

    const forbiddenSnippets = [
      "attribution",
      "estimate_snapshot",
      "contact_id",
      "submission_reference",
      "planner_version",
      "room_codes",
      "budget_comfort_code",
      "landing_path",
      "submitted_email",
      "message",
      "primary_source_id",
      "entry_method",
      "closed_lost_note",
      "on_hold_reason",
    ];

    for (const snippet of forbiddenSnippets) {
      assert.equal(
        serialised.includes(snippet),
        false,
        `DTO must not expose ${snippet}`
      );
    }
  });

  test("repository select list stays aligned with list row contract", () => {
    const repoSrc = readFileSync(
      join(root, "src/features/crm/server/crm-lead-repository.ts"),
      "utf8"
    );
    assert.match(repoSrc, /CRM_LEAD_LIST_SELECT/);
    assert.match(repoSrc, /submitted_name/);
    assert.doesNotMatch(repoSrc, /attribution/);
    assert.doesNotMatch(repoSrc, /estimate_snapshot/);
    assert.doesNotMatch(repoSrc, /contact_id/);
  });
});

describe("Phase 5B CRM error normalisation", () => {
  test("postgres messages map to stable CRM error codes", async () => {
    const { crmErrorFromPostgresMessage } = await import(
      "../server/crm-errors.ts"
    );

    assert.equal(
      crmErrorFromPostgresMessage("Authentication required").code,
      "AUTH_REQUIRED"
    );
    assert.equal(
      crmErrorFromPostgresMessage("Permission denied to assign leads").code,
      "PERMISSION_DENIED"
    );
    assert.equal(
      crmErrorFromPostgresMessage("Lead 00000000-0000-0000-0000-000000000000 not found")
        .code,
      "LEAD_NOT_FOUND"
    );
    assert.equal(
      crmErrorFromPostgresMessage("Invalid lead status transition: new -> qualified")
        .code,
      "INVALID_TRANSITION"
    );
    assert.equal(
      crmErrorFromPostgresMessage("Assignee is not an active eligible sales user").code,
      "INVALID_ASSIGNMENT"
    );
  });
});
