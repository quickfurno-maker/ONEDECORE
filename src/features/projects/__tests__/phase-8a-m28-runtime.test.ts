/**
 * Phase 8A M28 runtime, orchestration, and route containment tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  resolveTrustedQuotationVersionId,
  runPostAcceptanceProjectMaterialization,
} from "../server/project-materialization.ts";

const root = process.cwd();

describe("Phase 8A post-acceptance materialization orchestration", () => {
  test("trusted version comes from capability data, not a browser field", () => {
    assert.equal(
      resolveTrustedQuotationVersionId({ quotation_version_id: "qv-trusted" }),
      "qv-trusted"
    );
    assert.equal(resolveTrustedQuotationVersionId({}), null);
    assert.equal(resolveTrustedQuotationVersionId(undefined), null);
  });

  test("acceptance orchestration invokes materializer once with stable key", async () => {
    const calls: string[] = [];
    const state = await runPostAcceptanceProjectMaterialization({
      quotationVersionId: "qv-1",
      materialize: async (versionId, key) => {
        calls.push(`${versionId}|${key}`);
        return true;
      },
    });
    assert.equal(state, "ready");
    assert.deepEqual(calls, ["qv-1|post-acceptance:qv-1"]);
  });

  test("materializer replay remains ready", async () => {
    const state = await runPostAcceptanceProjectMaterialization({
      quotationVersionId: "qv-1",
      materialize: async () => true,
    });
    assert.equal(state, "ready");
  });

  test("materializer failure preserves acceptance via pending_repair", async () => {
    const state = await runPostAcceptanceProjectMaterialization({
      quotationVersionId: "qv-1",
      materialize: async () => {
        throw new Error("provider exploded");
      },
    });
    assert.equal(state, "pending_repair");
  });

  test("missing trusted version is pending_repair, not skipped success hide", async () => {
    const state = await runPostAcceptanceProjectMaterialization({
      quotationVersionId: null,
      materialize: async () => true,
    });
    assert.equal(state, "pending_repair");
  });

  test("acceptance action uses capability preview then existing accept RPC", () => {
    const src = readFileSync(
      join(root, "src/features/quotations/server/quotation-acceptance-actions.ts"),
      "utf8"
    );
    assert.match(src, /getQuotationByCapabilityAction/);
    assert.match(src, /accept_quotation_by_capability/);
    assert.match(src, /materialize_closed_won_project_internal/);
    assert.match(src, /projectMaterialization/);
    assert.match(src, /runPostAcceptanceProjectMaterialization/);
    assert.doesNotMatch(src, /p_quotation_version_id:\s*params\./);
  });
});

describe("Phase 8A server and UI containment", () => {
  test("repair and assignment actions exist and stay server-only", () => {
    const src = readFileSync(
      join(root, "src/features/projects/server/project-actions.ts"),
      "utf8"
    );
    assert.match(src, /repairProjectMaterializationAction/);
    assert.match(src, /assignProjectManagerAction/);
    assert.match(src, /acceptProjectHandoverAction/);
    assert.match(src, /getProjectHandoverPdfUrlAction/);
    assert.match(src, /createSignedUrl/);
    assert.match(src, /900/);
    assert.match(src, /quotation-documents/);
    assert.match(src, /can_view_project_handover_baseline/);
    assert.doesNotMatch(src, /quotations\.edit|quotations\.finalize|quotations\.send/);
  });

  test("admin projects route exists for authorized roles", () => {
    const page = readFileSync(join(root, "src/app/admin/projects/page.tsx"), "utf8");
    const layout = readFileSync(join(root, "src/app/admin/layout.tsx"), "utf8");
    assert.match(page, /requireStaffPermission\("projects.read"/);
    assert.match(page, /ProjectMaterializationRepairQueue/);
    assert.match(layout, /\/admin\/projects/);
    assert.match(layout, /hasAnyProjectReadPermission/);
  });

  test("SA/SM assignment and PM accept controls are present; design/execution are not mounted", () => {
    const workspace = readFileSync(
      join(root, "src/features/projects/components/handover/ProjectHandoverWorkspace.tsx"),
      "utf8"
    );
    const detail = readFileSync(
      join(root, "src/app/admin/projects/[projectId]/page.tsx"),
      "utf8"
    );
    assert.match(workspace, /ProjectPMAssignmentPanel/);
    assert.match(workspace, /ProjectHandoverAcceptancePanel/);
    assert.match(workspace, /High-level status only/);
    assert.match(detail, /highLevelOnly/);
    assert.match(detail, /role === "designer"/);
    assert.doesNotMatch(workspace, /DesignerTeamPanel|ProjectExecutionWorkspace|DesignWorkspaceShell/);
    assert.doesNotMatch(detail, /DesignerTeamPanel|ProjectExecutionWorkspace/);
  });

  test("M28 serializes durable idempotency before ledger lookup", () => {
    const migration = readFileSync(
      join(root, "supabase/migrations/20260815140000_closed_won_project_conversion_pm_handover.sql"),
      "utf8"
    );
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /private\.project_idempotency_xact_lock/);

    const implStart = migration.indexOf("create or replace function private.materialize_closed_won_project_impl");
    const assignStart = migration.indexOf("create or replace function public.assign_project_manager(");
    const acceptStart = migration.indexOf("create or replace function public.accept_project_handover(");
    const impl = migration.slice(implStart, assignStart);
    const assign = migration.slice(assignStart, acceptStart);
    const accept = migration.slice(acceptStart);

    for (const [label, src] of [
      ["materialize", impl],
      ["assign_pm", assign],
      ["accept_handover", accept],
    ] as const) {
      const lockAt = src.indexOf("private.project_idempotency_xact_lock");
      const lookupAt = src.indexOf("from private.project_idempotency_requests");
      assert.ok(lockAt >= 0, `${label} acquires an idempotency lock`);
      assert.ok(lookupAt > lockAt, `${label} locks before the first ledger SELECT`);
    }
  });

  test("M28 does not add project revenue or 8B/8C persistence", () => {
    const migration = readFileSync(
      join(root, "supabase/migrations/20260815140000_closed_won_project_conversion_pm_handover.sql"),
      "utf8"
    );
    assert.match(migration, /create table public.projects/);
    assert.match(migration, /project_manager_assignments/);
    assert.match(migration, /project_events/);
    assert.match(migration, /project_idempotency_requests/);
    assert.match(migration, /OD-P-/);
    assert.doesNotMatch(migration, /project_value_paise|revenue_paise|designer_assignments|execution_stages/);
    assert.doesNotMatch(migration, /create table public.design_|create table public.execution_/);
  });
});
