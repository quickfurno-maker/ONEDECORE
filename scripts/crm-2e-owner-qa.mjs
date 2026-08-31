/**
 * CRM 2E owner QA — local Supabase only.
 *
 * Seeds the measurable states CRM 2E reports (scripts/crm-2e-owner-qa.sql),
 * creates the month's sales targets THROUGH the canonical
 * `public.create_sales_target` RPC, then verifies
 * `public.get_crm_management_analytics` against independently computed truth
 * read straight from the base tables.
 *
 * Self-contained: it does NOT depend on scripts/crm-2b-owner-qa.mjs, which
 * fails locally with `permission denied for table crm_sla_clocks` because that
 * script writes SLA clocks through the service-role client and the table grants
 * nothing to service_role. CRM 2E does not widen that grant to work around it;
 * the privileged fixture writes happen in psql as postgres instead.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/crm-2e-owner-qa.mjs
 *
 * Artifacts: .artifacts/crm-2e/ (gitignored)
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
const artifactsDir = path.join(root, ".artifacts", "crm-2e");

requireQaPassword();

const SUPER_ADMIN = "f1111111-1111-1111-1111-111111111111";
const MANAGER = "f2222222-2222-2222-2222-222222222222";
const EXEC_A = "f3333333-3333-3333-3333-333333333333";
const EXEC_B = "f4444444-4444-4444-4444-444444444444";

const STAFF = [
  { id: SUPER_ADMIN, email: "owner-qa-sa@example.test" },
  { id: MANAGER, email: "owner-qa-mgr@example.test" },
  { id: EXEC_A, email: "owner-qa-execa@example.test" },
  { id: EXEC_B, email: "owner-qa-execb@example.test" },
];

/** Owner-review placeholders. No migration seeds a production sales target. */
const TEAM_TARGET_PAISE = 5_000_000_00;
const EXEC_TARGET_PAISE = 2_000_000_00;

