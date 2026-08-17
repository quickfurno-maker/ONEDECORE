/**
 * Phase 8C M30 runtime containment and orchestration tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();

describe("Phase 8C M30 runtime containment", () => {
  test("M30 migration encodes locked graph, init, and evidence integrity", () => {
    const migration = readFileSync(
      join(root, "supabase/migrations/20260817140000_project_execution_workspace.sql"),
      "utf8"
    );
    assert.match(migration, /project_execution_workflows/);
    assert.match(migration, /materialize_project_execution_impl/);
    assert.match(migration, /trg_after_design_completed_materialize_execution/);
    assert.match(migration, /repair_project_execution_workflow/);
    assert.match(migration, /project-execution-documents/);
    assert.match(migration, /projects\/' \|\| p_project_id::text \|\| '\/execution\/evidence\/%/);
    assert.match(migration, /project_execution_uploaded_evidence_object_exists/);
    assert.match(migration, /can_transition_project_execution/);
    assert.match(migration, /can_resolve_project_execution_snag/);
    assert.match(migration, /can_record_project_execution_handover/);
    assert.match(migration, /can_complete_project_execution/);
    assert.match(migration, /get_project_execution_high_level_status/);
    assert.match(migration, /project_idempotency_xact_lock/);
    assert.doesNotMatch(migration, /material_finalisation/);
    assert.doesNotMatch(migration, /project_created/);
    assert.doesNotMatch(migration, /project_execution\.manage/);
    assert.doesNotMatch(migration, /20260816140000/);
  });

  test("M29 is not rewritten and does not create execution rows", () => {
    const m29 = readFileSync(
      join(root, "supabase/migrations/20260816140000_designer_assignment_design_collaboration.sql"),
      "utf8"
    );
    assert.doesNotMatch(m29, /project_execution_workflows/);
    assert.doesNotMatch(m29, /materialize_project_execution/);
  });

  test("server actions preauth before upload and sign by evidence id", () => {
    const actions = readFileSync(
      join(root, "src/features/projects/server/project-execution-actions.ts"),
      "utf8"
    );
    assert.match(actions, /can_transition_project_execution/);
    assert.match(actions, /uploadExecutionObject/);
    assert.match(actions, /deleteExecutionObjectBestEffort/);
    assert.match(actions, /can_view_project_execution_detail/);
    assert.match(actions, /eq\("id", evidenceId\)/);
    assert.doesNotMatch(actions, /createBrowserClient/);
  });

  test("storage helper uses private bucket, 20MiB, 900s, upsert false", () => {
    const storage = readFileSync(
      join(root, "src/features/projects/server/project-execution-storage.ts"),
      "utf8"
    );
    assert.match(storage, /project-execution-documents/);
    assert.match(storage, /20 \* 1024 \* 1024/);
    assert.match(storage, /900/);
    assert.match(storage, /upsert: false/);
    assert.match(storage, /server-only/);
  });

  test("project detail mounts live execution and not client preview", () => {
    const page = readFileSync(join(root, "src/app/admin/projects/[projectId]/page.tsx"), "utf8");
    assert.match(page, /LiveProjectExecutionWorkspace/);
    assert.match(page, /ProjectExecutionHighLevelCard/);
    assert.doesNotMatch(page, /ProjectClientUpdatePreview/);
    assert.doesNotMatch(page, /Gantt|procurement|inventory|invoice/i);
  });

  test("pgTAP 22 covers init failure preserve and PM continuity", () => {
    const pgtap = readFileSync(
      join(root, "supabase/tests/database/22_project_execution_workspace_test.sql"),
      "utf8"
    );
    assert.match(pgtap, /repair_project_execution_workflow/);
    assert.match(pgtap, /execution_init_failed|design_completed/);
    assert.match(pgtap, /assign_project_manager/);
    assert.match(pgtap, /get_project_execution_high_level_status/);
  });
});
