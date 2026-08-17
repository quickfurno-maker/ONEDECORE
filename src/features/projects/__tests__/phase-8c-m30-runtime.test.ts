/**
 * Phase 8C M30 runtime containment and orchestration tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { isSignableExecutionEvidencePath } from "../server/execution-evidence-path.ts";

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
    assert.match(migration, /project_execution_allows_snag_mutation/);
    assert.match(migration, /length\(trim\(hold_reason\)\) between 10 and 1000/);
    assert.match(migration, /pr\.status = 'active'/);
    assert.match(migration, /EXECUTION_INITIALIZATION_FAILED/);
    assert.doesNotMatch(migration, /SQLERRM/);
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
    assert.match(actions, /source_type/);
    assert.match(actions, /isSignableExecutionEvidencePath/);
    assert.match(actions, /can_resolve_project_execution_snag/);
    assert.match(actions, /allowed !== true/);
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
    assert.match(storage, /isSignableExecutionEvidencePath/);
  });

  test("signed evidence path guard rejects notes, traversal, and foreign prefixes", () => {
    const storage = readFileSync(
      join(root, "src/features/projects/server/project-execution-storage.ts"),
      "utf8"
    );
    const actions = readFileSync(
      join(root, "src/features/projects/server/project-execution-actions.ts"),
      "utf8"
    );
    assert.match(actions, /source_type !== "uploaded_artifact"/);
    assert.match(actions, /This evidence has no uploaded file/);
    assert.match(actions, /This evidence path is not signable/);
    assert.match(actions, /createSignedUrl\(objectPath, PROJECT_EXECUTION_SIGNED_URL_SECONDS\)|signExecutionObject\(path\)/);
    assert.match(storage, /PROJECT_EXECUTION_SIGNED_URL_SECONDS = 900/);
    assert.doesNotMatch(actions, /formData\.get\("path"\)/);
    assert.doesNotMatch(actions, /searchParams\.get\("path"\)/);
  });

  test("resolve preauth false returns before service-role upload", () => {
    const actions = readFileSync(
      join(root, "src/features/projects/server/project-execution-actions.ts"),
      "utf8"
    );
    const rpcStart = actions.indexOf("async function evidencedRpc");
    const rpcBody = actions.slice(rpcStart);
    const preauthIndex = rpcBody.indexOf("if (preflightError || allowed !== true)");
    const uploadIndex = rpcBody.indexOf("uploadExecutionObject");
    const mutationIndex = rpcBody.indexOf("params.mutationRpc");
    assert.ok(rpcStart > 0 && preauthIndex > 0 && uploadIndex > preauthIndex);
    assert.ok(mutationIndex > uploadIndex);
    assert.match(actions, /deleteExecutionObjectBestEffort/);
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
    assert.match(pgtap, /Suspended assigned designer/);
    assert.match(pgtap, /Create snag after cancellation is denied/);
    assert.match(pgtap, /Create snag after completion is denied/);
    assert.match(pgtap, /Resolve preauth is false after cancellation/);
    assert.match(pgtap, /Resolve preauth is false after completion/);
    assert.match(pgtap, /Hold reason of exactly 1000 characters is accepted/);
    assert.match(pgtap, /Hold reason of 1001 characters is denied/);
    assert.match(pgtap, /Init failure event stores a safe reason code/);
    assert.match(pgtap, /SQLERRM/);
  });

  test("signable execution evidence path requires uploaded prefix and rejects traversal", () => {
    const projectId = "11111111-1111-1111-1111-111111111111";
    assert.equal(
      isSignableExecutionEvidencePath(
        projectId,
        `projects/${projectId}/execution/evidence/snag_resolution/file.pdf`
      ),
      true
    );
    assert.equal(isSignableExecutionEvidencePath(projectId, ""), false);
    assert.equal(
      isSignableExecutionEvidencePath(projectId, `projects/${projectId}/execution/evidence/../secret`),
      false
    );
    assert.equal(
      isSignableExecutionEvidencePath(
        projectId,
        "projects/22222222-2222-2222-2222-222222222222/execution/evidence/x"
      ),
      false
    );
    assert.equal(isSignableExecutionEvidencePath(projectId, "/etc/passwd"), false);
    assert.equal(isSignableExecutionEvidencePath(projectId, `projects/${projectId}/execution/evidence/`), false);
  });
});
