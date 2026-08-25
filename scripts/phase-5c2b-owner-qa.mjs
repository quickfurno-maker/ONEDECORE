/**
 * Phase 5C2B owner QA — local Supabase only.
 * Depends on Phase 5C1 fixture seed (runs phase-5c1-owner-qa.mjs first).
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/phase-5c2b-owner-qa.mjs
 *
 * Artifacts: .artifacts/phase-5c2b/ (gitignored)
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
const artifactsDir = path.join(root, ".artifacts", "phase-5c2b");

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
  designer: {
    id: "f7777777-7777-7777-7777-777777777777",
    email: "owner-qa-designer@example.test",
  },
};

const PII_PREVIEW_KEYS = new Set([
  "submitted_name",
  "phone",
  "email",
  "submitted_email",
  "locality",
  "message",
  "display_name",
  "address_normalized",
]);

const ALLOWED_PREVIEW_KEYS = new Set([
  "outcome_code",
  "can_create",
  "can_override",
  "existing_lead_id",
]);

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

function previewRow(result) {
  if (Array.isArray(result.json)) {
    return result.json[0] ?? null;
  }
  return result.json ?? null;
}

async function checkDuplicate(apiUrl, anonKey, token, params) {
  return restRpc(apiUrl, anonKey, token, "check_manual_lead_duplicate", {
    p_phone: params.phone ?? null,
    p_email: params.email ?? null,
    p_service_code: params.serviceCode,
    p_property_code: params.propertyCode,
    p_locality: params.locality ?? null,
  });
}

async function createManualLead(apiUrl, anonKey, token, params) {
  return restRpc(apiUrl, anonKey, token, "create_manual_lead", {
    p_submitted_name: params.submittedName,
    p_phone: params.phone ?? null,
    p_email: params.email ?? null,
    p_service_code: params.serviceCode,
    p_property_code: params.propertyCode,
    p_timeline_code: params.timelineCode ?? "within-1-month",
    p_primary_source_id: params.primarySourceId,
    p_locality: params.locality ?? null,
    p_budget_comfort_code: params.budgetComfortCode ?? null,
    p_room_codes: params.roomCodes ?? [],
    p_message: params.message ?? null,
    p_source_detail: params.sourceDetail ?? null,
    p_assignee_id: params.assigneeId ?? null,
    p_duplicate_override: params.duplicateOverride ?? false,
    p_duplicate_override_reason: params.duplicateOverrideReason ?? null,
  });
}

async function fetchPrimarySourceId(apiUrl, anonKey, token) {
  const { rows } = await restSelect(
    apiUrl,
    anonKey,
    token,
    "lead_sources",
    "code=eq.phone_call&is_active=eq.true&select=id&limit=1"
  );
  if (rows[0]?.id) {
    return rows[0].id;
  }
  const fallback = await restSelect(
    apiUrl,
    anonKey,
    token,
    "lead_sources",
    "code=eq.manual_entry&is_active=eq.true&select=id&limit=1"
  );
  return fallback.rows[0]?.id ?? null;
}

async function countConsentEvents(apiUrl, anonKey, token) {
  const { rows } = await restSelect(
    apiUrl,
    anonKey,
    token,
    "consent_events",
    "select=id"
  );
  return rows.length;
}

async function getContactIdForPhone(apiUrl, anonKey, token, phone) {
  const { rows } = await restSelect(
    apiUrl,
    anonKey,
    token,
    "contact_channels",
    `channel_type=eq.phone&status=eq.active&address_normalized=eq.${encodeURIComponent(phone)}&select=contact_id&limit=1`
  );
  return rows[0]?.contact_id ?? null;
}

async function closeLeadAsLost(apiUrl, anonKey, token, leadId) {
  return restRpc(apiUrl, anonKey, token, "transition_lead_status", {
    p_lead_id: leadId,
    p_new_status: "closed_lost",
    p_reason: "Owner QA recent-similar fixture closure",
    p_closure_reason_code: "timing",
  });
}

function previewHasOnlyAllowedFields(row) {
  if (!row || typeof row !== "object") {
    return false;
  }
  const keys = Object.keys(row);
  if (keys.length !== ALLOWED_PREVIEW_KEYS.size) {
    return false;
  }
  if (keys.some((key) => PII_PREVIEW_KEYS.has(key))) {
    return false;
  }
  return keys.every((key) => ALLOWED_PREVIEW_KEYS.has(key));
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
    designer: await signIn(apiUrl, anonKey, STAFF.designer.email, password),
  };

  const primarySourceId = await fetchPrimarySourceId(
    apiUrl,
    anonKey,
    tokens.manager
  );
  if (!primarySourceId) {
    throw new Error("Active lead source missing for owner QA");
  }

  const checks = [];
  const record = (name, ok, detail = "") => {
    checks.push({ name, ok, detail });
  };

  const consentBefore = await countConsentEvents(
    apiUrl,
    anonKey,
    tokens.manager
  );

  const createRoles = [
    ["super_admin", tokens.superAdmin],
    ["sales_manager", tokens.manager],
    ["sales_executive", tokens.execA],
  ];
  for (const [role, token] of createRoles) {
    const preview = await checkDuplicate(apiUrl, anonKey, token, {
      phone: "+919810000099",
      serviceCode: "complete-home-interiors",
      propertyCode: "apartment-2bhk",
    });
    record(
      `${role} can run duplicate preview`,
      preview.status < 400,
      rpcMessage(preview)
    );
  }

  const deniedRoles = [
    ["project_manager", tokens.pm],
    ["designer", tokens.designer],
  ];
  for (const [role, token] of deniedRoles) {
    const preview = await checkDuplicate(apiUrl, anonKey, token, {
      phone: "+919810000098",
      serviceCode: "complete-home-interiors",
      propertyCode: "apartment-2bhk",
    });
    record(
      `${role} duplicate preview denied`,
      preview.status >= 400,
      rpcMessage(preview)
    );
    const create = await createManualLead(apiUrl, anonKey, token, {
      submittedName: "Owner QA Denied Create",
      phone: "+919810000097",
      serviceCode: "complete-home-interiors",
      propertyCode: "apartment-2bhk",
      primarySourceId,
    });
    record(
      `${role} manual create denied`,
      create.status >= 400,
      rpcMessage(create)
    );
  }

  const clearPreview = await checkDuplicate(apiUrl, anonKey, tokens.manager, {
    phone: "+919810000001",
    serviceCode: "complete-home-interiors",
    propertyCode: "apartment-2bhk",
  });
  const clearRow = previewRow(clearPreview);
  record(
    "unknown phone duplicate preview returns CLEAR",
    clearPreview.status < 400 && clearRow?.outcome_code === "CLEAR",
    JSON.stringify(clearRow ?? {})
  );

  const fixtureContactId = await getContactIdForPhone(
    apiUrl,
    anonKey,
    tokens.manager,
    "+919800000001"
  );
  const privacyPreview = await checkDuplicate(apiUrl, anonKey, tokens.manager, {
    phone: "+919800000001",
    serviceCode: "modular-kitchens",
    propertyCode: "apartment-3bhk",
    locality: "Owner QA Reuse Locality",
  });
  const privacyRow = previewRow(privacyPreview);
  record(
    "duplicate preview exposes only non-PII outcome fields",
    privacyPreview.status < 400 && previewHasOnlyAllowedFields(privacyRow),
    `keys=${privacyRow ? Object.keys(privacyRow).join(",") : "none"}`
  );
  record(
    "duplicate preview omits contact phone and email values",
    !JSON.stringify(privacyRow ?? {}).includes("+919800000001"),
    "response must not echo submitted phone"
  );

  const execCreate = await createManualLead(apiUrl, anonKey, tokens.execA, {
    submittedName: "Owner QA Exec Self Assign",
    phone: "+919810000002",
    serviceCode: "complete-home-interiors",
    propertyCode: "apartment-2bhk",
    primarySourceId,
  });
  const execLead = execCreate.json;
  record(
    "executive manual create auto-assigns to self",
    execCreate.status < 400 &&
      execLead?.assigned_to === STAFF.execA.id &&
      execLead?.status === "assigned",
    rpcMessage(execCreate)
  );

  const reusePreview = await checkDuplicate(apiUrl, anonKey, tokens.manager, {
    phone: "+919800000001",
    serviceCode: "modular-kitchens",
    propertyCode: "apartment-3bhk",
    locality: "Owner QA Reuse Locality",
  });
  const reusePreviewRow = previewRow(reusePreview);
  record(
    "existing contact preview returns REUSABLE_CONTACT",
    reusePreview.status < 400 &&
      reusePreviewRow?.outcome_code === "REUSABLE_CONTACT",
    JSON.stringify(reusePreviewRow ?? {})
  );

  const reuseCreate = await createManualLead(apiUrl, anonKey, tokens.manager, {
    submittedName: "Owner QA Contact Reuse",
    phone: "+919800000001",
    serviceCode: "modular-kitchens",
    propertyCode: "apartment-3bhk",
    locality: "Owner QA Reuse Locality",
    primarySourceId,
  });
  const reuseLead = reuseCreate.json;
  record(
    "manual create reuses existing contact by phone",
    reuseCreate.status < 400 &&
      Boolean(fixtureContactId) &&
      reuseLead?.contact_id === fixtureContactId,
    `contact=${reuseLead?.contact_id ?? "null"} fixture=${fixtureContactId ?? "null"}`
  );

  const recentSeed = await createManualLead(apiUrl, anonKey, tokens.manager, {
    submittedName: "Owner QA Recent Similar Seed",
    phone: "+919810000016",
    serviceCode: "complete-home-interiors",
    propertyCode: "apartment-2bhk",
    locality: "Owner QA Whitefield",
    primarySourceId,
  });
  const recentSeedLead = recentSeed.json;
  if (!recentSeedLead?.id) {
    record("recent-similar seed lead created", false, rpcMessage(recentSeed));
  } else {
    record("recent-similar seed lead created", true, recentSeedLead.id);
    const close = await closeLeadAsLost(
      apiUrl,
      anonKey,
      tokens.manager,
      recentSeedLead.id
    );
    record(
      "recent-similar seed lead closed",
      close.status < 400,
      rpcMessage(close)
    );

    const recentPreview = await checkDuplicate(apiUrl, anonKey, tokens.manager, {
      phone: "+919810000016",
      serviceCode: "complete-home-interiors",
      propertyCode: "apartment-2bhk",
      locality: "Owner QA Whitefield",
    });
    const recentRow = previewRow(recentPreview);
    record(
      "recent closed similar preview returns RECENT_SIMILAR with override",
      recentPreview.status < 400 &&
        recentRow?.outcome_code === "RECENT_SIMILAR" &&
        recentRow?.can_override === true,
      JSON.stringify(recentRow ?? {})
    );

    const execOverrideDenied = await createManualLead(apiUrl, anonKey, tokens.execA, {
      submittedName: "Owner QA Exec Override Denied",
      phone: "+919810000016",
      serviceCode: "complete-home-interiors",
      propertyCode: "apartment-2bhk",
      locality: "Owner QA Whitefield",
      primarySourceId,
      duplicateOverride: true,
      duplicateOverrideReason: "Executive attempted override without permission",
    });
    record(
      "sales executive duplicate override denied",
      execOverrideDenied.status >= 400,
      rpcMessage(execOverrideDenied)
    );

    const managerOverride = await createManualLead(apiUrl, anonKey, tokens.manager, {
      submittedName: "Owner QA Manager Override",
      phone: "+919810000016",
      serviceCode: "complete-home-interiors",
      propertyCode: "apartment-2bhk",
      locality: "Owner QA Whitefield",
      timelineCode: "immediate",
      primarySourceId,
      duplicateOverride: true,
      duplicateOverrideReason:
        "Manager override for returning client within thirty days",
    });
    const overrideLead = managerOverride.json;
    record(
      "sales manager duplicate override succeeds",
      managerOverride.status < 400 && Boolean(overrideLead?.id),
      rpcMessage(managerOverride)
    );

    if (overrideLead?.id) {
      const { rows: duplicateEvents } = await restSelect(
        apiUrl,
        anonKey,
        tokens.manager,
        "lead_events",
        `lead_id=eq.${overrideLead.id}&event_type=eq.lead.duplicate_detected&select=id`
      );
      record(
        "manager override records duplicate_detected event",
        duplicateEvents.length === 1,
        `events=${duplicateEvents.length}`
      );
    }
  }

  const consentAfter = await countConsentEvents(
    apiUrl,
    anonKey,
    tokens.manager
  );
  record(
    "manual create writes zero consent_events",
    consentAfter === consentBefore,
    `before=${consentBefore} after=${consentAfter}`
  );

  const passCount = checks.filter((c) => c.ok).length;
  const failCount = checks.filter((c) => !c.ok).length;
  const report = {
    phase: "5C2B",
    generatedAt: new Date().toISOString(),
    supabaseUrl: apiUrl,
    dependency: "scripts/phase-5c1-owner-qa.mjs",
    passCount,
    failCount,
    totalChecks: checks.length,
    checks,
    rpcs: ["check_manual_lead_duplicate", "create_manual_lead"],
  };

  const reportPath = path.join(artifactsDir, "owner-qa-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    `Phase 5C2B owner QA: ${passCount}/${checks.length} PASS (${failCount} failed)`
  );

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
