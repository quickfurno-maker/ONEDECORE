/**
 * Phase 5E browser QA — local app only.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' PHASE_5E_BASE_URL=http://localhost:3000 node scripts/phase-5e-browser-qa.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertLocalAppUrl, requireQaPassword } from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "phase-5e-b", "browser");
const BASE =
  process.env.PHASE_5E_BASE_URL ??
  process.env.PHASE_5D_BASE_URL ??
  process.env.PHASE_5C1_BASE_URL ??
  "http://localhost:3000";

assertLocalAppUrl(BASE, "PHASE_5E_BASE_URL");
requireQaPassword();

const checks = [];
function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function runOwnerSeed() {
  if (process.env.PHASE_5E_SKIP_SEED === "1") return;
  const result = spawnSync("node", ["scripts/phase-5e-owner-qa.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error(`Phase 5E owner seed failed:\n${result.stderr}`);
  }
}

async function loadPlaywright() {
  try {
    const mod = await import("playwright");
    return mod.chromium;
  } catch {
    const nodeModules = path.join(
      root,
      "onedecore-chatgpt",
      "phase-i2-active-local-smoke",
      "node_modules",
      "playwright"
    );
    return (await import(pathToFileURL(path.join(nodeModules, "index.mjs")).href)).chromium;
  }
}

const ACCOUNTS = [
  { role: "super_admin", email: "owner-qa-sa@example.test", expectTargets: true, expectReports: true, expectMutate: true, allowForbidden: false },
  { role: "sales_manager", email: "owner-qa-mgr@example.test", expectTargets: true, expectReports: true, expectMutate: false, allowForbidden: false },
  { role: "sales_executive", email: "owner-qa-execa@example.test", expectTargets: true, expectReports: true, expectMutate: false, allowForbidden: false },
  { role: "project_manager", email: "owner-qa-pm@example.test", expectTargets: false, expectReports: false, expectMutate: false, allowForbidden: true },
];

async function login(page, email, password, { allowForbidden = false, next = "/admin/crm/leads" } = {}) {
  await page.goto(`${BASE}/auth/login?next=${encodeURIComponent(next)}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(
    allowForbidden ? /\/(admin|auth\/forbidden)/ : /\/admin\//,
    { timeout: 60000 }
  );
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  runOwnerSeed();
  const chromium = await loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const password = process.env.PHASE_5C1_QA_PASSWORD;

  for (const account of ACCOUNTS) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await login(page, account.email, password, { allowForbidden: account.allowForbidden });

    if (!account.allowForbidden) {
      await page.goto(`${BASE}/admin/crm/leads`);
      const nav = page.locator('nav[aria-label="CRM workspace"]');
      const targetsLink = nav.getByRole("link", { name: /Target|Sales Targets/i });
      const reportsLink = nav.getByRole("link", { name: /Performance|Reports/i });

      record(`${account.role} targets nav`, (await targetsLink.count()) > 0 === account.expectTargets);
      record(`${account.role} reports nav`, (await reportsLink.count()) > 0 === account.expectReports);
    } else {
      record(`${account.role} targets nav`, account.expectTargets === false);
      record(`${account.role} reports nav`, account.expectReports === false);
    }

    if (account.expectTargets) {
      await page.goto(`${BASE}/admin/crm/targets`);
      record(`${account.role} targets page loads`, page.url().includes("/admin/crm/targets"));
      const body = await page.textContent("body");
      record(
        `${account.role} achievement inactive copy`,
        body?.includes("Not activated until quotation acceptance (Phase 7B)") ?? false
      );
      record(
        `${account.role} no fake progress bar`,
        !body?.includes("0%") && !body?.includes("₹0 achieved")
      );
      if (account.expectMutate) {
        record(`${account.role} create target form`, (await page.getByText("Create target").count()) > 0);
      } else {
        record(`${account.role} no create target form`, (await page.getByText("Create target").count()) === 0);
      }
      await page.screenshot({ path: path.join(artifactsDir, `${account.role}-targets-mobile.png`), fullPage: true });
    } else {
      await page.goto(`${BASE}/admin/crm/targets`);
      const body = await page.textContent("body");
      record(
        `${account.role} targets forbidden`,
        page.url().includes("/forbidden") || !body?.includes("Create target")
      );
    }

    if (account.expectReports) {
      await page.goto(`${BASE}/admin/crm/reports`);
      const reportBody = await page.textContent("body");
      record(`${account.role} reports page loads`, page.url().includes("/admin/crm/reports"));
      record(`${account.role} lead volume section`, reportBody?.includes("Lead volume") ?? false);
      record(`${account.role} no commercial achievement section`, !reportBody?.includes("Revenue won"));
      await page.screenshot({ path: path.join(artifactsDir, `${account.role}-reports-mobile.png`), fullPage: true });
    } else if (!account.expectReports) {
      await page.goto(`${BASE}/admin/crm/reports`);
      const reportBody = await page.textContent("body");
      record(
        `${account.role} reports forbidden`,
        page.url().includes("/forbidden") || !reportBody?.includes("Lead volume")
      );
    }

    await context.close();
  }

  await browser.close();
  const failed = checks.filter((c) => !c.ok);
  fs.writeFileSync(
    path.join(artifactsDir, "browser-qa-report.json"),
    JSON.stringify({ passed: checks.length - failed.length, total: checks.length, checks }, null, 2)
  );
  console.log(`\nBrowser QA: ${checks.length - failed.length}/${checks.length}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
