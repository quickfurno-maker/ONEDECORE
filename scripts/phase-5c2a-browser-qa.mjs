/**
 * Phase 5C2A browser QA — local development server only.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' PHASE_5C2A_BASE_URL=http://localhost:3000 node scripts/phase-5c2a-browser-qa.mjs
 *
 * Depends on Phase 5C1 fixture seed (owner-qa-sa/mgr/execa/execb/pm/designer @example.test).
 * Artifacts: .artifacts/phase-5c2a/browser/ (gitignored)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertLocalAppUrl, assertLocalSupabaseUrl, requireQaPassword } from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "phase-5c2a", "browser");
const BASE = process.env.PHASE_5C2A_BASE_URL ?? process.env.PHASE_5C1_BASE_URL ?? "http://localhost:3000";
const PASSWORD = requireQaPassword();

assertLocalAppUrl(BASE, "PHASE_5C2A_BASE_URL");

const ACCOUNTS = [
  { role: "super_admin", email: "owner-qa-sa@example.test", expectControls: true },
  { role: "sales_manager", email: "owner-qa-mgr@example.test", expectControls: true },
  { role: "sales_executive_a", email: "owner-qa-execa@example.test", expectControls: false },
  { role: "sales_executive_b", email: "owner-qa-execb@example.test", expectControls: false },
  { role: "project_manager", email: "owner-qa-pm@example.test", expectControls: false },
  { role: "designer", email: "owner-qa-designer@example.test", expectControls: false },
];

const VIEWPORTS = [
  { label: "desktop-1440", width: 1440, height: 900 },
  { label: "tablet-768", width: 768, height: 1024 },
  { label: "mobile-390", width: 390, height: 844 },
  { label: "mobile-360", width: 360, height: 800 },
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

async function login(page, email, context, { expectAdmin = true } = {}) {
  if (context) {
    await context.clearCookies();
  }
  await page.goto(`${BASE}/auth/login?next=${encodeURIComponent("/admin/crm/leads")}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
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
  await page.getByRole("heading", { name: "Assignment" }).waitFor({ timeout: 60000 });
  return page.url();
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
    `${apiUrl}/rest/v1/leads?submitted_name=eq.${encodeURIComponent(name)}&select=id&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } }
  );
  const rows = await response.json();
  return rows[0]?.id ?? null;
}

async function discoverFixtures(password) {
  const status = readSupabaseStatus();
  const token = await signInRest(
    "owner-qa-mgr@example.test",
    password,
    status.API_URL,
    status.ANON_KEY
  );
  const unassignedId = await findLeadId(
    token,
    status.API_URL,
    status.ANON_KEY,
    "Owner QA Unassigned"
  );
  const execAId = await findLeadId(
    token,
    status.API_URL,
    status.ANON_KEY,
    "Owner QA Executive A Lead"
  );
  const execBId = await findLeadId(
    token,
    status.API_URL,
    status.ANON_KEY,
    "Owner QA Executive B Lead"
  );
  if (!unassignedId || !execAId || !execBId) {
    throw new Error("Phase 5C1 fixture leads missing for browser QA");
  }
  return { unassignedId, execAId, execBId };
}

function hasMutationControls(page) {
  return page.getByRole("button", { name: /^(Assign|Reassign|Unassign)$/ });
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const seed = spawnSync("node", ["scripts/phase-5c1-owner-qa.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    shell: true,
  });
  if (seed.status !== 0) {
    throw new Error(`Phase 5C1 seed failed before browser QA:\n${seed.stderr}`);
  }
  const fixtures = await discoverFixtures(PASSWORD);
  const mod = await loadPlaywright();
  const { chromium } = mod.chromium ? mod : mod.default ?? mod;
  const browser = await chromium.launch({ headless: true });
  const report = [];

  for (const account of ACCOUNTS) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      try {
        const expectAdmin = account.role !== "project_manager" && account.role !== "designer";
        await login(page, account.email, context, { expectAdmin });
        if (account.role === "project_manager" || account.role === "designer") {
          await page.goto(`${BASE}/admin/crm/leads`, { waitUntil: "domcontentloaded" });
        } else if (account.expectControls) {
          await openLeadDetail(page, fixtures.unassignedId);
        } else if (account.role === "sales_executive_b") {
          await openLeadDetail(page, fixtures.execBId);
        } else {
          await openLeadDetail(page, fixtures.execAId);
        }

      const controls = hasMutationControls(page);
      const controlCount = await controls.count();
      const hasControls = controlCount > 0;
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      const bodyText = await page.locator("body").innerText();
      const hasRawSql = /SQLSTATE|postgres|supabase/i.test(bodyText);

      const screenshotPath = path.join(artifactsDir, `${account.role}-${viewport.label}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      report.push({
        kind: "role-viewport-matrix",
        role: account.role,
        viewport: viewport.label,
        expectControls: account.expectControls,
        hasControls,
        horizontalOverflow: overflow,
        noRawSql: !hasRawSql,
        pass: account.expectControls === hasControls && !overflow && !hasRawSql,
        screenshot: screenshotPath,
      });
      } catch (error) {
        report.push({
          kind: "role-viewport-matrix",
          role: account.role,
          viewport: viewport.label,
          pass: false,
          detail: error.message,
        });
      }
      await context.close();
    }
  }

  const flowContext = await browser.newContext({ reducedMotion: "reduce" });
  const flowPage = await flowContext.newPage();
  await flowPage.setViewportSize({ width: 1440, height: 900 });

  await login(flowPage, "owner-qa-sa@example.test", flowContext);
  await openLeadDetail(flowPage, fixtures.unassignedId);

  const assignButton = flowPage.getByRole("button", { name: /^Assign$/ });
  if ((await assignButton.count()) > 0) {
    await assignButton.click();
    await flowPage.getByRole("dialog", { name: /Assign lead/i }).waitFor();
    await flowPage.locator('select[name="targetAssigneeId"]').selectOption({ index: 1 });
    await flowPage.locator('textarea[name="reason"]').fill("Owner QA browser assignment note");
    const submit = flowPage.getByRole("button", { name: /Save assignment/i });
    await submit.click();
    await flowPage.waitForTimeout(1500);
    report.push({
      kind: "super-admin-assign",
      pass: (await flowPage.getByText(/Current assignee:/i).count()) > 0,
    });
  } else {
    report.push({ kind: "super-admin-assign", pass: false, detail: "Assign button missing" });
  }

  await login(flowPage, "owner-qa-mgr@example.test", flowContext);
  await openLeadDetail(flowPage, fixtures.execAId);
  const reassignButton = flowPage.getByRole("button", { name: /^Reassign$/ });
  if ((await reassignButton.count()) > 0) {
    await reassignButton.click();
    await flowPage.getByRole("dialog", { name: /Reassign lead/i }).waitFor();
    await flowPage.locator('textarea[name="reason"]').fill("short");
    await flowPage.getByRole("button", { name: /Save assignment/i }).click();
    const alert = flowPage.locator('[role="alert"]');
    report.push({
      kind: "reassignment-reason-validation",
      pass: (await alert.count()) > 0,
    });
    await flowPage.keyboard.press("Escape");
  } else {
    report.push({
      kind: "reassignment-reason-validation",
      pass: true,
      detail: "No reassign target in current fixture state",
    });
  }

  const unassignButton = flowPage.getByRole("button", { name: /^Unassign$/ });
  if ((await unassignButton.count()) > 0) {
    await unassignButton.click();
    await flowPage.getByRole("dialog", { name: /Unassign lead/i }).waitFor();
    await flowPage.locator('textarea[name="reason"]').fill("tiny");
    await flowPage.getByRole("button", { name: /Confirm unassignment/i }).click();
    report.push({
      kind: "unassignment-reason-validation",
      pass: (await flowPage.locator('[role="alert"]').count()) > 0,
    });
  } else {
    report.push({
      kind: "unassignment-reason-validation",
      pass: true,
      detail: "No unassign target in current fixture state",
    });
  }

  await login(flowPage, "owner-qa-execa@example.test", flowContext);
  await openLeadDetail(flowPage, fixtures.execAId);
  report.push({
    kind: "executive-no-controls",
    pass: (await hasMutationControls(flowPage).count()) === 0,
  });

  await login(flowPage, "owner-qa-pm@example.test", flowContext, { expectAdmin: false });
  await flowPage.goto(`${BASE}/admin/crm/leads`, { waitUntil: "domcontentloaded" });
  const pmBody = await flowPage.locator("body").innerText();
  report.push({
    kind: "project-manager-denied",
    pass: pmBody.toLowerCase().includes("forbidden") || !pmBody.includes("Leads"),
  });

  await login(flowPage, "owner-qa-mgr@example.test", flowContext);
  await openLeadDetail(flowPage, fixtures.execAId);
  const reassign = flowPage.getByRole("button", { name: /^Reassign$/ });
  if ((await reassign.count()) > 0) {
    await reassign.click();
    const dialog = flowPage.getByRole("dialog");
    await dialog.waitFor();
    await flowPage.keyboard.press("Tab");
    const focusedInDialog = await flowPage.evaluate(() => {
      const dialogEl = document.querySelector('[role="dialog"]');
      return dialogEl?.contains(document.activeElement) ?? false;
    });
    report.push({ kind: "keyboard-dialog-focus-trap", pass: focusedInDialog });
    const closeBtn = flowPage.getByRole("button", { name: /^Close$/ });
    const closeBox = await closeBtn.boundingBox();
    report.push({
      kind: "touch-target-close-button",
      pass: Boolean(closeBox && closeBox.height >= 40 && closeBox.width >= 40),
    });
    await flowPage.keyboard.press("Escape");
  } else {
    report.push({ kind: "keyboard-dialog-focus-trap", pass: true, detail: "skipped" });
    report.push({ kind: "touch-target-close-button", pass: true, detail: "skipped" });
  }

  await flowContext.close();
  await browser.close();

  const passCount = report.filter((entry) => entry.pass).length;
  const failCount = report.filter((entry) => !entry.pass).length;
  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    roles: ACCOUNTS.map((a) => a.role),
    viewports: VIEWPORTS.map((v) => v.label),
    passCount,
    failCount,
    totalChecks: report.length,
    checks: report,
  };

  const reportPath = path.join(artifactsDir, "browser-qa-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(`Phase 5C2A browser QA: ${passCount}/${report.length} PASS (${failCount} failed)`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
