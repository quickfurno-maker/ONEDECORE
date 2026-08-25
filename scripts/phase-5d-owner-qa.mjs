/**
 * Phase 5D owner QA — local Supabase only.
 * Depends on Phase 5C1 fixture seed (runs phase-5c1-owner-qa.mjs first).
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/phase-5d-owner-qa.mjs
 *
 * Artifacts: .artifacts/phase-5d/ (gitignored)
 */
import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertLocalSupabaseUrl,
  requireQaPassword,
} from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "phase-5d");

const STAFF = {
  superAdmin: {
    id: "f1111111-1111-1111-1111-111111111111",
    email: "owner-qa-sa@example.test",
  },
  manager: {
    id: "f2222222-2222-2222-2222-222222222222",
    email: "owner-qa-mgr@example.test",
  },
  execA: {
    id: "f3333333-3333-3333-3333-333333333333",
    email: "owner-qa-execa@example.test",
  },
  pm: {
    id: "f5555555-5555-5555-5555-555555555555",
    email: "owner-qa-pm@example.test",
  },
};

function readSupabaseStatus() {
  const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  const status = JSON.parse(raw);
  assertLocalSupabaseUrl(status.API_URL, "Supabase API URL");
  return status;
}

function runPhase5c1Seed() {
  const result = spawnSync("node", ["scripts/phase-5c1-owner-qa.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    shell: true,
  });
  fs.writeFileSync(
    path.join(artifactsDir, "phase-5c1-seed.log"),
    `${result.stdout}\n${result.stderr}`
  );
  if (result.status !== 0) {
    throw new Error(`Phase 5C1 seed failed:\n${result.stderr}`);
  }
}

async function signIn(apiUrl, anonKey, email, password) {
  const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Sign-in failed for ${email}: ${response.status}`);
  }
  const json = await response.json();
  return json.access_token;
}

async function restRpc(apiUrl, anonKey, token, fn, body) {
  const response = await fetch(`${apiUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token ?? anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, text, json };
}

