/**
 * Phase 5C2A owner QA — local Supabase only.
 * Depends on Phase 5C1 fixture seed (runs phase-5c1-owner-qa.mjs first).
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/phase-5c2a-owner-qa.mjs
 *
 * Artifacts: .artifacts/phase-5c2a/ (gitignored)
 */
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
const artifactsDir = path.join(root, ".artifacts", "phase-5c2a");

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
  execB: {
    id: "f4444444-4444-4444-4444-444444444444",
    email: "owner-qa-execb@example.test",
  },
  pm: {
    id: "f5555555-5555-5555-5555-555555555555",
    email: "owner-qa-pm@example.test",
  },
  designer: {
    id: "f7777777-7777-7777-7777-777777777777",
    email: "owner-qa-designer@example.test",
  },
};

const HIDDEN_LEAD = "ffffffff-ffff-4fff-8fff-ffffffffffff";

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

function rpcErrorCode(result) {
  return result.json?.code ?? null;
}

function rpcMessage(result) {
  return result.json?.message ?? result.text.slice(0, 200);
}

async function assignLead(apiUrl, anonKey, token, params) {
  return restRpc(apiUrl, anonKey, token, "assign_lead", {
    p_lead_id: params.leadId,
    p_assignee_id: params.assigneeId,
    p_reason: params.reason ?? null,
    p_expected_assignee: params.expectedAssignee ?? null,
    p_expected_updated_at: params.expectedUpdatedAt ?? null,
    p_enforce_expected_state: params.enforceExpectedState ?? true,
  });
}

async function findLeadByName(apiUrl, anonKey, token, name) {
  const { rows } = await restSelect(
    apiUrl,
    anonKey,
    token,
    "leads",
    `submitted_name=eq.${encodeURIComponent(name)}&select=id,status,assigned_to,updated_at&limit=1`
  );
  return rows[0] ?? null;
}

