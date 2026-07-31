/**
 * Phase 5C1 owner-review local QA runner (local Supabase only).
 * Seeds six-role fixtures, runs RLS SQL proof, and REST filter probes.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/phase-5c1-owner-qa.mjs
 *
 * Artifacts: .artifacts/phase-5c1/ (gitignored)
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
const artifactsDir = path.join(root, ".artifacts", "phase-5c1");
const LOCAL_PASSWORD = requireQaPassword();

const STAFF = [
  { id: "f1111111-1111-1111-1111-111111111111", email: "owner-qa-sa@example.test", role: "super_admin" },
  { id: "f2222222-2222-2222-2222-222222222222", email: "owner-qa-mgr@example.test", role: "sales_manager" },
  { id: "f3333333-3333-3333-3333-333333333333", email: "owner-qa-execa@example.test", role: "sales_executive" },
  { id: "f4444444-4444-4444-4444-444444444444", email: "owner-qa-execb@example.test", role: "sales_executive" },
  { id: "f5555555-5555-5555-5555-555555555555", email: "owner-qa-pm@example.test", role: "project_manager" },
  { id: "f7777777-7777-7777-7777-777777777777", email: "owner-qa-designer@example.test", role: "designer" },
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
      if (error) {
        throw new Error(`createUser ${user.email}: ${error.message}`);
      }
    } else {
      await admin.auth.admin.updateUserById(user.id, {
        password: LOCAL_PASSWORD,
        email_confirm: true,
      });
    }
  }
}

async function restCount(table, userId, jwtSecret, apiKey, apiUrl, query = "") {
  const token = signJwt(
    {
      role: "authenticated",
      sub: userId,
      aud: "authenticated",
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    jwtSecret
  );
  const url = `${apiUrl}/rest/v1/${table}?select=id${query}`;
  const response = await fetch(url, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
      Prefer: "count=exact",
    },
  });
  const range = response.headers.get("content-range") ?? "*/0";
  const total = Number.parseInt(range.split("/")[1] ?? "0", 10);
  return { status: response.status, total, body: await response.text() };
}

async function runTextSearchProbe(adminUrl, anonKey, jwtSecret, userId, queryText) {
  const token = signJwt(
    {
      role: "authenticated",
      sub: userId,
      aud: "authenticated",
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    jwtSecret
  );
  const client = createClient(adminUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const pattern = `%${queryText.replace(/[%_\\]/g, "\\$&")}%`;
  const [nameResult, localityResult] = await Promise.all([
    client.from("leads").select("id,submitted_name,locality").ilike("submitted_name", pattern),
    client.from("leads").select("id,submitted_name,locality").ilike("locality", pattern),
  ]);
  const merged = [...(nameResult.data ?? []), ...(localityResult.data ?? [])];
  const unique = [...new Map(merged.map((row) => [row.id, row])).values()];
  return {
    status: nameResult.error || localityResult.error ? 400 : 200,
    ok: !nameResult.error && !localityResult.error,
    matches: unique.length,
    error: nameResult.error?.message ?? localityResult.error?.message ?? null,
  };
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const status = readSupabaseStatus();
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await ensureStaffUsers(admin);

  const sqlPath = path.join(root, "scripts", "phase-5c1-owner-rls-qa.sql");
  const sqlResult = spawnSync(
    `npx supabase db query --local --file "${sqlPath}"`,
    { encoding: "utf8", cwd: root, shell: true }
  );
  fs.writeFileSync(path.join(artifactsDir, "rls-qa.log"), `${sqlResult.stdout}\n${sqlResult.stderr}`);
  if (sqlResult.status !== 0) {
    throw new Error(`RLS QA SQL failed:\n${sqlResult.stderr}`);
  }

  const managerId = STAFF[1].id;
  const execAId = STAFF[2].id;
  const pmId = STAFF[4].id;

  const { escapeIlikePattern } = await import(
    "../src/features/crm/contracts/lead-list-query.ts"
  );

  const filterCases = [
    { label: "comma", q: "Koregaon Park, Pune" },
    { label: "percent", q: "50%" },
    { label: "underscore", q: "a_b" },
    { label: "parens", q: "Pune (west)" },
    { label: "quotes", q: 'O"Brien' },
    { label: "unicode", q: "शिवाजीनगर" },
  ];

  const filterResults = [];
  for (const testCase of filterCases) {
    const probe = await runTextSearchProbe(
      status.API_URL,
      status.ANON_KEY,
      status.JWT_SECRET,
      managerId,
      testCase.q
    );
    filterResults.push({
      ...testCase,
      pattern: `%${escapeIlikePattern(testCase.q)}%`,
      ...probe,
    });
  }

  const isolation = {
    execA_leads: await restCount("leads", execAId, status.JWT_SECRET, status.ANON_KEY, status.API_URL),
    execA_lead_notes: await restCount("lead_notes", execAId, status.JWT_SECRET, status.ANON_KEY, status.API_URL),
    execB_leads_from_A: await restCount(
      "leads",
      execAId,
      status.JWT_SECRET,
      status.ANON_KEY,
      status.API_URL,
      "&assigned_to=neq." + execAId
    ),
    manager_leads: await restCount("leads", managerId, status.JWT_SECRET, status.ANON_KEY, status.API_URL),
    pm_leads: await restCount("leads", pmId, status.JWT_SECRET, status.ANON_KEY, status.API_URL),
    anon_leads: await restCount("leads", "00000000-0000-0000-0000-000000000000", status.JWT_SECRET, status.ANON_KEY, status.API_URL),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    rlsSql: "PASS",
    filterResults,
    isolation,
    accounts: STAFF.map((s) => ({ role: s.role, email: s.email })),
  };

  fs.writeFileSync(
    path.join(artifactsDir, "owner-qa-report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