async function restSelect(apiUrl, anonKey, token, table, query) {
  const response = await fetch(`${apiUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  const json = await response.json();
  return { status: response.status, rows: Array.isArray(json) ? json : [] };
}

function rpcMessage(result) {
  return result.json?.message ?? result.text.slice(0, 240);
}

async function authorize(apiUrl, anonKey, token, permission) {
  const result = await restRpc(apiUrl, anonKey, token, "authorize", {
    requested_permission: permission,
  });
  return result.status === 200 && result.json === true;
}

async function fetchPrimarySourceId(apiUrl, anonKey, token) {
  const { rows } = await restSelect(
    apiUrl,
    anonKey,
    token,
    "lead_sources",
    "code=eq.phone_call&is_active=eq.true&select=id&limit=1"
  );
  return rows[0]?.id ?? null;
}

function uniquePhone(seed) {
  const n =
    parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 6), 16) %
    10000;
  return `+91950005${String(n).padStart(4, "0")}`;
}

function sampleRows(sourceId, runId) {
  const phone = uniquePhone(`import-${runId}`);
  return [
    {
      row_number: 1,
      submitted_name: "Phase 5D Import Lead",
      phone,
      email: `phase5d-import-${runId}@example.test`,
      service_code: "complete-home-interiors",
      property_code: "apartment-2bhk",
      timeline_code: "within-1-month",
      primary_source_id: sourceId,
      locality: "koregaon park",
      budget_comfort_code: "6-12l",
      room_codes: ["living", "kitchen"],
      message: "Owner QA import row",
      source_detail: "phase-5d-owner-qa",
    },
  ];
}

async function createBatch(apiUrl, anonKey, token, sourceId, suffix) {
  const sha = createHash("sha256").update(`phase-5d-${suffix}`).digest("hex");
  return restRpc(apiUrl, anonKey, token, "create_lead_import_batch", {
    p_client_request_id: randomUUID(),
    p_original_filename: `phase-5d-${suffix}.csv`,
    p_file_sha256: sha,
    p_file_type: "csv",
    p_file_size_bytes: 1024,
    p_worksheet_name: null,
    p_header_fingerprint: createHash("sha256").update("name|phone").digest("hex"),
    p_default_source_id: sourceId,
  });
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const password = requireQaPassword();
  runPhase5c1Seed();

  const status = readSupabaseStatus();
  const apiUrl = status.API_URL;
  const anonKey = status.ANON_KEY;

  const tokens = {
    superAdmin: await signIn(apiUrl, anonKey, STAFF.superAdmin.email, password),
    manager: await signIn(apiUrl, anonKey, STAFF.manager.email, password),
    execA: await signIn(apiUrl, anonKey, STAFF.execA.email, password),
    pm: await signIn(apiUrl, anonKey, STAFF.pm.email, password),
  };

  const sourceId = await fetchPrimarySourceId(apiUrl, anonKey, tokens.manager);
  if (!sourceId) {
    throw new Error("Active lead source missing for Phase 5D owner QA");
  }

  const runId = randomUUID().slice(0, 8);

  const checks = [];
  const record = (name, ok, detail = "") => {
    checks.push({ name, ok, detail });
  };

  record(
    "manager has leads.bulk_import",
    await authorize(apiUrl, anonKey, tokens.manager, "leads.bulk_import")
  );
  record(
    "super admin has leads.bulk_import_approve",
    await authorize(apiUrl, anonKey, tokens.superAdmin, "leads.bulk_import_approve")
  );
  record(
    "super admin has leads.assignment_rules.manage",
    await authorize(
      apiUrl,
      anonKey,
      tokens.superAdmin,
      "leads.assignment_rules.manage"
    )
  );
  record(
    "sales executive lacks leads.bulk_import",
    !(await authorize(apiUrl, anonKey, tokens.execA, "leads.bulk_import"))
  );
  record(
    "project manager lacks leads.bulk_import",
    !(await authorize(apiUrl, anonKey, tokens.pm, "leads.bulk_import"))
  );

  const managerBatch = await createBatch(
    apiUrl,
    anonKey,
    tokens.manager,
    sourceId,
    "manager-flow"
  );
  const managerBatchId = managerBatch.json?.id;
  record(
    "manager can create import batch",
    managerBatch.status === 200 && Boolean(managerBatchId),
    rpcMessage(managerBatch)
  );

  const execBatchAttempt = await createBatch(
    apiUrl,
    anonKey,
    tokens.execA,
    sourceId,
    "exec-denied"
  );
  record(
    "sales executive cannot create import batch",
    execBatchAttempt.status >= 400,
    rpcMessage(execBatchAttempt)
  );

  const mappingResult = await restRpc(
    apiUrl,
    anonKey,
    tokens.manager,
    "replace_lead_import_mapping",
    {
      p_batch_id: managerBatchId,
      p_mapping: { Name: "submitted_name", Phone: "phone", Email: "email" },
      p_default_source_id: sourceId,
    }
  );
  record(
    "manager can replace mapping",
    mappingResult.status === 200,
    rpcMessage(mappingResult)
  );

  const rowsResult = await restRpc(
    apiUrl,
    anonKey,
    tokens.manager,
    "replace_lead_import_rows",
    {
      p_batch_id: managerBatchId,
      p_rows: sampleRows(sourceId, runId),
    }
  );
  record(
    "manager can replace staged rows",
    rowsResult.status === 200,
    rpcMessage(rowsResult)
  );

  const validateResult = await restRpc(
    apiUrl,
    anonKey,
    tokens.manager,
    "validate_lead_import_batch",
    { p_batch_id: managerBatchId }
  );
  const validatedBatch = Array.isArray(validateResult.json)
    ? validateResult.json[0]
    : validateResult.json;
  record(
    "manager can validate batch",
    validateResult.status === 200 && validatedBatch?.status === "ready_for_review",
    rpcMessage(validateResult)
  );

  const revision = validatedBatch?.validation_revision ?? 1;
  const submitResult = await restRpc(
    apiUrl,
    anonKey,
    tokens.manager,
    "submit_lead_import_batch",
    {
      p_batch_id: managerBatchId,
      p_expected_revision: revision,
    }
  );
  const submittedBatch = Array.isArray(submitResult.json)
    ? submitResult.json[0]
    : submitResult.json;
  record(
    "manager can submit batch for approval",
    submitResult.status === 200 &&
      submittedBatch?.status === "pending_super_admin_approval",
    rpcMessage(submitResult)
  );

  const selfApprove = await restRpc(
    apiUrl,
    anonKey,
    tokens.manager,
    "approve_lead_import_batch",
    {
      p_batch_id: managerBatchId,
      p_expected_revision: submittedBatch?.validation_revision ?? revision,
    }
  );
  record(
    "manager cannot approve own batch",
    selfApprove.status >= 400,
    rpcMessage(selfApprove)
  );

  const approveResult = await restRpc(
    apiUrl,
    anonKey,
    tokens.superAdmin,
    "approve_lead_import_batch",
    {
      p_batch_id: managerBatchId,
      p_expected_revision: submittedBatch?.validation_revision ?? revision,
    }
  );
  const approvedBatch = Array.isArray(approveResult.json)
    ? approveResult.json[0]
    : approveResult.json;
  record(
    "super admin can approve manager batch",
    approveResult.status === 200 && approvedBatch?.status === "approved",
    rpcMessage(approveResult)
  );

  const processResult = await restRpc(
    apiUrl,
    anonKey,
    tokens.superAdmin,
    "process_lead_import_batch",
    {
      p_batch_id: managerBatchId,
      p_expected_revision: approvedBatch?.validation_revision ?? revision,
      p_max_rows: 100,
    }
  );
  const processPayload = processResult.json;
  record(
    "super admin can process approved batch",
    processResult.status === 200 && processPayload?.done === true,
    rpcMessage(processResult)
  );

  const importedRows = await restSelect(
    apiUrl,
    anonKey,
    tokens.superAdmin,
    "lead_import_rows",
    `batch_id=eq.${managerBatchId}&import_status=eq.imported&select=lead_id`
  );
  const leadId = importedRows.rows[0]?.lead_id;
  record(
    "import row created lead",
    Boolean(leadId),
    leadId ?? "missing lead_id"
  );

  if (leadId) {
    const leadResult = await restSelect(
      apiUrl,
      anonKey,
      tokens.superAdmin,
      "leads",
      `id=eq.${leadId}&select=entry_method,source`
    );
    const lead = leadResult.rows[0];
    record(
      "imported lead uses entry_method import",
      lead?.entry_method === "import",
      lead?.entry_method ?? "missing"
    );
    record(
      "imported lead uses source bulk-import",
      lead?.source === "bulk-import",
      lead?.source ?? "missing"
    );
  } else {
    record("imported lead uses entry_method import", false, "no lead");
    record("imported lead uses source bulk-import", false, "no lead");
  }

  const directBatch = await createBatch(
    apiUrl,
    anonKey,
    tokens.superAdmin,
    sourceId,
    "direct-flow"
  );
  const directBatchId = directBatch.json?.id;
  await restRpc(apiUrl, anonKey, tokens.superAdmin, "replace_lead_import_rows", {
    p_batch_id: directBatchId,
    p_rows: sampleRows(sourceId, runId).map((row, index) => ({
      ...row,
      row_number: index + 1,
      phone: uniquePhone(`direct-${runId}`),
      email: `phase5d-direct-${runId}@example.test`,
    })),
  });
  const directValidate = await restRpc(
    apiUrl,
    anonKey,
    tokens.superAdmin,
    "validate_lead_import_batch",
    { p_batch_id: directBatchId }
  );
  const directValidated = Array.isArray(directValidate.json)
    ? directValidate.json[0]
    : directValidate.json;
  const directConfirm = await restRpc(
    apiUrl,
    anonKey,
    tokens.superAdmin,
    "confirm_lead_import_batch_direct",
    {
      p_batch_id: directBatchId,
      p_expected_revision: directValidated?.validation_revision ?? 1,
    }
  );
  record(
    "super admin can direct-confirm batch",
    directConfirm.status === 200,
    rpcMessage(directConfirm)
  );

  const managerDirectDenied = await restRpc(
    apiUrl,
    anonKey,
    tokens.manager,
    "confirm_lead_import_batch_direct",
    {
      p_batch_id: directBatchId,
      p_expected_revision: directValidated?.validation_revision ?? 1,
    }
  );
  record(
    "manager cannot direct-confirm batch",
    managerDirectDenied.status >= 400,
    rpcMessage(managerDirectDenied)
  );

  const ruleCreate = await restRpc(
    apiUrl,
    anonKey,
    tokens.superAdmin,
    "create_lead_assignment_rule",
    {
      p_source_id: sourceId,
      p_target_user_id: STAFF.execA.id,
      p_priority: 10,
      p_service_code: "complete-home-interiors",
      p_locality: `phase5d-${runId}`,
      p_budget_comfort_code: null,
    }
  );
  record(
    "super admin can create assignment rule",
    ruleCreate.status === 200,
    rpcMessage(ruleCreate)
  );

  const managerRuleDenied = await restRpc(
    apiUrl,
    anonKey,
    tokens.manager,
    "create_lead_assignment_rule",
    {
      p_source_id: sourceId,
      p_target_user_id: STAFF.execA.id,
      p_priority: 20,
    }
  );
  record(
    "manager cannot create assignment rule",
    managerRuleDenied.status >= 400,
    rpcMessage(managerRuleDenied)
  );

  const rejectBatch = await createBatch(
    apiUrl,
    anonKey,
    tokens.manager,
    sourceId,
    "reject-flow"
  );
  const rejectBatchId = rejectBatch.json?.id;
  await restRpc(apiUrl, anonKey, tokens.manager, "replace_lead_import_rows", {
    p_batch_id: rejectBatchId,
    p_rows: sampleRows(sourceId, runId).map((row) => ({
      ...row,
      phone: uniquePhone(`reject-${runId}`),
      email: `phase5d-reject-${runId}@example.test`,
    })),
  });
  const rejectValidate = await restRpc(
    apiUrl,
    anonKey,
    tokens.manager,
    "validate_lead_import_batch",
    { p_batch_id: rejectBatchId }
  );
  const rejectValidated = Array.isArray(rejectValidate.json)
    ? rejectValidate.json[0]
    : rejectValidate.json;
  await restRpc(apiUrl, anonKey, tokens.manager, "submit_lead_import_batch", {
    p_batch_id: rejectBatchId,
    p_expected_revision: rejectValidated?.validation_revision ?? 1,
  });
  const rejectResult = await restRpc(
    apiUrl,
    anonKey,
    tokens.superAdmin,
    "reject_lead_import_batch",
    {
      p_batch_id: rejectBatchId,
      p_expected_revision: rejectValidated?.validation_revision ?? 1,
      p_rejection_reason: "Owner QA rejection path verification",
    }
  );
  record(
    "super admin can reject pending batch",
    rejectResult.status === 200,
    rpcMessage(rejectResult)
  );

  const cancelBatch = await createBatch(
    apiUrl,
    anonKey,
    tokens.manager,
    sourceId,
    "cancel-flow"
  );
  const cancelBatchId = cancelBatch.json?.id;
  const cancelResult = await restRpc(
    apiUrl,
    anonKey,
    tokens.manager,
    "cancel_lead_import_batch",
    { p_batch_id: cancelBatchId }
  );
  record(
    "manager can cancel draft batch",
    cancelResult.status === 200,
    rpcMessage(cancelResult)
  );

  const oversized = await restRpc(
    apiUrl,
    anonKey,
    tokens.manager,
    "create_lead_import_batch",
    {
      p_client_request_id: randomUUID(),
      p_original_filename: "oversized.csv",
      p_file_sha256: createHash("sha256").update("oversized").digest("hex"),
      p_file_type: "csv",
      p_file_size_bytes: 6 * 1024 * 1024,
      p_default_source_id: sourceId,
    }
  );
  record(
    "oversized file metadata rejected",
    oversized.status >= 400,
    rpcMessage(oversized)
  );

  const passed = checks.filter((check) => check.ok).length;
  const report = {
    phase: "5D",
    passed,
    total: checks.length,
    checks,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(artifactsDir, "owner-qa-report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log(`Phase 5D owner QA: ${passed}/${checks.length} passed`);
  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  }

  if (passed !== checks.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
