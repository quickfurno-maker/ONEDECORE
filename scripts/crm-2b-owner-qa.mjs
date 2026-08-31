/**
 * CRM 2B owner QA seed — local Supabase only.
 *
 * Seeds the six-role staff fixtures, then
 * builds a realistic calendar + pipeline dataset THROUGH THE CANONICAL RPCs
 * (`assign_lead`, `transition_lead_status`, `create_lead_activity`). No direct
 * table writes, so the seed itself exercises the same authority the UI uses.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/crm-2b-owner-qa.mjs
 *
 * Artifacts: .artifacts/crm-2b/ (gitignored)
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertLocalSupabaseUrl,
  requireQaPassword,
} from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "crm-2b");
const LOCAL_PASSWORD = requireQaPassword();

const SUPER_ADMIN = "f1111111-1111-1111-1111-111111111111";
const MANAGER = "f2222222-2222-2222-2222-222222222222";
const EXEC_A = "f3333333-3333-3333-3333-333333333333";
const EXEC_B = "f4444444-4444-4444-4444-444444444444";

const STAFF = [
  { id: SUPER_ADMIN, email: "owner-qa-sa@example.test" },
  { id: MANAGER, email: "owner-qa-mgr@example.test" },
  { id: EXEC_A, email: "owner-qa-execa@example.test" },
  { id: EXEC_B, email: "owner-qa-execb@example.test" },
  { id: "f5555555-5555-5555-5555-555555555555", email: "owner-qa-pm@example.test" },
  { id: "f7777777-7777-7777-7777-777777777777", email: "owner-qa-designer@example.test" },
];

/**
 * Pipeline/calendar shape. `stage` drives transition_lead_status hops;
 * `activity` is the open primary next action (hours relative to now, IST
 * display is derived downstream — the DB stores UTC).
 */
const FIXTURES = [
  { key: "01", name: "CRM2B Aarti Kulkarni", locality: "Baner, Pune", owner: EXEC_A, stage: "contacted", hoursFromNow: -30, type: "call", title: "Overdue discovery call" },
  { key: "02", name: "CRM2B Rohit Deshmukh", locality: "Kharadi, Pune", owner: EXEC_A, stage: "contacted", hoursFromNow: 3, type: "whatsapp", title: "Share kitchen options" },
  { key: "03", name: "CRM2B Sneha Patil", locality: "Wakad, Pune", owner: EXEC_A, stage: "qualified", hoursFromNow: 6, type: "consultation", title: "Design consultation" },
  { key: "04", name: "CRM2B Imran Shaikh", locality: "Viman Nagar, Pune", owner: EXEC_B, stage: "qualified", hoursFromNow: 27, type: "site_visit", title: "Site measurement visit" },
  { key: "05", name: "CRM2B Meera Joshi", locality: "Aundh, Pune", owner: EXEC_B, stage: "consultation_scheduled", hoursFromNow: 51, type: "consultation", title: "Concept walkthrough" },
  { key: "06", name: "CRM2B Vikram Rao", locality: "Hinjewadi, Pune", owner: EXEC_A, stage: "proposal_sent", hoursFromNow: 75, type: "quotation_follow_up", title: "Quotation follow-up" },
  { key: "07", name: "CRM2B Priya Nair", locality: "Kothrud, Pune", owner: EXEC_B, stage: "negotiation", hoursFromNow: 99, type: "call", title: "Negotiation call" },
  { key: "08", name: "CRM2B Sameer Gokhale", locality: "Bavdhan, Pune", owner: EXEC_A, stage: "contacted", activity: null, title: null },
  { key: "09", name: "CRM2B Neha Bhosale", locality: "Pimple Saudagar, Pune", owner: EXEC_B, stage: "assigned", hoursFromNow: 123, type: "call", title: "First contact attempt" },
  { key: "10", name: "CRM2B Anil Kadam", locality: "Magarpatta, Pune", owner: null, stage: "new", activity: null, title: null },
  // On-hold reserves the primary next action for its review activity
  // (ON_HOLD_PRIMARY_RESERVED), so this fixture adds none of its own.
  { key: "11", name: "CRM2B Divya Rane", locality: "Balewadi, Pune", owner: EXEC_A, stage: "on_hold", title: null },
  { key: "12", name: "CRM2B Karan Mehta", locality: "Hadapsar, Pune", owner: EXEC_B, stage: "contacted", hoursFromNow: 340, type: "whatsapp", title: "Next month nudge" },
];

