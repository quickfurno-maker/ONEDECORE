/**
 * Phase 8B M29 runtime containment, prebuild corrections, and orchestration tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { resolveProjectPermissionCapabilities } from "../contracts/permissions.ts";
import { requiresProductionReadyGate } from "../design/domain/production-ready-validator.ts";
import {
  hasCurrentReadyMeasurementSheet,
  validateMeasurementCompletedGate,
} from "../design/domain/measurement-sheet-gate.ts";
import { buildDesignDeliverableEvidence } from "../design/fixtures/synthetic-design.ts";
import { registerDeliverableVersion } from "../design/domain/versioned-deliverables.ts";

const root = process.cwd();

describe("Phase 8B M29 prebuild corrections", () => {
  test("ordinary design transition is current Lead only", () => {
    const lead = resolveProjectPermissionCapabilities({
      profileId: "ld-1",
      role: "designer",
      isAssignedPrimaryPm: false,
      isAssignedLeadDesigner: true,
      isAssignedSupportingDesigner: false,
      isOwningSalesExecutive: false,
    });
    const supporting = resolveProjectPermissionCapabilities({
      profileId: "sd-1",
      role: "designer",
      isAssignedPrimaryPm: false,
      isAssignedLeadDesigner: false,
      isAssignedSupportingDesigner: true,
      isOwningSalesExecutive: false,
    });
    const pm = resolveProjectPermissionCapabilities({
      profileId: "pm-1",
      role: "project_manager",
      isAssignedPrimaryPm: true,
      isAssignedLeadDesigner: false,
      isAssignedSupportingDesigner: false,
      isOwningSalesExecutive: false,
    });
    assert.equal(lead.canUpdateDesignWorkflow, true);
    assert.equal(supporting.canUpdateDesignWorkflow, false);
    assert.equal(pm.canUpdateDesignWorkflow, false);
    assert.equal(pm.canRecordClientApproval, true);
    assert.equal(pm.canHoldOrResumeDesign, true);
    assert.equal(supporting.canRecordClientApproval, false);
  });

  test("production ready gate does not apply to design_completed", () => {
    assert.equal(requiresProductionReadyGate("production_ready"), true);
    assert.equal(requiresProductionReadyGate("design_completed"), false);
  });

  test("measurement completed requires a current ready measurement sheet", () => {
    const missing = validateMeasurementCompletedGate({
      targetState: "measurement_completed",
      versions: [],
    });
    assert.equal(missing.ok, false);
    const version = registerDeliverableVersion({
      deliverableId: "site-sheet",
      kind: "measurement_sheet",
      label: "Sheet v1",
      evidence: buildDesignDeliverableEvidence(1),
      existingVersions: [],
    }).version!;
    assert.equal(hasCurrentReadyMeasurementSheet([version]), true);
    const ok = validateMeasurementCompletedGate({
      targetState: "measurement_completed",
      versions: [version],
    });
    assert.equal(ok.ok, true);
  });
});

describe("Phase 8B M29 server and storage", () => {
  test("storage helper is private, bounded, and upsert-false", () => {
    const src = readFileSync(join(root, "src/features/projects/server/project-design-storage.ts"), "utf8");
    assert.match(src, /server-only/);
    assert.match(src, /project-design-documents/);
    assert.match(src, /upsert: false/);
    assert.match(src, /900/);
    assert.doesNotMatch(src, /quotation-documents|portfolio-public/);
    assert.match(src, /20971520|20 \* 1024 \* 1024/);
    assert.match(src, /application\/pdf/);
    assert.match(src, /normalizeDesignFileName/);
    assert.match(src, /\.\./);
  });

  test("design actions cover staffing, gates, saga, and signed URL", () => {
    const src = readFileSync(join(root, "src/features/projects/server/project-design-actions.ts"), "utf8");
    assert.match(src, /set_project_lead_designer/);
    assert.match(src, /transition_project_design/);
    assert.match(src, /record_project_client_approval/);
    assert.match(src, /hold_project_design/);
    assert.match(src, /approve_project_production_ready/);
    assert.match(src, /complete_project_design/);
    assert.match(src, /reserve_project_design_deliverable_version/);
    assert.match(src, /finalize_project_design_deliverable_version/);
    assert.match(src, /can_view_project_design/);
    assert.match(src, /can_record_project_client_approval/);
    assert.match(src, /can_approve_project_production_ready/);
    assert.match(src, /deleteDesignObjectBestEffort/);
    assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(src, /canUpdateExecutionStages/);
  });

  test("client approval uploaded file preauthorizes before service-role upload", () => {
    const src = readFileSync(join(root, "src/features/projects/server/project-design-actions.ts"), "utf8");
    const fnStart = src.indexOf("export async function recordProjectClientApprovalAction");
    const fnEnd = src.indexOf("export async function approveProjectProductionReadyAction");
    const fn = src.slice(fnStart, fnEnd);
    const preflightAt = fn.indexOf("can_record_project_client_approval");
    const uploadAt = fn.indexOf("uploadDesignObject");
    const rpcAt = fn.lastIndexOf("record_project_client_approval");
    const cleanupAt = fn.indexOf("deleteDesignObjectBestEffort");
    assert.ok(preflightAt >= 0 && uploadAt > preflightAt, "preflight before upload");
    assert.ok(rpcAt > uploadAt, "authoritative RPC after upload");
    assert.ok(cleanupAt > rpcAt, "orphan cleanup retained after mutation");
    assert.match(fn, /allowed !== true/);
  });

  test("production ready uploaded file preauthorizes before service-role upload", () => {
    const src = readFileSync(join(root, "src/features/projects/server/project-design-actions.ts"), "utf8");
    const fnStart = src.indexOf("export async function approveProjectProductionReadyAction");
    const fnEnd = src.indexOf("export async function uploadProjectDesignDeliverableAction");
    const fn = src.slice(fnStart, fnEnd);
    const preflightAt = fn.indexOf("can_approve_project_production_ready");
    const uploadAt = fn.indexOf("uploadDesignObject");
    const rpcAt = fn.lastIndexOf("approve_project_production_ready");
    const cleanupAt = fn.indexOf("deleteDesignObjectBestEffort");
    assert.ok(preflightAt >= 0 && uploadAt > preflightAt, "preflight before upload");
    assert.ok(rpcAt > uploadAt, "authoritative RPC after upload");
    assert.ok(cleanupAt > rpcAt, "orphan cleanup retained after mutation");
    assert.match(fn, /allowed !== true/);
  });

  test("evidence signed URL uses DB identity and 900-second expiry", () => {
    const src = readFileSync(join(root, "src/features/projects/server/project-design-actions.ts"), "utf8");
    const fnStart = src.indexOf("export async function getProjectDesignEvidenceFileUrlAction");
    const fn = src.slice(fnStart);
    assert.match(fn, /evidenceId/);
    assert.doesNotMatch(fn.slice(0, 800), /objectPath/);
    assert.match(fn, /can_view_project_design/);
    assert.match(fn, /from\("project_design_evidence/);
    assert.match(fn, /source_type !== "uploaded_artifact"/);
    assert.match(fn, /projects\/\$\{params.projectId\}\/evidence\//);
    assert.match(fn, /signDesignObject\(row.storage_object_path\)/);
    assert.match(fn, /expiresInSeconds: 900/);
  });

  test("M29 serializes idempotency lock before ledger lookup", () => {
    const migration = readFileSync(
      join(root, "supabase/migrations/20260816140000_designer_assignment_design_collaboration.sql"),
      "utf8"
    );
    for (const fn of [
      "set_project_lead_designer",
      "transition_project_design",
      "record_project_client_approval",
      "hold_project_design",
      "approve_project_production_ready",
      "complete_project_design",
      "reserve_project_design_deliverable_version",
    ]) {
      const start = migration.indexOf(`create or replace function public.${fn}(`);
      assert.ok(start >= 0, fn);
      const next = migration.indexOf("create or replace function public.", start + 10);
      const src = migration.slice(start, next > start ? next : undefined);
      const lockAt = src.indexOf("private.project_idempotency_xact_lock");
      const lookupAt = src.indexOf("from private.project_idempotency_requests");
      assert.ok(lockAt >= 0 && lookupAt > lockAt, `${fn} locks before lookup`);
    }
    assert.match(migration, /project_design_uploaded_evidence_object_exists/);
    assert.match(migration, /can_record_project_client_approval/);
    assert.match(migration, /can_approve_project_production_ready/);
    assert.doesNotMatch(migration, /create table public.project_execution/);
    assert.doesNotMatch(migration, /project_design\.manage/);
  });
});

describe("Phase 8B M29 route mounting", () => {
  test("assigned designer can reach project design workspace; execution stays unmounted", () => {
    const detail = readFileSync(join(root, "src/app/admin/projects/[projectId]/page.tsx"), "utf8");
    const list = readFileSync(join(root, "src/app/admin/projects/page.tsx"), "utf8");
    assert.match(detail, /ProjectDesignWorkspace/);
    assert.match(detail, /role === "designer"/);
    assert.match(detail, /highLevelOnly/);
    assert.doesNotMatch(detail, /ProjectExecutionWorkspace/);
    assert.match(list, /canReadDesign/);
    assert.doesNotMatch(list, /ProjectExecutionWorkspace/);
  });

  test("uploaded evidence exposes Open evidence; high-level SE surface does not", () => {
    const workspace = readFileSync(
      join(root, "src/features/projects/components/design/ProjectDesignWorkspace.tsx"),
      "utf8"
    );
    assert.match(workspace, /Open evidence/);
    assert.match(workspace, /getProjectDesignEvidenceFileUrlAction/);
    assert.match(workspace, /evidenceId: item.id/);
    const highLevelStart = workspace.indexOf("if (highLevelOnly)");
    const highLevel = workspace.slice(highLevelStart, workspace.indexOf("const permitted"));
    assert.doesNotMatch(highLevel, /Open evidence/);
    assert.doesNotMatch(highLevel, /getProjectDesignEvidenceFileUrlAction/);
  });

  test("package scripts include both Phase 8B test files", () => {
    const pkg = readFileSync(join(root, "package.json"), "utf8");
    assert.match(pkg, /phase-8b-design\.test\.ts/);
    assert.match(pkg, /phase-8b-m29-runtime\.test\.ts/);
    assert.match(pkg, /test:app[\s\S]*phase-8b-m29-runtime/);
  });
});