async function countHistory(apiUrl, anonKey, token, leadId) {
  const { rows } = await restSelect(
    apiUrl,
    anonKey,
    token,
    "lead_assignment_history",
    `lead_id=eq.${leadId}&select=id`
  );
  return rows.length;
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
    execB: await signIn(apiUrl, anonKey, STAFF.execB.email, password),
    pm: await signIn(apiUrl, anonKey, STAFF.pm.email, password),
    designer: await signIn(apiUrl, anonKey, STAFF.designer.email, password),
  };

  const checks = [];
  const record = (name, ok, detail = "") => {
    checks.push({ name, ok, detail });
  };

  const unassignedLead = await findLeadByName(
    apiUrl,
    anonKey,
    tokens.manager,
    "Owner QA Unassigned"
  );
  if (!unassignedLead?.id) {
    throw new Error("Owner QA Unassigned lead missing after Phase 5C1 seed");
  }

  const saAssign = await assignLead(apiUrl, anonKey, tokens.superAdmin, {
    leadId: unassignedLead.id,
    assigneeId: STAFF.execA.id,
    reason: "Super Admin initial assignment for owner QA",
    expectedAssignee: null,
    expectedUpdatedAt: unassignedLead.updated_at,
  });
  record(
    "super_admin initial assignment",
    saAssign.status < 400 && saAssign.json?.assigned_to === STAFF.execA.id,
    rpcMessage(saAssign)
  );

  let assignLeadRow = saAssign.json ?? unassignedLead;
  const historyAfterAssign = await countHistory(
    apiUrl,
    anonKey,
    tokens.manager,
    assignLeadRow.id
  );
  record(
    "initial assignment writes history",
    historyAfterAssign >= 1,
    `historyCount=${historyAfterAssign}`
  );

  const execAVisible = await restSelect(
    apiUrl,
    anonKey,
    tokens.execA,
    "leads",
    `id=eq.${assignLeadRow.id}&select=id`
  );
  record(
    "executive A gains visibility after assignment",
    execAVisible.rows.length === 1,
    `rows=${execAVisible.rows.length}`
  );

  const execBDenied = await assignLead(apiUrl, anonKey, tokens.execB, {
    leadId: assignLeadRow.id,
    assigneeId: STAFF.execB.id,
    reason: "Unauthorized executive reassignment attempt",
    expectedAssignee: STAFF.execA.id,
    expectedUpdatedAt: assignLeadRow.updated_at,
  });
  record(
    "sales executive assignment denied",
    execBDenied.status >= 400,
    rpcMessage(execBDenied)
  );

  const pmDenied = await assignLead(apiUrl, anonKey, tokens.pm, {
    leadId: assignLeadRow.id,
    assigneeId: STAFF.execB.id,
    reason: "Unauthorized PM reassignment attempt",
    expectedAssignee: STAFF.execA.id,
    expectedUpdatedAt: assignLeadRow.updated_at,
  });
  record(
    "project manager assignment denied",
    pmDenied.status >= 400,
    rpcMessage(pmDenied)
  );

  const designerDenied = await assignLead(apiUrl, anonKey, tokens.designer, {
    leadId: assignLeadRow.id,
    assigneeId: STAFF.execB.id,
    reason: "Unauthorized designer reassignment attempt",
    expectedAssignee: STAFF.execA.id,
    expectedUpdatedAt: assignLeadRow.updated_at,
  });
  record(
    "designer assignment denied",
    designerDenied.status >= 400,
    rpcMessage(designerDenied)
  );

  const anonDenied = await assignLead(apiUrl, anonKey, null, {
    leadId: assignLeadRow.id,
    assigneeId: STAFF.execB.id,
    reason: "Anonymous assignment attempt",
    expectedAssignee: STAFF.execA.id,
    expectedUpdatedAt: assignLeadRow.updated_at,
  });
  record(
    "anonymous assignment denied",
    anonDenied.status >= 400,
    rpcMessage(anonDenied)
  );

  const ineligibleTarget = await assignLead(apiUrl, anonKey, tokens.manager, {
    leadId: assignLeadRow.id,
    assigneeId: STAFF.manager.id,
    reason: "Attempting to assign to sales manager",
    expectedAssignee: STAFF.execA.id,
    expectedUpdatedAt: assignLeadRow.updated_at,
  });
  record(
    "ineligible sales manager target denied",
    ineligibleTarget.status >= 400 && rpcErrorCode(ineligibleTarget) === "22023",
    rpcMessage(ineligibleTarget)
  );

  const missingLead = await assignLead(apiUrl, anonKey, tokens.manager, {
    leadId: "00000000-0000-4000-8000-000000000001",
    assigneeId: STAFF.execB.id,
    reason: "Missing lead probe",
    expectedAssignee: null,
    expectedUpdatedAt: new Date().toISOString(),
  });
  record(
    "missing lead not-found",
    missingLead.status >= 400 && rpcErrorCode(missingLead) === "P0002",
    rpcMessage(missingLead)
  );

  const inaccessibleLead = await assignLead(apiUrl, anonKey, tokens.manager, {
    leadId: HIDDEN_LEAD,
    assigneeId: STAFF.execB.id,
    reason: "Hidden UUID probe for assign operator",
    expectedAssignee: null,
    expectedUpdatedAt: new Date().toISOString(),
  });
  record(
    "inaccessible or missing lead same not-found for assign operator",
    inaccessibleLead.status >= 400 && rpcErrorCode(inaccessibleLead) === "P0002",
    rpcMessage(inaccessibleLead)
  );

  const historyBeforeNoop = await countHistory(
    apiUrl,
    anonKey,
    tokens.manager,
    assignLeadRow.id
  );
  const noop = await assignLead(apiUrl, anonKey, tokens.manager, {
    leadId: assignLeadRow.id,
    assigneeId: STAFF.execA.id,
    reason: null,
    expectedAssignee: STAFF.execA.id,
    expectedUpdatedAt: assignLeadRow.updated_at,
  });
  const historyAfterNoop = await countHistory(
    apiUrl,
    anonKey,
    tokens.manager,
    assignLeadRow.id
  );
  record(
    "idempotent same-target retry writes no history",
    noop.status < 400 && historyAfterNoop === historyBeforeNoop,
    `before=${historyBeforeNoop} after=${historyAfterNoop}`
  );

  const staleAssignee = await assignLead(apiUrl, anonKey, tokens.manager, {
    leadId: assignLeadRow.id,
    assigneeId: STAFF.execB.id,
    reason: "Stale expected assignee probe",
    expectedAssignee: STAFF.execB.id,
    expectedUpdatedAt: assignLeadRow.updated_at,
  });
  record(
    "stale expected assignee conflict",
    staleAssignee.status >= 400 && rpcErrorCode(staleAssignee) === "P0001",
    rpcMessage(staleAssignee)
  );

  const staleUpdatedAt = await assignLead(apiUrl, anonKey, tokens.manager, {
    leadId: assignLeadRow.id,
    assigneeId: STAFF.execB.id,
    reason: "Stale updated_at probe for reassignment",
    expectedAssignee: STAFF.execA.id,
    expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
  });
  record(
    "stale expected updated_at conflict",
    staleUpdatedAt.status >= 400 && rpcErrorCode(staleUpdatedAt) === "P0001",
    rpcMessage(staleUpdatedAt)
  );

  const shortReason = await assignLead(apiUrl, anonKey, tokens.manager, {
    leadId: assignLeadRow.id,
    assigneeId: STAFF.execB.id,
    reason: "short",
    expectedAssignee: STAFF.execA.id,
    expectedUpdatedAt: assignLeadRow.updated_at,
  });
  record(
    "reassignment short reason rejected",
    shortReason.status >= 400 && rpcErrorCode(shortReason) === "22023",
    rpcMessage(shortReason)
  );

  const reassign = await assignLead(apiUrl, anonKey, tokens.manager, {
    leadId: assignLeadRow.id,
    assigneeId: STAFF.execB.id,
    reason: "Sales Manager reassignment for workload balance",
    expectedAssignee: STAFF.execA.id,
    expectedUpdatedAt: assignLeadRow.updated_at,
  });
  assignLeadRow = reassign.json ?? assignLeadRow;
  record(
    "sales manager reassignment succeeds",
    reassign.status < 400 && assignLeadRow.assigned_to === STAFF.execB.id,
    rpcMessage(reassign)
  );

  const execBVisible = await restSelect(
    apiUrl,
    anonKey,
    tokens.execB,
    "leads",
    `id=eq.${assignLeadRow.id}&select=id`
  );
  const execALost = await restSelect(
    apiUrl,
    anonKey,
    tokens.execA,
    "leads",
    `id=eq.${assignLeadRow.id}&select=id`
  );
  record(
    "reassigned executive B gains visibility",
    execBVisible.rows.length === 1,
    `rows=${execBVisible.rows.length}`
  );
  record(
    "reassigned-away executive A loses visibility",
    execALost.rows.length === 0,
    `rows=${execALost.rows.length}`
  );

  const followUp = await restRpc(apiUrl, anonKey, tokens.manager, "create_lead_follow_up", {
    p_lead_id: assignLeadRow.id,
    p_due_at: new Date(Date.now() + 86_400_000).toISOString(),
    p_owner_id: STAFF.execB.id,
  });
  record(
    "open follow-up fixture created",
    followUp.status < 400,
    rpcMessage(followUp)
  );

  const blockedReassign = await assignLead(apiUrl, anonKey, tokens.manager, {
    leadId: assignLeadRow.id,
    assigneeId: STAFF.execA.id,
    reason: "Blocked reassignment due to third-party follow-up",
    expectedAssignee: STAFF.execB.id,
    expectedUpdatedAt: assignLeadRow.updated_at,
  });
  record(
    "open follow-up blocks reassignment to different owner",
    blockedReassign.status >= 400 && rpcErrorCode(blockedReassign) === "22023",
    rpcMessage(blockedReassign)
  );

  const blockedUnassign = await assignLead(apiUrl, anonKey, tokens.manager, {
    leadId: assignLeadRow.id,
    assigneeId: null,
    reason: "Blocked unassign while follow-up remains open",
    expectedAssignee: STAFF.execB.id,
    expectedUpdatedAt: assignLeadRow.updated_at,
  });
  record(
    "open follow-up blocks unassignment",
    blockedUnassign.status >= 400 && rpcErrorCode(blockedUnassign) === "22023",
    rpcMessage(blockedUnassign)
  );

  const followUpId = followUp.json?.id;
  if (followUpId) {
    await restRpc(apiUrl, anonKey, tokens.manager, "complete_lead_follow_up", {
      p_follow_up_id: followUpId,
      p_outcome: "Completed before safe unassign in owner QA",
    });
  }

  const unassign = await assignLead(apiUrl, anonKey, tokens.manager, {
    leadId: assignLeadRow.id,
    assigneeId: null,
    reason: "Returning lead to new queue after owner QA review",
    expectedAssignee: STAFF.execB.id,
    expectedUpdatedAt: assignLeadRow.updated_at,
  });
  assignLeadRow = unassign.json ?? assignLeadRow;
  record(
    "safe unassignment succeeds",
    unassign.status < 400 &&
      assignLeadRow.status === "new" &&
      assignLeadRow.assigned_to === null,
    rpcMessage(unassign)
  );

  const leadTwo = await findLeadByName(
    apiUrl,
    anonKey,
    tokens.manager,
    "Owner QA Executive B Lead"
  );
  if (leadTwo?.id) {
    const terminalSqlPath = path.join(artifactsDir, "terminal-fixture.sql");
    fs.writeFileSync(
      terminalSqlPath,
      `do $terminal$
begin
  perform set_config('onedecore.crm_transition', '1', true);
  update public.leads
  set status = 'closed_lost',
      closed_lost_reason_id = (select id from public.lead_closure_reasons where is_active = true limit 1),
      closed_lost_note = 'Owner QA terminal guard'
  where submitted_name = 'Owner QA Executive B Lead';
  perform set_config('onedecore.crm_transition', '0', true);
end
$terminal$;
`
    );
    const terminalResult = spawnSync(
      `npx supabase db query --local --file "${terminalSqlPath}"`,
      { cwd: root, encoding: "utf8", shell: true }
    );
    fs.writeFileSync(
      path.join(artifactsDir, "terminal-fixture.log"),
      `${terminalResult.stdout}\n${terminalResult.stderr}`
    );
    const refreshedLead = await findLeadByName(
      apiUrl,
      anonKey,
      tokens.manager,
      "Owner QA Executive B Lead"
    );
    const terminalAssign = await assignLead(apiUrl, anonKey, tokens.manager, {
      leadId: leadTwo.id,
      assigneeId: STAFF.execA.id,
      reason: "Terminal lead reassignment attempt",
      expectedAssignee: refreshedLead?.assigned_to ?? leadTwo.assigned_to,
      expectedUpdatedAt: refreshedLead?.updated_at ?? leadTwo.updated_at,
    });
    record(
      "terminal lead assignment rejected",
      terminalAssign.status >= 400 && rpcErrorCode(terminalAssign) === "22023",
      rpcMessage(terminalAssign)
    );
  } else {
    record("terminal lead assignment rejected", false, "fixture lead missing");
  }

  const passCount = checks.filter((c) => c.ok).length;
  const failCount = checks.filter((c) => !c.ok).length;
  const report = {
    phase: "5C2A",
    generatedAt: new Date().toISOString(),
    supabaseUrl: apiUrl,
    dependency: "scripts/phase-5c1-owner-qa.mjs",
    passCount,
    failCount,
    totalChecks: checks.length,
    checks,
    legacyManagementNote:
      "Legacy management assignment is proven by pgTAP 07_crm_assignment_mutations_test.sql (database gate).",
  };

  fs.writeFileSync(
    path.join(artifactsDir, "owner-qa-report.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(
    `Phase 5C2A owner QA: ${passCount}/${checks.length} PASS (${failCount} failed)`
  );

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
