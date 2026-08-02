/**
 * Phase 5C2C owner QA — local Supabase only.
 * Depends on Phase 5C1 fixture seed (runs phase-5c1-owner-qa.mjs first).
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/phase-5c2c-owner-qa.mjs
 *
 * Artifacts: .artifacts/phase-5c2c/04-owner-qa-report.json (gitignored)
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
const artifactsDir = path.join(root, ".artifacts", "phase-5c2c");

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

async function restInsert(apiUrl, anonKey, token, table, body) {
  const response = await fetch(`${apiUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
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

function rpcErrorCode(result) {
  return result.json?.code ?? null;
}

function rpcMessage(result) {
  return result.json?.message ?? result.text.slice(0, 200);
}

function leadRow(result) {
  if (Array.isArray(result.json)) {
    return result.json[0] ?? null;
  }
  return result.json ?? null;
}

async function transitionLead(apiUrl, anonKey, token, params) {
  return restRpc(apiUrl, anonKey, token, "transition_lead_status", {
    p_lead_id: params.leadId,
    p_new_status: params.newStatus,
    p_reason: params.reason ?? null,
    p_closure_reason_code: params.closureReasonCode ?? null,
  });
}

async function createFollowUp(apiUrl, anonKey, token, params) {
  return restRpc(apiUrl, anonKey, token, "create_lead_follow_up", {
    p_lead_id: params.leadId,
    p_due_at: params.dueAt,
    p_owner_id: params.ownerId ?? null,
  });
}

async function completeFollowUp(apiUrl, anonKey, token, followUpId, outcome) {
  return restRpc(apiUrl, anonKey, token, "complete_lead_follow_up", {
    p_follow_up_id: followUpId,
    p_outcome: outcome ?? null,
  });
}

async function cancelFollowUp(apiUrl, anonKey, token, followUpId, outcome) {
  return restRpc(apiUrl, anonKey, token, "cancel_lead_follow_up", {
    p_follow_up_id: followUpId,
    p_outcome: outcome ?? null,
  });
}

async function appendNote(apiUrl, anonKey, token, leadId, body) {
  return restInsert(apiUrl, anonKey, token, "lead_notes", {
    lead_id: leadId,
    body,
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

async function countActivities(apiUrl, anonKey, token, leadId, activityType) {
  const query = activityType
    ? `lead_id=eq.${leadId}&activity_type=eq.${encodeURIComponent(activityType)}&select=id`
    : `lead_id=eq.${leadId}&select=id,activity_type`;
  const { rows } = await restSelect(apiUrl, anonKey, token, "lead_activities", query);
  return rows.length;
}

async function listActivityTypes(apiUrl, anonKey, token, leadId) {
  const { rows } = await restSelect(
    apiUrl,
    anonKey,
    token,
    "lead_activities",
    `lead_id=eq.${leadId}&select=activity_type`
  );
  return rows.map((row) => row.activity_type);
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
  };

  const checks = [];
  const record = (name, ok, detail = "") => {
    checks.push({ name, ok, detail });
  };

  const leadA = await findLeadByName(
    apiUrl,
    anonKey,
    tokens.manager,
    "Owner QA Executive A Lead"
  );
  const leadB = await findLeadByName(
    apiUrl,
    anonKey,
    tokens.manager,
    "Owner QA Executive B Lead"
  );
  if (!leadA?.id || !leadB?.id) {
    throw new Error("Phase 5C1 fixture leads missing for Phase 5C2C owner QA");
  }

  const crossExecTransition = await transitionLead(apiUrl, anonKey, tokens.execB, {
    leadId: leadA.id,
    newStatus: "contacted",
  });
  record(
    "cross-exec transition denied",
    crossExecTransition.status >= 400,
    rpcMessage(crossExecTransition)
  );

  const closedWonDenied = await transitionLead(apiUrl, anonKey, tokens.superAdmin, {
    leadId: leadA.id,
    newStatus: "closed_won",
  });
  record(
    "closed_won denied for super_admin",
    closedWonDenied.status >= 400 &&
      (rpcErrorCode(closedWonDenied) === "P0001" ||
        rpcMessage(closedWonDenied).includes("CLOSED_WON")),
    rpcMessage(closedWonDenied)
  );

  const managerTransition = await transitionLead(apiUrl, anonKey, tokens.manager, {
    leadId: leadB.id,
    newStatus: "contacted",
  });
  const leadBAfterManager = leadRow(managerTransition) ?? leadB;
  record(
    "manager transition assigned->contacted",
    managerTransition.status < 400 && leadBAfterManager.status === "contacted",
    rpcMessage(managerTransition)
  );

  const execOwnTransition = await transitionLead(apiUrl, anonKey, tokens.execA, {
    leadId: leadA.id,
    newStatus: "contacted",
  });
  let leadARow = leadRow(execOwnTransition) ?? leadA;
  record(
    "executive own transition on assigned lead",
    execOwnTransition.status < 400 && leadARow.status === "contacted",
    rpcMessage(execOwnTransition)
  );

  const onHold = await transitionLead(apiUrl, anonKey, tokens.execA, {
    leadId: leadA.id,
    newStatus: "on_hold",
    reason: "Owner QA waiting on client callback",
  });
  leadARow = leadRow(onHold) ?? leadARow;
  record(
    "on_hold with reason",
    onHold.status < 400 && leadARow.status === "on_hold",
    rpcMessage(onHold)
  );

  const resume = await transitionLead(apiUrl, anonKey, tokens.execA, {
    leadId: leadA.id,
    newStatus: "contacted",
  });
  leadARow = leadRow(resume) ?? leadARow;
  record(
    "on_hold resume to prior stage",
    resume.status < 400 && leadARow.status === "contacted",
    rpcMessage(resume)
  );

  const noteAppend = await appendNote(
    apiUrl,
    anonKey,
    tokens.execA,
    leadA.id,
    "Owner QA lifecycle note from executive A"
  );
  const noteRow = leadRow(noteAppend);
  record(
    "note append",
    noteAppend.status < 400 && Boolean(noteRow?.id),
    noteAppend.status < 400 ? `noteId=${noteRow?.id ?? "null"}` : noteAppend.text.slice(0, 200)
  );

  const crossExecNote = await appendNote(
    apiUrl,
    anonKey,
    tokens.execB,
    leadA.id,
    "Unauthorized cross-executive note attempt"
  );
  record(
    "cross-exec note denied",
    crossExecNote.status >= 400,
    crossExecNote.text.slice(0, 200)
  );

  const managerFollowUp = await createFollowUp(apiUrl, anonKey, tokens.manager, {
    leadId: leadA.id,
    dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    ownerId: STAFF.execA.id,
  });
  const managerFollowUpRow = leadRow(managerFollowUp);
  record(
    "manager follow-up owner selection to exec",
    managerFollowUp.status < 400 &&
      managerFollowUpRow?.owner_id === STAFF.execA.id,
    rpcMessage(managerFollowUp)
  );

  const execAlternateOwner = await createFollowUp(apiUrl, anonKey, tokens.execA, {
    leadId: leadA.id,
    dueAt: new Date(Date.now() + 172_800_000).toISOString(),
    ownerId: STAFF.execB.id,
  });
  record(
    "executive alternate owner rejected (forced self)",
    execAlternateOwner.status >= 400,
    rpcMessage(execAlternateOwner)
  );

  const execSelfFollowUp = await createFollowUp(apiUrl, anonKey, tokens.execA, {
    leadId: leadA.id,
    dueAt: new Date(Date.now() + 259_200_000).toISOString(),
    ownerId: STAFF.execA.id,
  });
  const execSelfFollowUpRow = leadRow(execSelfFollowUp);
  record(
    "executive self follow-up created",
    execSelfFollowUp.status < 400 &&
      execSelfFollowUpRow?.owner_id === STAFF.execA.id,
    rpcMessage(execSelfFollowUp)
  );

  if (execSelfFollowUpRow?.id) {
    const complete = await completeFollowUp(
      apiUrl,
      anonKey,
      tokens.execA,
      execSelfFollowUpRow.id,
      "Owner QA follow-up completed by executive"
    );
    const completedRow = leadRow(complete);
    record(
      "complete follow-up",
      complete.status < 400 && completedRow?.status === "completed",
      rpcMessage(complete)
    );
  } else {
    record("complete follow-up", false, "self follow-up fixture missing");
  }

  const cancelFixture = await createFollowUp(apiUrl, anonKey, tokens.execA, {
    leadId: leadA.id,
    dueAt: new Date(Date.now() + 345_600_000).toISOString(),
  });
  const cancelFixtureRow = leadRow(cancelFixture);
  if (cancelFixtureRow?.id) {
    const cancel = await cancelFollowUp(
      apiUrl,
      anonKey,
      tokens.execA,
      cancelFixtureRow.id,
      "Owner QA follow-up cancelled"
    );
    const cancelledRow = leadRow(cancel);
    record(
      "cancel follow-up",
      cancel.status < 400 && cancelledRow?.status === "cancelled",
      rpcMessage(cancel)
    );
  } else {
    record("cancel follow-up", false, "cancel fixture missing");
  }

  if (managerFollowUpRow?.id) {
    const crossExecComplete = await completeFollowUp(
      apiUrl,
      anonKey,
      tokens.execB,
      managerFollowUpRow.id,
      "Unauthorized cross-executive completion"
    );
    record(
      "cross-exec follow-up complete denied",
      crossExecComplete.status >= 400,
      rpcMessage(crossExecComplete)
    );

    const managerComplete = await completeFollowUp(
      apiUrl,
      anonKey,
      tokens.manager,
      managerFollowUpRow.id,
      "Manager completed visible team follow-up"
    );
    const managerCompletedRow = leadRow(managerComplete);
    record(
      "manager completes visible team follow-up",
      managerComplete.status < 400 &&
        managerCompletedRow?.status === "completed",
      rpcMessage(managerComplete)
    );
  } else {
    record("cross-exec follow-up complete denied", false, "manager follow-up missing");
    record("manager completes visible team follow-up", false, "manager follow-up missing");
  }

  const closedLost = await transitionLead(apiUrl, anonKey, tokens.manager, {
    leadId: leadB.id,
    newStatus: "closed_lost",
    reason: "Owner QA closed-lost lifecycle validation note",
    closureReasonCode: "timing",
  });
  const leadBTerminal = leadRow(closedLost) ?? leadBAfterManager;
  record(
    "closed_lost with reason code + note",
    closedLost.status < 400 && leadBTerminal.status === "closed_lost",
    rpcMessage(closedLost)
  );

  const terminalTransition = await transitionLead(apiUrl, anonKey, tokens.manager, {
    leadId: leadB.id,
    newStatus: "qualified",
  });
  record(
    "terminal transition rejected",
    terminalTransition.status >= 400 && rpcErrorCode(terminalTransition) === "22023",
    rpcMessage(terminalTransition)
  );

  const activityTypesA = await listActivityTypes(
    apiUrl,
    anonKey,
    tokens.manager,
    leadA.id
  );
  const requiredActivityTypes = [
    "status.changed",
    "note.created",
    "follow_up.scheduled",
    "follow_up.completed",
    "follow_up.cancelled",
  ];
  const missingActivityTypes = requiredActivityTypes.filter(
    (type) => !activityTypesA.includes(type)
  );
  record(
    "activity rows exist after mutations",
    missingActivityTypes.length === 0,
    missingActivityTypes.length === 0
      ? `types=${activityTypesA.join(",")}`
      : `missing=${missingActivityTypes.join(",")}`
  );

  const activityCountA = await countActivities(
    apiUrl,
    anonKey,
    tokens.manager,
    leadA.id
  );
  record(
    "activity row count positive on lead A",
    activityCountA >= requiredActivityTypes.length,
    `count=${activityCountA}`
  );

  const passCount = checks.filter((c) => c.ok).length;
  const failCount = checks.filter((c) => !c.ok).length;
  const report = {
    phase: "5C2C",
    generatedAt: new Date().toISOString(),
    supabaseUrl: apiUrl,
    dependency: "scripts/phase-5c1-owner-qa.mjs",
    fixtures: {
      executiveALeadId: leadA.id,
      executiveBLeadId: leadB.id,
    },
    passCount,
    failCount,
    totalChecks: checks.length,
    checks,
    rpcs: [
      "transition_lead_status",
      "create_lead_follow_up",
      "complete_lead_follow_up",
      "cancel_lead_follow_up",
    ],
    restMutations: ["lead_notes.insert"],
  };

  const reportPath = path.join(artifactsDir, "04-owner-qa-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    `Phase 5C2C owner QA: ${passCount}/${checks.length} PASS (${failCount} failed)`
  );

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
