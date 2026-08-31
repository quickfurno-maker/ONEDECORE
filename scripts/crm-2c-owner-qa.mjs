/**
 * CRM 2C owner QA seed — local Supabase only.
 *
 * Builds cadence QA data THROUGH THE CANONICAL RPCs (`create_cadence_template`,
 * `replace_cadence_template_steps`, `publish_cadence_template`,
 * `enroll_lead_in_cadence`, `complete_lead_activity`). No direct cadence table
 * writes, so the seed exercises the same authority the UI uses.
 *
 * Run `scripts/crm-2b-owner-qa.mjs` first: this builds on its lead fixtures.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/crm-2c-owner-qa.mjs
 *
 * Artifacts: .artifacts/crm-2c/ (gitignored)
 */
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
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
const artifactsDir = path.join(root, ".artifacts", "crm-2c");

requireQaPassword();

const SUPER_ADMIN = "f1111111-1111-1111-1111-111111111111";
const MANAGER = "f2222222-2222-2222-2222-222222222222";

/**
 * Owner review content only — every interval here is a QA placeholder.
 * OWNER_POLICY_NOT_YET_LOCKED: no production cadence is seeded by any migration.
 */
const CADENCES = [
  {
    name: "QA — New Interior Enquiry Follow-up",
    description: "QA fixture. Timings are placeholders, not owner-locked policy.",
    publish: true,
    steps: [
      { activityType: "call", title: "First contact call", priority: "urgent", delayHours: 2 },
      { activityType: "whatsapp", title: "Send intro and portfolio", priority: "high", delayHours: 6, reminderOffsetMinutes: 30 },
      { activityType: "call", title: "Second attempt", priority: "normal", delayHours: 24 },
      { activityType: "internal_task", title: "Decide: qualify or close lost", priority: "normal", delayHours: 72 },
    ],
  },
  {
    name: "QA — Proposal Follow-up",
    description: "QA fixture for the published read-only view.",
    publish: true,
    steps: [
      { activityType: "call", title: "Confirm quotation received", priority: "high", delayHours: 24 },
      { activityType: "quotation_follow_up", title: "Walk through pricing", priority: "high", delayHours: 48 },
    ],
  },
  {
    name: "QA — Draft Playbook",
    description: "Unpublished draft used to exercise the step editor.",
    publish: false,
    steps: [
      { activityType: "site_visit", title: "Measurement visit", priority: "normal", delayHours: 48, durationMinutes: 90 },
    ],
  },
];

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

async function ensureCadence(manager, admin, spec) {
  const { data: existing } = await admin
    .from("crm_cadence_templates")
    .select("id, status")
    .eq("name", spec.name)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  const { data: created, error } = await manager.rpc("create_cadence_template", {
    p_name: spec.name,
    p_description: spec.description,
  });
  if (error) throw new Error(`create_cadence_template ${spec.name}: ${error.message}`);
  const templateId = created.id;

  const { error: stepsError } = await manager.rpc("replace_cadence_template_steps", {
    p_template_id: templateId,
    p_steps: spec.steps,
  });
  if (stepsError) {
    throw new Error(`replace_cadence_template_steps ${spec.name}: ${stepsError.message}`);
  }

  if (spec.publish) {
    const { error: publishError } = await manager.rpc("publish_cadence_template", {
      p_template_id: templateId,
    });
    if (publishError) {
      throw new Error(`publish_cadence_template ${spec.name}: ${publishError.message}`);
    }
  }

  return templateId;
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const status = readSupabaseStatus();
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const manager = actingAs(MANAGER, status);
  const sa = actingAs(SUPER_ADMIN, status);

  const templateIds = [];
  for (const spec of CADENCES) {
    const id = await ensureCadence(manager, admin, spec);
    templateIds.push({ name: spec.name, id, published: spec.publish });
    console.log(`cadence ready  ${spec.publish ? "published" : "draft    "}  ${spec.name}`);
  }

  const enquiryCadence = templateIds[0].id;

  // Enroll two assigned, non-terminal leads: one left on step 1, one advanced.
  const { data: candidates, error: leadError } = await admin
    .from("leads")
    .select("id, submitted_name, status, assigned_to")
    .in("status", ["assigned", "contacted"])
    .not("assigned_to", "is", null)
    .order("created_at", { ascending: true })
    .limit(4);
  if (leadError) throw new Error(`lead lookup: ${leadError.message}`);

  const enrolled = [];
  for (const lead of candidates ?? []) {
    const { data: live } = await admin
      .from("crm_lead_cadence_enrollments")
      .select("id")
      .eq("lead_id", lead.id)
      .in("status", ["active", "paused"])
      .maybeSingle();
    if (live) {
      enrolled.push({ leadId: lead.id, name: lead.submitted_name, enrollmentId: live.id });
      continue;
    }
    if (enrolled.length >= 2) break;

    const { data: enrollment, error } = await sa.rpc("enroll_lead_in_cadence", {
      p_lead_id: lead.id,
      p_template_id: enquiryCadence,
    });
    if (error) throw new Error(`enroll ${lead.submitted_name}: ${error.message}`);
    enrolled.push({
      leadId: lead.id,
      name: lead.submitted_name,
      enrollmentId: enrollment.id,
    });
    console.log(`enrolled       ${lead.submitted_name}`);
  }

  // Advance the second enrollment one step so QA sees a mid-cadence lead.
  if (enrolled[1]) {
    const { data: openStep } = await admin
      .from("lead_follow_ups")
      .select("id, cadence_step_id")
      .eq("cadence_enrollment_id", enrolled[1].enrollmentId)
      .eq("status", "open")
      .maybeSingle();
    const { data: enrollmentRow } = await admin
      .from("crm_lead_cadence_enrollments")
      .select("current_step_order")
      .eq("id", enrolled[1].enrollmentId)
      .maybeSingle();

    if (openStep && enrollmentRow?.current_step_order === 1) {
      const { error } = await sa.rpc("complete_lead_activity", {
        p_activity_id: openStep.id,
        p_outcome_code: "connected",
        p_completion_note: "CRM 2C QA seed — advanced to step 2",
        p_resolution: "CADENCE_NEXT",
        p_next_activity_type: null,
        p_next_title: null,
        p_next_due_at: null,
        p_next_priority: null,
        p_next_duration_minutes: null,
        p_next_reminder_at: null,
        p_next_quotation_id: null,
        p_on_hold_reason: null,
        p_on_hold_review_at: null,
        p_closed_lost_reason: null,
        p_closure_reason_code: null,
        p_whatsapp_send_intent_id: null,
      });
      if (error) throw new Error(`CADENCE_NEXT advance: ${error.message}`);
      console.log(`advanced       ${enrolled[1].name} to step 2`);
    }
  }

  const { count: cadenceActivities } = await admin
    .from("lead_follow_ups")
    .select("id", { count: "exact", head: true })
    .eq("source", "cadence");
  const { count: sendIntents } = await admin
    .from("whatsapp_send_intents")
    .select("id", { count: "exact", head: true });

  const summary = {
    templates: templateIds,
    enrolled,
    cadenceActivities: cadenceActivities ?? 0,
    whatsappSendIntents: sendIntents ?? 0,
  };
  fs.writeFileSync(
    path.join(artifactsDir, "seed-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`
  );

  console.log(`\ncadence activities: ${summary.cadenceActivities}`);
  console.log(`whatsapp send intents (must stay 0): ${summary.whatsappSendIntents}`);
  console.log(`artifacts: ${path.relative(root, artifactsDir)}`);

  if (summary.whatsappSendIntents !== 0) {
    throw new Error("Cadence seeding must never create a WhatsApp send intent");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
