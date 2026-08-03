/**
 * Phase 5E owner QA — local Supabase only.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/phase-5e-owner-qa.mjs
 */
import { createHash } from "node:crypto";
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
const artifactsDir = path.join(root, ".artifacts", "phase-5e-b");
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

function runSeed() {
  const result = spawnSync("node", ["scripts/phase-5c1-owner-qa.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error(`Phase 5C1 seed failed:\n${result.stderr}`);
  }
}

async function signIn(apiUrl, anonKey, email, password) {
  const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Sign-in failed for ${email}`);
  return response.json();
}

async function restRpc(apiUrl, anonKey, token, fn, body) {
  const response = await fetch(`${apiUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, text, ok: response.ok };
}

async function authorize(apiUrl, anonKey, token, permission) {
  const result = await restRpc(apiUrl, anonKey, token, "authorize", {
    requested_permission: permission,
  });
  return result.ok && JSON.parse(result.text) === true;
}

function isDuplicateTargetError(result) {
  return (
    result.text.includes("CRM_SALES_TARGET_DUPLICATE") ||
    result.text.includes('"code":"23505"')
  );
}

function recordCreateOrExisting(name, result) {
  if (result.ok) {
    record(name, true);
    return;
  }
  if (isDuplicateTargetError(result)) {
    record(name, true, "already seeded");
    return;
  }
  record(name, false, result.text.slice(0, 120));
}

const STAFF = {
  sa: { id: "f1111111-1111-1111-1111-111111111111", email: "owner-qa-sa@example.test" },
  mgr: { id: "f2222222-2222-2222-2222-222222222222", email: "owner-qa-mgr@example.test" },
  exec: { id: "f3333333-3333-3333-3333-333333333333", email: "owner-qa-execa@example.test" },
  pm: { id: "f5555555-5555-5555-5555-555555555555", email: "owner-qa-pm@example.test" },
};

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const password = requireQaPassword();
  runSeed();
  const status = readSupabaseStatus();

  const migrationPath = path.join(
    root,
    "supabase/migrations/20260803140000_crm_sales_targets_reporting_foundation.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  const m16Hash = createHash("sha256").update(migrationSql).digest("hex").toUpperCase();
  fs.writeFileSync(path.join(artifactsDir, "m16-hash.txt"), m16Hash);

  const migrations = fs
    .readdirSync(path.join(root, "supabase/migrations"))
    .filter((name) => name.endsWith(".sql"));
  record("exactly one M16 migration file", migrations.filter((n) => n.includes("sales_targets")).length === 1);
  record("no M17 migration file", !migrations.some((n) => /20260804|m17/i.test(n)));
  record("M16 defines sales_targets table", migrationSql.includes("create table public.sales_targets"));
  record("M16 defines reporting index", migrationSql.includes("idx_lead_follow_ups_owner_status_due"));
  record("no achieved_revenue column", !/achieved_revenue/i.test(migrationSql));
  record("achievement inactive copy in app", fs.readFileSync(
    path.join(root, "src/features/crm/contracts/sales-target-contracts.ts"),
    "utf8"
  ).includes("Not activated until quotation acceptance (Phase 7B)"));

  const tokens = {};
  for (const [key, account] of Object.entries(STAFF)) {
    const session = await signIn(status.API_URL, status.ANON_KEY, account.email, password);
    tokens[key] = session.access_token;
  }

  record("SA sales_targets.manage", await authorize(status.API_URL, status.ANON_KEY, tokens.sa, "sales_targets.manage"));
  record("manager denied sales_targets.manage", !(await authorize(status.API_URL, status.ANON_KEY, tokens.mgr, "sales_targets.manage")));
  record("exec sales_targets.read", await authorize(status.API_URL, status.ANON_KEY, tokens.exec, "sales_targets.read"));
  record("PM denied sales_targets.read", !(await authorize(status.API_URL, status.ANON_KEY, tokens.pm, "sales_targets.read")));
  record("exec crm.reporting.read", await authorize(status.API_URL, status.ANON_KEY, tokens.exec, "crm.reporting.read"));

  const teamCreate = await restRpc(status.API_URL, status.ANON_KEY, tokens.sa, "create_sales_target", {
    p_target_scope: "sales_team",
    p_target_month: "2026-10-01",
    p_target_user_id: null,
    p_revenue_target_paise: 100000000,
    p_closed_won_count_target: 12,
    p_reason: "Owner QA team target for October reporting validation cycle.",
  });
  recordCreateOrExisting("SA creates team target", teamCreate);

  const execCreate = await restRpc(status.API_URL, status.ANON_KEY, tokens.sa, "create_sales_target", {
    p_target_scope: "executive_personal",
    p_target_month: "2026-10-01",
    p_target_user_id: STAFF.exec.id,
    p_revenue_target_paise: 50000000,
    p_closed_won_count_target: 6,
    p_reason: "Owner QA executive target for assignable sales executive validation.",
  });
  recordCreateOrExisting("SA creates executive target", execCreate);

  const mgrCreate = await restRpc(status.API_URL, status.ANON_KEY, tokens.mgr, "create_sales_target", {
    p_target_scope: "executive_personal",
    p_target_month: "2026-11-01",
    p_target_user_id: STAFF.exec.id,
    p_revenue_target_paise: 50000000,
    p_closed_won_count_target: 6,
    p_reason: "Manager must not be able to create any sales target in Phase 5E.",
  });
  record("manager create denied", mgrCreate.status === 403 || mgrCreate.text.includes("PERMISSION"));

  record("targets route exists", fs.existsSync(path.join(root, "src/app/admin/crm/targets/page.tsx")));
  record("reports route exists", fs.existsSync(path.join(root, "src/app/admin/crm/reports/page.tsx")));
  record("no chart dependency added", !fs.readFileSync(path.join(root, "package.json"), "utf8").match(/recharts|chart\.js|victory/i));

  const pkg = fs.readFileSync(path.join(root, "package.json"), "utf8");
  record("public intake unchanged", !pkg.includes("LEAD_INTAKE_MODE=active"));
  record("Landing Page Lab not implemented", !fs.existsSync(path.join(root, "src/app/admin/marketing")));

  const failed = checks.filter((c) => !c.ok);
  fs.writeFileSync(
    path.join(artifactsDir, "owner-qa-report.json"),
    JSON.stringify({ passed: checks.length - failed.length, total: checks.length, checks }, null, 2)
  );
  console.log(`\nOwner QA: ${checks.length - failed.length}/${checks.length}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