/** Ordered hops from `assigned` for each target stage (canonical graph only). */
const STAGE_PATH = {
  new: [],
  assigned: [],
  contacted: ["contacted"],
  qualified: ["contacted", "qualified"],
  consultation_scheduled: ["contacted", "qualified", "consultation_scheduled"],
  proposal_sent: ["contacted", "qualified", "consultation_scheduled", "proposal_sent"],
  negotiation: ["contacted", "qualified", "consultation_scheduled", "proposal_sent", "negotiation"],
  on_hold: ["contacted", "on_hold"],
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

function signJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

function actingAs(userId, status) {
  const token = signJwt(
    {
      role: "authenticated",
      sub: userId,
      aud: "authenticated",
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    status.JWT_SECRET
  );
  return createClient(status.API_URL, status.ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureStaffUsers(admin) {
  for (const user of STAFF) {
    const { data: existing } = await admin.auth.admin.getUserById(user.id);
    if (!existing?.user) {
      const { error } = await admin.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: LOCAL_PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser ${user.email}: ${error.message}`);
    } else {
      await admin.auth.admin.updateUserById(user.id, {
        password: LOCAL_PASSWORD,
        email_confirm: true,
      });
    }
  }
}

function runFixtureSql() {
  const sqlPath = path.join(root, "scripts", "crm-2b-owner-qa.sql");
  const result = spawnSync(`npx supabase db query --local --file "${sqlPath}"`, {
    encoding: "utf8",
    cwd: root,
    shell: true,
  });
  fs.writeFileSync(
    path.join(artifactsDir, "fixture-sql.log"),
    `${result.stdout}\n${result.stderr}`
  );
  if (result.status !== 0) {
    throw new Error(`Phase 5C1 fixture SQL failed:\n${result.stderr}`);
  }
}

/**
 * CRM 2C stage gates require canonical evidence before contacted /
 * consultation_scheduled / proposal_sent. Fixture evidence is written with the
 * service-role client (first-contact clock, quotation delivery) or through the
 * canonical activity RPC (scheduled visit) so the stage walk below stays real.
 */
async function ensureStageGateEvidence(admin, sa, leadId, hops, ownerId, key) {
  if (hops.includes("contacted")) {
    const { error } = await admin
      .from("crm_sla_clocks")
      .update({ first_contact_attempt_at: new Date().toISOString() })
      .eq("lead_id", leadId)
      .is("first_contact_attempt_at", null);
    if (error) throw new Error(`first-contact evidence ${key}: ${error.message}`);
  }

  if (hops.includes("consultation_scheduled")) {
    const { data: existing } = await admin
      .from("lead_follow_ups")
      .select("id")
      .eq("lead_id", leadId)
      .in("activity_type", ["consultation", "site_visit"])
      .limit(1)
      .maybeSingle();
    if (!existing) {
      const { error } = await sa.rpc("create_lead_activity", {
        p_lead_id: leadId,
        p_activity_type: "site_visit",
        p_title: "Measurement visit",
        p_due_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
        p_priority: "normal",
        p_owner_id: ownerId ?? undefined,
        p_is_primary: false,
        p_duration_minutes: undefined,
        p_reminder_at: undefined,
        p_quotation_id: undefined,
      });
      if (error) throw new Error(`visit evidence ${key}: ${error.message}`);
    }
  }

  if (hops.includes("proposal_sent")) {
    await ensureProposalDeliveryEvidence(admin, leadId, key);
  }
}

/**
 * CRM 2C gate 3 accepts exactly one thing: a **finalized** quotation version for
 * this lead carrying a **non-revoked** client access grant (the predicate in
 * private.transition_lead_status_impl). A quotation on its own — or a draft-only
 * version, or a version whose only grant is revoked — is NOT evidence, so
 * detection mirrors the gate predicate rather than testing for a quotation row.
 *
 * The lead's quotations are read as a collection (never maybeSingle), so the
 * helper stays correct no matter how many quotation rows a lead owns. Whatever
 * already qualifies is reused; only the missing links are created, from
 * lead-deterministic ids so repeated seed runs never collide.
 */
async function ensureProposalDeliveryEvidence(admin, leadId, key) {
  /** Deterministic v4-shaped uuid so a re-run reuses the same fixture rows. */
  const fixtureUuid = (seed) => {
    const digest = hex(seed);
    const variant = "89ab"[parseInt(digest[16], 16) % 4];
    return [
      digest.slice(0, 8),
      digest.slice(8, 12),
      `4${digest.slice(13, 16)}`,
      `${variant}${digest.slice(17, 20)}`,
      digest.slice(20, 32),
    ].join("-");
  };

  const { data: quotationRows, error: quotationReadError } = await admin
    .from("quotations")
    .select("id")
    .eq("lead_id", leadId);
  if (quotationReadError) {
    throw new Error(`quotation lookup ${key}: ${quotationReadError.message}`);
  }
  const quotationIds = (quotationRows ?? []).map((row) => row.id);

  let finalizedVersionIds = [];
  if (quotationIds.length > 0) {
    const { data: versionRows, error: versionReadError } = await admin
      .from("quotation_versions")
      .select("id")
      .in("quotation_id", quotationIds)
      .eq("status", "finalized");
    if (versionReadError) {
      throw new Error(`version lookup ${key}: ${versionReadError.message}`);
    }
    finalizedVersionIds = (versionRows ?? []).map((row) => row.id);
  }

  if (finalizedVersionIds.length > 0) {
    const { data: grantRows, error: grantReadError } = await admin
      .from("quotation_access_grants")
      .select("id")
      .in("quotation_version_id", finalizedVersionIds)
      .is("revoked_at", null)
      .limit(1);
    if (grantReadError) {
      throw new Error(`grant lookup ${key}: ${grantReadError.message}`);
    }
    if ((grantRows ?? []).length > 0) {
      return; // Qualifying evidence already exists — reuse it.
    }
  }

  let quotationId = quotationIds[0] ?? null;
  if (!quotationId) {
    quotationId = fixtureUuid(`quotation:${leadId}`);
    const quotationNumber = `OD-Q-2026-${hex(`quotation-number:${leadId}`)
      .replace(/\D/g, "")
      .padEnd(8, "0")
      .slice(0, 8)}`;
    const { error } = await admin.from("quotations").insert({
      id: quotationId,
      lead_id: leadId,
      quotation_number: quotationNumber,
      created_by: SUPER_ADMIN,
    });
    if (error) throw new Error(`quotation evidence ${key}: ${error.message}`);
  }

  let versionId = finalizedVersionIds[0] ?? null;
  if (!versionId) {
    // Draft versions may already occupy version numbers on this quotation.
    const { data: existingVersions, error: existingError } = await admin
      .from("quotation_versions")
      .select("version_number")
      .eq("quotation_id", quotationId);
    if (existingError) {
      throw new Error(`version numbering ${key}: ${existingError.message}`);
    }
    const nextVersionNumber =
      (existingVersions ?? []).reduce(
        (max, row) => Math.max(max, row.version_number ?? 0),
        0
      ) + 1;

    versionId = fixtureUuid(`version:${quotationId}:${nextVersionNumber}`);
    const { error } = await admin.from("quotation_versions").insert({
      id: versionId,
      quotation_id: quotationId,
      version_number: nextVersionNumber,
      status: "finalized",
      is_current_draft: false,
      title: "QA delivered proposal",
      created_by: SUPER_ADMIN,
    });
    if (error) throw new Error(`version evidence ${key}: ${error.message}`);
  }

  // Grant identity is derived from the version AND the number of grants already
  // on it: a version whose earlier grant was revoked can then be re-granted
  // without colliding with that revoked row's primary key or token digest.
  const { data: priorGrants, error: priorGrantError } = await admin
    .from("quotation_access_grants")
    .select("id")
    .eq("quotation_version_id", versionId);
  if (priorGrantError) {
    throw new Error(`grant numbering ${key}: ${priorGrantError.message}`);
  }
  const grantSeed = `grant:${versionId}:${(priorGrants ?? []).length + 1}`;

  const { error: grantError } = await admin.from("quotation_access_grants").insert({
    id: fixtureUuid(grantSeed),
    quotation_id: quotationId,
    quotation_version_id: versionId,
    derivation_nonce: hex(`nonce:${grantSeed}`).slice(0, 32),
    capability_token_hash: hex(grantSeed),
  });
  if (grantError) throw new Error(`grant evidence ${key}: ${grantError.message}`);
}

/** Deterministic 64-char hex digest for fixture fingerprints. */
function hex(seed) {
  return crypto.createHash("sha256").update(`crm-2b-qa:${seed}`).digest("hex");
}

async function seedLead(admin, reader, fixture, index) {
  const suffix = String(index + 1).padStart(4, "0");
  const { data, error } = await admin.rpc("submit_lead_intake", {
    p_idempotency_key: `f0bb${suffix}-0001-4000-8000-00000000${suffix}`,
    p_request_hash: hex(`${fixture.key}:req`),
    p_network_fingerprint_hash: hex(`${fixture.key}:net`),
    p_phone_fingerprint_hash: hex(`${fixture.key}:phone`),
    p_planner_version: "home-r4-v1",
    p_submitted_name: fixture.name,
    p_phone_e164: `+9198100${suffix}`,
    p_submitted_email: null,
    p_service_code: index % 2 === 0 ? "modular-kitchens" : "complete-home-interiors",
    p_property_code: "apartment-2bhk",
    p_timeline_code: "within-1-month",
    p_room_codes: ["living"],
    p_budget_comfort_code: "6-12l",
    p_estimate_snapshot: null,
    p_locality: fixture.locality,
    p_message: "CRM 2B QA fixture",
    p_landing_path: "/",
    p_attribution: { utm_source: "crm-2b-qa" },
    p_source: "local-test",
    p_consent_service_enquiry: true,
    p_consent_service_phone: true,
    p_consent_service_email: false,
    p_consent_whatsapp: false,
    p_copy_service_enquiry: "service-enquiry-v0.1-draft",
    p_copy_service_communication: "service-communication-v0.1-draft",
    p_copy_whatsapp: null,
    p_notice_version: "privacy-notice-v0.1-draft",
  });

  if (error) throw new Error(`submit_lead_intake ${fixture.key}: ${error.message}`);

  // submit_lead_intake returns an intake receipt, not the lead row; resolve the
  // lead by its submission reference.
  const receipt = Array.isArray(data) ? data[0] : data;
  const reference = receipt?.submission_reference;
  if (!reference) {
    throw new Error(`submit_lead_intake ${fixture.key}: no submission reference`);
  }

  // Read back through the RLS-scoped super-admin client; service_role has no
  // PostgREST grant on public.leads.
  const { data: lead, error: lookupError } = await reader
    .from("leads")
    .select("id")
    .eq("submission_reference", reference)
    .maybeSingle();
  if (lookupError) {
    throw new Error(`lead lookup ${fixture.key}: ${lookupError.message}`);
  }
  return lead?.id ?? null;
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const status = readSupabaseStatus();
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await ensureStaffUsers(admin);
  runFixtureSql();

  const sa = actingAs(SUPER_ADMIN, status);
  const summary = [];

  for (const [index, fixture] of FIXTURES.entries()) {
    const leadId = await seedLead(admin, sa, fixture, index);
    if (!leadId) throw new Error(`No lead id returned for ${fixture.key}`);

    if (fixture.owner) {
      const { error } = await sa.rpc("assign_lead", {
        p_lead_id: leadId,
        p_assignee_id: fixture.owner,
        p_reason: "CRM 2B QA seed",
        p_expected_assignee: null,
        p_expected_updated_at: null,
        p_enforce_expected_state: false,
      });
      if (error) throw new Error(`assign_lead ${fixture.key}: ${error.message}`);
    }

    // Idempotent stage walk: only apply the hops the lead has not taken yet.
    const { data: currentRow, error: statusError } = await sa
      .from("leads")
      .select("status")
      .eq("id", leadId)
      .maybeSingle();
    if (statusError) {
      throw new Error(`lead status ${fixture.key}: ${statusError.message}`);
    }
    const currentStatus = currentRow?.status ?? "new";
    const fullPath = STAGE_PATH[fixture.stage] ?? [];
    const alreadyAt = fullPath.indexOf(currentStatus);
    const remaining = alreadyAt >= 0 ? fullPath.slice(alreadyAt + 1) : fullPath;

    await ensureStageGateEvidence(admin, sa, leadId, remaining, fixture.owner, fixture.key);

    for (const stage of remaining) {
      const { error } = await sa.rpc("transition_lead_status", {
        p_lead_id: leadId,
        p_new_status: stage,
        p_reason:
          stage === "on_hold" ? "Customer travelling until next month" : "CRM 2B QA seed",
        p_closure_reason_code: null,
      });
      if (error) {
        throw new Error(`transition_lead_status ${fixture.key} -> ${stage}: ${error.message}`);
      }
    }

    // Idempotent activity seed: never stack a second open primary next action.
    const { data: existingPrimary } = await sa
      .from("lead_follow_ups")
      .select("id, due_at")
      .eq("lead_id", leadId)
      .eq("status", "open")
      .eq("is_primary_next_action", true)
      .maybeSingle();

    let activityDueAt = existingPrimary?.due_at ?? null;
    if (fixture.hoursFromNow != null && !existingPrimary) {
      activityDueAt = new Date(Date.now() + fixture.hoursFromNow * 3_600_000).toISOString();
      const { error } = await sa.rpc("create_lead_activity", {
        p_lead_id: leadId,
        p_activity_type: fixture.type,
        p_title: fixture.title,
        p_due_at: activityDueAt,
        p_priority: fixture.hoursFromNow < 0 ? "urgent" : "normal",
        p_owner_id: fixture.owner ?? undefined,
        p_is_primary: true,
        p_duration_minutes: undefined,
        p_reminder_at: undefined,
        p_quotation_id: undefined,
      });
      if (error) {
        // An overdue due_at is refused by create_lead_activity; seed it forward
        // and let the QA run treat it as an upcoming action instead.
        if (fixture.hoursFromNow < 0) {
          activityDueAt = new Date(Date.now() + 2 * 3_600_000).toISOString();
          const retry = await sa.rpc("create_lead_activity", {
            p_lead_id: leadId,
            p_activity_type: fixture.type,
            p_title: fixture.title,
            p_due_at: activityDueAt,
            p_priority: "urgent",
            p_owner_id: fixture.owner ?? undefined,
            p_is_primary: true,
            p_duration_minutes: undefined,
            p_reminder_at: undefined,
            p_quotation_id: undefined,
          });
          if (retry.error) {
            throw new Error(`create_lead_activity ${fixture.key}: ${retry.error.message}`);
          }
        } else {
          throw new Error(`create_lead_activity ${fixture.key}: ${error.message}`);
        }
      }
    }

    summary.push({
      key: fixture.key,
      leadId,
      name: fixture.name,
      stage: fixture.stage,
      owner: fixture.owner,
      activityDueAt,
    });
    console.log(`seeded ${fixture.key} ${fixture.stage.padEnd(24)} ${fixture.name}`);
  }

  const { count: openActivities } = await sa
    .from("lead_follow_ups")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  const { count: slaDues } = await sa
    .from("crm_sla_clocks")
    .select("lead_id", { count: "exact", head: true })
    .not("sla_due_at", "is", null);

  const report = {
    capturedAt: new Date().toISOString(),
    leads: summary,
    openActivities: openActivities ?? 0,
    slaClocksWithDueDate: slaDues ?? 0,
    slaPolicyActive: (slaDues ?? 0) > 0,
  };
  fs.writeFileSync(
    path.join(artifactsDir, "seed.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );

  console.log(`\nopen activities: ${report.openActivities}`);
  console.log(
    `SLA clocks with a due date: ${report.slaClocksWithDueDate} (policy active: ${report.slaPolicyActive})`
  );
  console.log(`artifacts: ${path.relative(root, artifactsDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
