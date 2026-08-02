/**
 * Phase 5C2C browser QA — local development server only.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' PHASE_5C2C_BASE_URL=http://localhost:3000 node scripts/phase-5c2c-browser-qa.mjs
 *
 * After phase-5c2c-owner-qa.mjs on the same DB, skip the duplicate 5C1 seed:
 *   PHASE_5C2C_SKIP_C1_SEED=1 node scripts/phase-5c2c-browser-qa.mjs
 *
 * Depends on Phase 5C1 fixture seed (owner-qa-sa/mgr/execa/execb/pm/designer @example.test).
 * Artifacts: .artifacts/phase-5c2c/browser/ (gitignored)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertLocalAppUrl,
  assertLocalSupabaseUrl,
  requireQaPassword,
} from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "phase-5c2c", "browser");
const BASE =
  process.env.PHASE_5C2C_BASE_URL ??
  process.env.PHASE_5C1_BASE_URL ??
  "http://localhost:3000";
const PASSWORD = requireQaPassword();

assertLocalAppUrl(BASE, "PHASE_5C2C_BASE_URL");

const VIEWPORTS = [
  { label: "desktop-1440", width: 1440, height: 900, fullE2E: true },
  { label: "tablet-768", width: 768, height: 1024, fullE2E: false },
  { label: "mobile-390", width: 390, height: 844, fullE2E: false },
  { label: "mobile-360", width: 360, height: 800, fullE2E: false },
];

const DENIED_ACCOUNTS = [
  { role: "project_manager", email: "owner-qa-pm@example.test" },
  { role: "designer", email: "owner-qa-designer@example.test" },
];

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const nodeModules = path.join(
      root,
      "onedecore-chatgpt",
      "phase-i2-active-local-smoke",
      "node_modules",
      "playwright"
    );
    return import(pathToFileURL(path.join(nodeModules, "index.js")).href);
  }
}

function shouldSkipC1Seed() {
  const flag = process.env.PHASE_5C2C_SKIP_C1_SEED ?? "";
  return flag === "1" || flag.toLowerCase() === "true";
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

async function signInRest(email, password, apiUrl, anonKey) {
  const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Fixture sign-in failed for ${email}`);
  }
  const json = await response.json();
  return json.access_token;
}

async function findLeadId(token, apiUrl, anonKey, name) {
  const response = await fetch(
    `${apiUrl}/rest/v1/leads?submitted_name=eq.${encodeURIComponent(name)}&select=id,status&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } }
  );
  const rows = await response.json();
  return rows[0] ?? null;
}

async function resetLifecycleFixtures(password) {
  const status = readSupabaseStatus();
  const token = await signInRest(
    "owner-qa-mgr@example.test",
    password,
    status.API_URL,
    status.ANON_KEY
  );
  const leadA = await findLeadId(
    token,
    status.API_URL,
    status.ANON_KEY,
    "Owner QA Executive A Lead"
  );
  const leadB = await findLeadId(
    token,
    status.API_URL,
    status.ANON_KEY,
    "Owner QA Executive B Lead"
  );
  if (!leadA?.id || !leadB?.id) {
    throw new Error("Phase 5C1 fixture leads missing for browser QA");
  }

  const sqlPath = path.join(artifactsDir, "browser-fixture-reset.sql");
  fs.writeFileSync(
    sqlPath,
    `do $reset$
begin
  perform set_config('onedecore.crm_transition', '1', true);

  delete from public.lead_follow_ups
  where lead_id in ('${leadA.id}'::uuid, '${leadB.id}'::uuid);

  update public.leads
  set status = 'assigned',
      closed_lost_reason_id = null,
      closed_lost_note = null,
      on_hold_reason = null,
      on_hold_since = null,
      on_hold_previous_status = null,
      updated_at = now()
  where id in ('${leadA.id}'::uuid, '${leadB.id}'::uuid);

  perform set_config('onedecore.crm_transition', '0', true);
end
$reset$;
`
  );

  const resetResult = spawnSync(
    `npx supabase db query --local --file "${sqlPath}"`,
    { cwd: root, encoding: "utf8", shell: true }
  );
  fs.writeFileSync(
    path.join(artifactsDir, "browser-fixture-reset.log"),
    `${resetResult.stdout}\n${resetResult.stderr}`
  );
  if (resetResult.status !== 0) {
    throw new Error(`Browser fixture reset failed:\n${resetResult.stderr}`);
  }

  return { leadAId: leadA.id, leadBId: leadB.id };
}

async function login(page, email, context, { expectAdmin = true } = {}) {
  if (context) {
    await context.clearCookies();
  }
  await page.goto(
    `${BASE}/auth/login?next=${encodeURIComponent("/admin/crm/leads")}`,
    {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    }
  );
  await page.locator("#email").waitFor({ timeout: 60000 });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(
    expectAdmin ? /\/admin\// : /\/(admin|auth\/forbidden)/,
    { timeout: 60000 }
  );
}

async function openLeadDetail(page, leadId) {
  await page.goto(`${BASE}/admin/crm/leads/${leadId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page
    .locator('[data-testid="lead-status-transition-panel"]')
    .waitFor({ timeout: 60000 });
}

function attachServerActionFailureGuards(page, leadId) {
  const failures = [];
  const leadPathPattern = new RegExp(`/admin/crm/leads/${leadId}`);

  page.on("response", (response) => {
    const request = response.request();
    if (request.method() === "POST" && leadPathPattern.test(response.url())) {
      if (response.status() >= 500) {
        failures.push(`HTTP ${response.status()} on ${response.url()}`);
      }
    }
  });

  page.on("console", (message) => {
    const text = message.text();
    if (
      /use server.*only export async functions/i.test(text) ||
      /invalid-use-server-value/i.test(text)
    ) {
      failures.push(text);
    }
  });

  page.on("pageerror", (error) => {
    if (/use server.*only export async functions/i.test(error.message)) {
      failures.push(error.message);
    }
  });

  return failures;
}

async function waitForLeadDetailPost(page, leadId) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new RegExp(`/admin/crm/leads/${leadId}`).test(response.url()),
    { timeout: 60000 }
  );
}

function isAccessDenied(bodyText, url) {
  const normalized = bodyText.toLowerCase();
  return (
    url.includes("/auth/forbidden") ||
    normalized.includes("forbidden") ||
    normalized.includes("access denied")
  );
}

async function runLifecycleE2E(page, leadAId, leadBId) {
  const checks = [];
  const record = (name, pass, detail = "") => {
    checks.push({ kind: "lifecycle-flow", name, pass, detail });
  };
  const failures = attachServerActionFailureGuards(page, leadAId);

  await login(page, "owner-qa-mgr@example.test");
  await openLeadDetail(page, leadAId);

  const transitionButton = page.locator('[data-testid="lead-status-transition-contacted"]');
  if ((await transitionButton.count()) > 0) {
    const transitionResponsePromise = waitForLeadDetailPost(page, leadAId);
    await transitionButton.click();
    const transitionResponse = await transitionResponsePromise;
    record(
      "A assigned->contacted transition",
      transitionResponse.status() < 500 && failures.length === 0,
      `status=${transitionResponse.status()} failures=${failures.join("; ") || "none"}`
    );
    await page.waitForTimeout(1000);
  } else {
    record("A assigned->contacted transition", false, "transition button missing");
  }

  await page.locator('[data-testid="lead-note-body"]').fill(
    "Owner QA browser lifecycle note"
  );
  const noteResponsePromise = waitForLeadDetailPost(page, leadAId);
  await page.locator('[data-testid="lead-note-submit"]').click();
  const noteResponse = await noteResponsePromise;
  await page.getByText("Owner QA browser lifecycle note").first().waitFor({
    timeout: 60000,
  });
  record(
    "B add note",
    noteResponse.status() < 500 && failures.length === 0,
    `status=${noteResponse.status()}`
  );

  const followUpResponsePromise = waitForLeadDetailPost(page, leadAId);
  await page.locator('[data-testid="lead-follow-up-submit"]').click();
  const followUpResponse = await followUpResponsePromise;
  await page.locator('[data-testid^="lead-follow-up-item-"]').first().waitFor({
    timeout: 60000,
  });
  record(
    "C create follow-up",
    followUpResponse.status() < 500 && failures.length === 0,
    `status=${followUpResponse.status()}`
  );

  const completeResponsePromise = waitForLeadDetailPost(page, leadAId);
  await page.locator('[data-testid="lead-follow-up-complete"]').first().click();
  const completeResponse = await completeResponsePromise;
  await page.waitForTimeout(1000);
  record(
    "D complete follow-up",
    completeResponse.status() < 500 && failures.length === 0,
    `status=${completeResponse.status()}`
  );

  const secondFollowUpResponsePromise = waitForLeadDetailPost(page, leadAId);
  await page.locator('[data-testid="lead-follow-up-submit"]').click();
  const secondFollowUpResponse = await secondFollowUpResponsePromise;
  await page.locator('[data-testid="lead-follow-up-cancel"]').first().waitFor({
    timeout: 60000,
  });
  const cancelResponsePromise = waitForLeadDetailPost(page, leadAId);
  await page.locator('[data-testid="lead-follow-up-cancel"]').first().click();
  const cancelResponse = await cancelResponsePromise;
  record(
    "E create second + cancel",
    secondFollowUpResponse.status() < 500 &&
      cancelResponse.status() < 500 &&
      failures.length === 0,
    `create=${secondFollowUpResponse.status()} cancel=${cancelResponse.status()}`
  );

  await page.locator('[data-testid="lead-on-hold-button"]').click();
  await page.locator('[data-testid="lead-on-hold-dialog"]').waitFor({ timeout: 60000 });
  await page
    .locator('[data-testid="lead-on-hold-reason"]')
    .fill("Owner QA browser on-hold reason");
  const onHoldResponsePromise = waitForLeadDetailPost(page, leadAId);
  await page.locator('[data-testid="lead-on-hold-submit"]').click();
  const onHoldResponse = await onHoldResponsePromise;
  await page.locator('[data-testid="lead-resume-button"]').waitFor({ timeout: 60000 });
  const resumeResponsePromise = waitForLeadDetailPost(page, leadAId);
  await page.locator('[data-testid="lead-resume-button"]').click();
  const resumeResponse = await resumeResponsePromise;
  record(
    "F on-hold + resume",
    onHoldResponse.status() < 500 &&
      resumeResponse.status() < 500 &&
      failures.length === 0,
    `onHold=${onHoldResponse.status()} resume=${resumeResponse.status()}`
  );

  await openLeadDetail(page, leadBId);
  await page.locator('[data-testid="lead-closed-lost-button"]').click();
  await page.locator('[data-testid="lead-closed-lost-dialog"]').waitFor({
    timeout: 60000,
  });
  await page.locator('[data-testid="lead-closed-lost-reason"]').selectOption({ index: 1 });
  await page
    .locator('[data-testid="lead-closed-lost-note"]')
    .fill("Owner QA browser closed-lost note");
  const closedLostResponsePromise = waitForLeadDetailPost(page, leadBId);
  await page.locator('[data-testid="lead-closed-lost-submit"]').click();
  const closedLostResponse = await closedLostResponsePromise;
  await page.waitForTimeout(1000);
  record(
    "G closed-lost on separate lead",
    closedLostResponse.status() < 500 && failures.length === 0,
    `status=${closedLostResponse.status()}`
  );

  await openLeadDetail(page, leadAId);
  const closedWonCount = await page
    .locator('[data-testid="lead-status-transition-closed_won"]')
    .count();
  record(
    "H closed-won not in UI",
    closedWonCount === 0,
    `closedWonButtons=${closedWonCount}`
  );

  if (failures.length > 0) {
    record("server-action guard", false, failures.join("; "));
  } else {
    record("server-action guard", true, "no HTTP>=500 or server-action errors");
  }

  return checks;
}

async function runResponsiveSmoke(browser, leadAId) {
  const checks = [];
  for (const viewport of VIEWPORTS.filter((entry) => !entry.fullE2E)) {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    try {
      await login(page, "owner-qa-mgr@example.test", context);
      await openLeadDetail(page, leadAId);
      const panelVisible =
        (await page.locator('[data-testid="lead-status-transition-panel"]').count()) > 0;
      const noteComposerVisible =
        (await page.locator('[data-testid="lead-note-composer"]').count()) > 0;
      const followUpComposerVisible =
        (await page.locator('[data-testid="lead-follow-up-composer"]').count()) > 0;
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      const screenshotPath = path.join(
        artifactsDir,
        `responsive-${viewport.label}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      checks.push({
        kind: "responsive-smoke",
        viewport: viewport.label,
        panelVisible,
        noteComposerVisible,
        followUpComposerVisible,
        horizontalOverflow: overflow,
        pass:
          panelVisible &&
          noteComposerVisible &&
          followUpComposerVisible &&
          !overflow,
        screenshot: screenshotPath,
      });
    } catch (error) {
      checks.push({
        kind: "responsive-smoke",
        viewport: viewport.label,
        pass: false,
        detail: error.message,
      });
    }
    await context.close();
  }
  return checks;
}

async function runDeniedRoleMatrix(browser, leadAId) {
  const checks = [];
  for (const account of DENIED_ACCOUNTS) {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    try {
      await login(page, account.email, context, { expectAdmin: false });
      await page.goto(`${BASE}/admin/crm/leads/${leadAId}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      const bodyText = await page.locator("body").innerText();
      const transitionPanelCount = await page
        .locator('[data-testid="lead-status-transition-panel"]')
        .count();
      const noteComposerCount = await page
        .locator('[data-testid="lead-note-composer"]')
        .count();
      const denied =
        isAccessDenied(bodyText, page.url()) ||
        (transitionPanelCount === 0 && noteComposerCount === 0);
      const screenshotPath = path.join(
        artifactsDir,
        `denied-${account.role}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      checks.push({
        kind: "role-matrix",
        role: account.role,
        pass: denied,
        transitionPanelCount,
        noteComposerCount,
        screenshot: screenshotPath,
      });
    } catch (error) {
      checks.push({
        kind: "role-matrix",
        role: account.role,
        pass: false,
        detail: error.message,
      });
    }
    await context.close();
  }
  return checks;
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  if (!shouldSkipC1Seed()) {
    const seed = spawnSync("node", ["scripts/phase-5c1-owner-qa.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
      shell: true,
    });
    if (seed.status !== 0) {
      throw new Error(`Phase 5C1 seed failed before browser QA:\n${seed.stderr}`);
    }
  }

  const fixtures = await resetLifecycleFixtures(PASSWORD);
  const mod = await loadPlaywright();
  const { chromium } = mod.chromium ? mod : mod.default ?? mod;
  const browser = await chromium.launch({ headless: true });
  const report = [];

  const e2eContext = await browser.newContext({ reducedMotion: "reduce" });
  const e2ePage = await e2eContext.newPage();
  await e2ePage.setViewportSize({ width: 1440, height: 900 });
  try {
    const lifecycleChecks = await runLifecycleE2E(
      e2ePage,
      fixtures.leadAId,
      fixtures.leadBId
    );
    report.push(...lifecycleChecks);
    await e2ePage.screenshot({
      path: path.join(artifactsDir, "lifecycle-e2e-final.png"),
      fullPage: true,
    });
  } catch (error) {
    report.push({
      kind: "lifecycle-flow",
      name: "lifecycle-e2e",
      pass: false,
      detail: error.message,
    });
  }
  await e2eContext.close();

  report.push(...(await runResponsiveSmoke(browser, fixtures.leadAId)));
  report.push(...(await runDeniedRoleMatrix(browser, fixtures.leadAId)));

  await browser.close();

  const passCount = report.filter((entry) => entry.pass).length;
  const failCount = report.filter((entry) => !entry.pass).length;
  const summary = {
    phase: "5C2C",
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    route: "/admin/crm/leads/[leadId]",
    fixtures,
    viewports: VIEWPORTS.map((entry) => entry.label),
    passCount,
    failCount,
    totalChecks: report.length,
    checks: report,
  };

  const reportPath = path.join(artifactsDir, "browser-qa-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(
    `Phase 5C2C browser QA: ${passCount}/${report.length} PASS (${failCount} failed)`
  );

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