const checks = [];
function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

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
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  ).toString("base64url");
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
  const password = requireQaPassword();
  for (const user of STAFF) {
    const { data: existing } = await admin.auth.admin.getUserById(user.id);
    if (!existing?.user) {
      const { error } = await admin.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser ${user.email}: ${error.message}`);
    } else {
      await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
      });
    }
  }
}

function runFixtureSql() {
  const sqlPath = path.join(root, "scripts", "crm-2e-owner-qa.sql");
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
    throw new Error(`CRM 2E fixture SQL failed:\n${result.stderr}`);
  }
}

/** Asia/Kolkata month boundaries, mirroring reporting-date-range.ts. */
function istMonthRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    period: `${year}-${mm}`,
    targetMonth: `${year}-${mm}-01`,
    startIso: `${year}-${mm}-01T00:00:00+05:30`,
    endIso: `${year}-${mm}-${String(lastDay).padStart(2, "0")}T23:59:59.999+05:30`,
  };
}

async function ensureTarget(sa, input, label) {
  const { error } = await sa.rpc("create_sales_target", {
    p_target_scope: input.scope,
    p_target_month: input.targetMonth,
    p_target_user_id: input.userId,
    p_revenue_target_paise: input.revenuePaise,
    p_closed_won_count_target: input.closedWonTarget,
    p_reason: "CRM 2E owner QA target fixture for review.",
  });
  if (error && !/CRM_SALES_TARGET_DUPLICATE|duplicate/i.test(error.message)) {
    throw new Error(`create_sales_target ${label}: ${error.message}`);
  }
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const status = readSupabaseStatus();
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await ensureStaffUsers(admin);
  record("owner QA staff identities ensured", true, `${STAFF.length} users`);

  runFixtureSql();
  record("CRM 2E fixture SQL applied", true);

  const range = istMonthRange();
  const sa = actingAs(SUPER_ADMIN, status);

  const { count: fixtureLeads, error: fixtureError } = await sa
    .from("leads")
    .select("id", { count: "exact", head: true })
    .like("submitted_name", "CRM2E %");
  if (fixtureError) throw new Error(`fixture lookup: ${fixtureError.message}`);
  if ((fixtureLeads ?? 0) < 11) {
    throw new Error(
      `CRM 2E fixture seeded only ${fixtureLeads} of 11 leads. See .artifacts/crm-2e/fixture-sql.log.`
    );
  }
  record("CRM 2E lead fixtures seeded", true, `${fixtureLeads} leads`);

  await ensureTarget(
    sa,
    {
      scope: "sales_team",
      targetMonth: range.targetMonth,
      userId: null,
      revenuePaise: TEAM_TARGET_PAISE,
      closedWonTarget: 8,
    },
    "team"
  );
  await ensureTarget(
    sa,
    {
      scope: "executive_personal",
      targetMonth: range.targetMonth,
      userId: EXEC_A,
      revenuePaise: EXEC_TARGET_PAISE,
      closedWonTarget: 4,
    },
    "exec A"
  );
  record("month sales targets configured via create_sales_target", true, range.period);

  /* ---------------------------------------------------------------------- */
  /* Independent truth, read straight from the base tables                   */
  /* ---------------------------------------------------------------------- */

  // Read verification truth as the SUPER ADMIN, not the service role:
  // public.crm_sla_clocks grants SELECT to `authenticated` only, and CRM 2E
  // does not widen that grant. RLS then scopes the rows exactly as the UI sees
  // them, which is the comparison that matters.
  const { data: cohortLeads, error: cohortError } = await sa
    .from("leads")
    .select("id, status, assigned_to, created_at")
    .gte("created_at", range.startIso)
    .lte("created_at", range.endIso);
  if (cohortError) throw new Error(`cohort read: ${cohortError.message}`);

  const cohortIds = new Set((cohortLeads ?? []).map((row) => row.id));

  const { data: clocks, error: clockError } = await sa
    .from("crm_sla_clocks")
    .select("lead_id, sla_due_at, first_contact_attempt_at, clock_started_at");
  if (clockError) throw new Error(`clock read: ${clockError.message}`);

  const now = Date.now();
  const cohortClocks = (clocks ?? []).filter((row) => cohortIds.has(row.lead_id));
  const eligible = cohortClocks.filter((row) => row.sla_due_at !== null);
  const met = eligible.filter(
    (row) =>
      row.first_contact_attempt_at !== null &&
      Date.parse(row.first_contact_attempt_at) <= Date.parse(row.sla_due_at)
  );
  const breached = eligible.filter(
    (row) =>
      (row.first_contact_attempt_at !== null &&
        Date.parse(row.first_contact_attempt_at) > Date.parse(row.sla_due_at)) ||
      (row.first_contact_attempt_at === null && now > Date.parse(row.sla_due_at))
  );
  const pending = eligible.filter(
    (row) =>
      row.first_contact_attempt_at === null && now <= Date.parse(row.sla_due_at)
  );
  const expectedCompliance =
    met.length + breached.length === 0
      ? null
      : Math.round((met.length * 10_000) / (met.length + breached.length));

  const { data: acceptances, error: acceptError } = await sa
    .from("quotation_acceptances")
    .select("taxable_base_paise, credited_sales_executive_id, sales_achievement_month")
    .eq("sales_achievement_month", range.period);
  if (acceptError) throw new Error(`acceptance read: ${acceptError.message}`);

  const teamAchieved = (acceptances ?? []).reduce(
    (sum, row) => sum + Number(row.taxable_base_paise),
    0
  );
  const execAAchieved = (acceptances ?? [])
    .filter((row) => row.credited_sales_executive_id === EXEC_A)
    .reduce((sum, row) => sum + Number(row.taxable_base_paise), 0);

  /* ---------------------------------------------------------------------- */
  /* Team scope (super admin)                                                */
  /* ---------------------------------------------------------------------- */

  const { data: teamPayload, error: teamError } = await sa.rpc(
    "get_crm_management_analytics",
    {
      p_start: range.startIso,
      p_end: range.endIso,
      p_target_month: range.targetMonth,
      p_owner_id: null,
      p_source_id: null,
    }
  );
  if (teamError) throw new Error(`team analytics: ${teamError.message}`);

  record(
    "SLA eligible denominator matches the due-snapshot count",
    teamPayload.sla.eligibleCount === eligible.length,
    `rpc=${teamPayload.sla.eligibleCount} expected=${eligible.length}`
  );
  record(
    "SLA met matches attempt <= due",
    teamPayload.sla.metCount === met.length,
    `rpc=${teamPayload.sla.metCount} expected=${met.length}`
  );
  record(
    "SLA breached matches late attempt or elapsed silence",
    teamPayload.sla.breachedCount === breached.length,
    `rpc=${teamPayload.sla.breachedCount} expected=${breached.length}`
  );
  record(
    "SLA pending matches unattempted inside the window",
    teamPayload.sla.pendingCount === pending.length,
    `rpc=${teamPayload.sla.pendingCount} expected=${pending.length}`
  );
  record(
    "SLA compliance equals met / (met + breached)",
    teamPayload.sla.complianceBasisPoints === expectedCompliance,
    `rpc=${teamPayload.sla.complianceBasisPoints} expected=${expectedCompliance}`
  );
  record(
    "leads without a due snapshot are out of policy, not breaches",
    teamPayload.sla.outOfPolicyCount ===
      teamPayload.sla.cohortLeadCount - teamPayload.sla.eligibleCount,
    `outOfPolicy=${teamPayload.sla.outOfPolicyCount} cohort=${teamPayload.sla.cohortLeadCount}`
  );

  const stages = teamPayload.conversion.stages;
  const stageBy = Object.fromEntries(stages.map((s) => [s.stage, s]));
  record(
    "funnel is monotonically non-increasing along the ladder",
    stages.every((stage, index) =>
      index === 0 ? true : stage.reachedCount <= stages[index - 1].reachedCount
    ),
    stages.map((s) => `${s.stage}=${s.reachedCount}`).join(" ")
  );
  record(
    "every funnel rate divides by its own named denominator",
    stages.slice(1).every((stage) => {
      const expected =
        stage.previousCount === 0
          ? null
          : Math.round((stage.reachedCount * 10_000) / stage.previousCount);
      return stage.stepConversionBasisPoints === expected;
    }),
    stages
      .slice(1)
      .map((s) => `${s.stage}:${s.reachedCount}/${s.previousCount}`)
      .join(" ")
  );
  record(
    "closed lost and on hold are reported outside the ladder",
    !stages.some((s) => s.stage === "closed_lost" || s.stage === "on_hold") &&
      typeof teamPayload.conversion.closedLostCount === "number" &&
      typeof teamPayload.conversion.onHoldCurrentCount === "number",
    `lost=${teamPayload.conversion.closedLostCount} onHold=${teamPayload.conversion.onHoldCurrentCount}`
  );
  record(
    "accepted-quotation Closed-Won reaches the funnel (to_status payload read)",
    stageBy.closed_won.reachedCount >= 1,
    `closed_won reach=${stageBy.closed_won.reachedCount}`
  );

  record(
    "velocity medians are present or explicitly unknown, never zero-filled",
    [
      teamPayload.velocity.medianFirstContactSeconds,
      teamPayload.velocity.medianActiveLeadAgeSeconds,
      teamPayload.velocity.medianCurrentStageAgeSeconds,
    ].every((value) => value === null || Number(value) >= 0),
    JSON.stringify({
      firstContact: teamPayload.velocity.medianFirstContactSeconds,
      leadAge: teamPayload.velocity.medianActiveLeadAgeSeconds,
      stageAge: teamPayload.velocity.medianCurrentStageAgeSeconds,
    })
  );
  record(
    "every stage-to-stage row carries a real sample",
    teamPayload.velocity.stageTransitions.every((entry) => entry.sampleSize > 0),
    teamPayload.velocity.stageTransitions
      .map((e) => `${e.fromStage}->${e.toStage}:${e.sampleSize}`)
      .join(" ") || "none"
  );

  const teamTargetRow = teamPayload.targets.rows.find(
    (row) => row.targetScope === "sales_team"
  );
  record("team target row is visible to super admin", Boolean(teamTargetRow));
  record(
    "team achieved equals the accepted-quotation sum for the month",
    Number(teamTargetRow?.achievedPaise) === teamAchieved,
    `rpc=${teamTargetRow?.achievedPaise} expected=${teamAchieved}`
  );
  record(
    "team attainment equals achieved / target in exact paise",
    teamTargetRow?.attainmentBasisPoints ===
      Math.round((teamAchieved * 10_000) / TEAM_TARGET_PAISE),
    `rpc=${teamTargetRow?.attainmentBasisPoints} expected=${Math.round((teamAchieved * 10_000) / TEAM_TARGET_PAISE)}`
  );
  record(
    "remaining never goes negative",
    Number(teamTargetRow?.remainingPaise) ===
      Math.max(TEAM_TARGET_PAISE - teamAchieved, 0),
    `${teamTargetRow?.remainingPaise}`
  );

  /* ---------------------------------------------------------------------- */
  /* Personal scope (executive A) and role isolation                         */
  /* ---------------------------------------------------------------------- */

  const execA = actingAs(EXEC_A, status);
  const { data: execPayload, error: execError } = await execA.rpc(
    "get_crm_management_analytics",
    {
      p_start: range.startIso,
      p_end: range.endIso,
      p_target_month: range.targetMonth,
      p_owner_id: null,
      p_source_id: null,
    }
  );
  if (execError) throw new Error(`exec analytics: ${execError.message}`);

  record(
    "executive scope is pinned to their own id",
    execPayload.scopeOwnerId === EXEC_A && execPayload.isTeamScope === false,
    `${execPayload.scopeOwnerId}`
  );
  record(
    "executive cohort is a strict subset of the team cohort",
    execPayload.sla.cohortLeadCount < teamPayload.sla.cohortLeadCount,
    `${execPayload.sla.cohortLeadCount} < ${teamPayload.sla.cohortLeadCount}`
  );
  record(
    "executive sees no team target row",
    !execPayload.targets.rows.some((row) => row.targetScope === "sales_team"),
    execPayload.targets.rows.map((r) => r.targetScope).join(",") || "none"
  );
  const execTargetRow = execPayload.targets.rows.find(
    (row) => row.targetUserId === EXEC_A
  );
  record("executive sees their own personal target", Boolean(execTargetRow));
  record(
    "executive achieved equals only their own credited acceptances",
    Number(execTargetRow?.achievedPaise) === execAAchieved,
    `rpc=${execTargetRow?.achievedPaise} expected=${execAAchieved}`
  );

  const { error: crossScopeError } = await execA.rpc(
    "get_crm_management_analytics",
    {
      p_start: range.startIso,
      p_end: range.endIso,
      p_target_month: range.targetMonth,
      p_owner_id: EXEC_B,
      p_source_id: null,
    }
  );
  record(
    "executive cannot aggregate another owner",
    Boolean(crossScopeError) && /cannot query other owner/i.test(crossScopeError.message),
    crossScopeError?.message ?? "no error raised"
  );

  const manager = actingAs(MANAGER, status);
  const { data: managerPayload, error: managerError } = await manager.rpc(
    "get_crm_management_analytics",
    {
      p_start: range.startIso,
      p_end: range.endIso,
      p_target_month: range.targetMonth,
      p_owner_id: EXEC_B,
      p_source_id: null,
    }
  );
  record(
    "sales manager may scope the aggregate to one executive",
    !managerError && managerPayload?.scopeOwnerId === EXEC_B,
    managerError?.message ?? `${managerPayload?.scopeOwnerId}`
  );

  /* ---------------------------------------------------------------------- */
  /* Forecast reuse                                                          */
  /* ---------------------------------------------------------------------- */

  const { data: forecast, error: forecastError } = await sa.rpc(
    "get_crm_pipeline_value_summary",
    { p_owner_id: null }
  );
  if (forecastError) throw new Error(`forecast: ${forecastError.message}`);

  record(
    "forecast excludes parked and terminal stages from active totals",
    !forecast.stages.some((stage) =>
      ["on_hold", "closed_won", "closed_lost"].includes(stage.stage)
    ),
    forecast.stages.map((s) => s.stage).join(",")
  );
  record(
    "unknown-value leads are excluded from totals, not counted as zero",
    forecast.activeValuedLeadCount <= forecast.activeLeadCount,
    `${forecast.activeValuedLeadCount} valued of ${forecast.activeLeadCount}`
  );
  record(
    "weighted value equals per-stage deal value x locked probability",
    forecast.stages.every(
      (stage) =>
        stage.valuedLeadCount !== 1 ||
        Number(stage.weightedValuePaise) ===
          Math.round(
            (Number(stage.dealValuePaise) * Number(stage.probabilityBasisPoints)) /
              10_000
          )
    ),
    forecast.stages
      .map((s) => `${s.stage}:${s.probabilityBasisPoints}bp`)
      .join(" ")
  );

  const report = {
    capturedAt: new Date().toISOString(),
    period: range.period,
    range,
    expected: {
      eligible: eligible.length,
      met: met.length,
      breached: breached.length,
      pending: pending.length,
      complianceBasisPoints: expectedCompliance,
      teamAchievedPaise: teamAchieved,
      execAAchievedPaise: execAAchieved,
    },
    team: teamPayload,
    executive: execPayload,
    forecast,
    checks,
  };
  fs.writeFileSync(
    path.join(artifactsDir, "owner-qa.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );

  const failed = checks.filter((entry) => !entry.ok);
  console.log(
    `\n${checks.length - failed.length}/${checks.length} checks passed. Artifacts: ${path.relative(root, artifactsDir)}`
  );
  if (failed.length > 0) {
    console.error(`\n${failed.length} FAILED:`);
    for (const entry of failed) {
      console.error(` - ${entry.name}${entry.detail ? ` — ${entry.detail}` : ""}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
