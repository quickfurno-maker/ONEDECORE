/**
 * Phase 5D browser QA — local development server only.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' PHASE_5D_BASE_URL=http://localhost:3000 node scripts/phase-5d-browser-qa.mjs
 *
 * Artifacts: .artifacts/phase-5d/fixtures and .artifacts/phase-5d/browser/
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertLocalAppUrl, requireQaPassword } from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "phase-5d");
const fixturesDir = path.join(artifactsDir, "fixtures");
const browserDir = path.join(artifactsDir, "browser");
const BASE =
  process.env.PHASE_5D_BASE_URL ??
  process.env.PHASE_5C1_BASE_URL ??
  "http://localhost:3000";
const PASSWORD = requireQaPassword();

assertLocalAppUrl(BASE, "PHASE_5D_BASE_URL");

const ACCOUNTS = [
  {
    role: "super_admin",
    email: "owner-qa-sa@example.test",
    expectImports: true,
    expectRules: true,
  },
  {
    role: "sales_manager",
    email: "owner-qa-mgr@example.test",
    expectImports: true,
    expectRules: false,
  },
  {
    role: "sales_executive",
    email: "owner-qa-execa@example.test",
    expectImports: false,
    expectRules: false,
  },
  {
    role: "project_manager",
    email: "owner-qa-pm@example.test",
    expectImports: false,
    expectRules: false,
  },
  {
    role: "designer",
    email: "owner-qa-designer@example.test",
    expectImports: false,
    expectRules: false,
  },
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
    return import(pathToFileURL(path.join(nodeModules, "index.mjs")).href);
  }
}

function runOwnerSeed() {
  if (process.env.PHASE_5D_SKIP_C1_SEED === "1") {
    return;
  }
  const result = spawnSync("node", ["scripts/phase-5d-owner-qa.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    shell: false,
  });
  fs.writeFileSync(
    path.join(browserDir, "owner-seed.log"),
    `${result.stdout}\n${result.stderr}`
  );
  if (result.status !== 0) {
    throw new Error(`Phase 5D owner seed failed:\n${result.stderr}`);
  }
}

async function writeFixtures() {
  const runSuffix = String(Date.now() % 10000).padStart(4, "0");
  const csvPhone = `+91950006${runSuffix}`;
  const xlsxPhone = `+91950007${runSuffix}`;
  const csv = [
    "\uFEFFName,Phone,Email,Service,Property,Timeline,Locality",
    `Browser QA Lead,${csvPhone},browser-qa-${runSuffix}@example.test,complete-home-interiors,apartment-2bhk,within-3-months,koregaon park`,
  ].join("\n");
  fs.writeFileSync(path.join(fixturesDir, "phase-5d-browser.csv"), csv, "utf8");

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Leads");
  sheet.addRow([
    "Name",
    "Phone",
    "Email",
    "Service",
    "Property",
    "Timeline",
    "Locality",
  ]);
  sheet.addRow([
    "Browser QA XLSX",
    xlsxPhone,
    `browser-qa-xlsx-${runSuffix}@example.test`,
    "complete-home-interiors",
    "apartment-2bhk",
    "within-3-months",
    "koregaon park",
  ]);
  await workbook.xlsx.writeFile(path.join(fixturesDir, "phase-5d-browser.xlsx"));
}

function attachNetworkGuards(page, networkLog) {
  page.on("response", (response) => {
    const entry = {
      url: response.url(),
      status: response.status(),
      method: response.request().method(),
    };
    networkLog.push(entry);
  });
  page.on("pageerror", (error) => {
    networkLog.push({ type: "pageerror", message: error.message });
  });
}

async function login(page, email, { allowForbidden = false, next = "/admin/crm/imports" } = {}) {
  await page.goto(
    `${BASE}/auth/login?next=${encodeURIComponent(next)}`,
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(
    allowForbidden ? /\/(admin|auth\/forbidden)/ : /\/admin\//,
    { timeout: 60000 }
  );
}

async function selectFirstActiveSource(page, selector) {
  const sourceSelect = page.locator(selector);
  const values = await sourceSelect.locator("option").evaluateAll((options) =>
    options
      .map((option) => option.getAttribute("value") ?? "")
      .filter((value) => value.length > 0)
  );
  if (values.length > 0) {
    await sourceSelect.selectOption(values[0]);
    return values[0];
  }
  return null;
}

const BATCH_URL_PATTERN = /\/admin\/crm\/imports\/[0-9a-f-]{36}/i;

async function uploadNewImport(page, filePath) {
  await page.goto(`${BASE}/admin/crm/imports/new`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.setInputFiles('input[name="file"]', filePath);
  await selectFirstActiveSource(page, 'select[name="defaultSourceId"]');
  await Promise.all([
    page.waitForURL(BATCH_URL_PATTERN, { timeout: 90000 }),
    page.getByRole("button", { name: /upload and map columns/i }).click(),
  ]);
  await page.getByRole("heading", { name: /column mapping/i }).waitFor({ timeout: 60000 });
  return page.url();
}

async function applyMappingAndValidate(page, filePath) {
  await page.setInputFiles('input[name="file"]', filePath);
  await page.waitForSelector('select[name^="mapping."]', { timeout: 90000 });

  const mappingTargets = {
    name: "submitted_name",
    phone: "phone",
    email: "email",
    service: "service_code",
    property: "property_code",
    timeline: "timeline_code",
    locality: "locality",
  };

  const selects = page.locator('select[name^="mapping."]');
  const count = await selects.count();
  for (let index = 0; index < count; index += 1) {
    const select = selects.nth(index);
    const name = await select.getAttribute("name");
    const header = (name?.replace(/^mapping\./, "") ?? "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase();
    const field = mappingTargets[header];
    if (field) {
      await select.selectOption(field);
    }
  }

  await page.getByRole("button", { name: /save mapping and validate/i }).click();
  await page.getByText(/validation complete/i).waitFor({ timeout: 90000 });
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function assertBatchReadyForDirectConfirm(page, contextLabel) {
  const statusLocator = page.getByText(/ready for review/i);
  const importableLocator = page.locator("section").filter({ hasText: "Importable" });
  const statusVisible = (await statusLocator.count()) > 0;
  const importableText = (await importableLocator.count()) > 0
    ? (await importableLocator.first().innerText())
    : "";
  const importableMatch = importableText.match(/Importable\s*(\d+)/i);
  const importableCount = importableMatch ? Number.parseInt(importableMatch[1], 10) : -1;

  if (!statusVisible || importableCount <= 0) {
    const batchId =
      page.url().match(/imports\/([0-9a-f-]{36})/i)?.[1] ?? "unknown";
    const metricSection = page.locator("section").first();
    const metrics = (await metricSection.count()) > 0
      ? await metricSection.innerText()
      : "";
    throw new Error(
      `${contextLabel}: batch not ready for direct confirm — ${JSON.stringify({
        batchId,
        url: page.url(),
        statusVisible,
        importableCount,
        metrics: metrics.replace(/\s+/g, " ").trim(),
      })}`
    );
  }
}

async function main() {
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.mkdirSync(browserDir, { recursive: true });
  await writeFixtures();
  runOwnerSeed();

  const mod = await loadPlaywright();
  const { chromium } = mod.chromium ? mod : mod.default ?? mod;
  const browser = await chromium.launch({ headless: true });
  const checks = [];
  const networkLog = [];

  const record = (name, ok, detail = "") => {
    checks.push({ name, ok, detail });
  };

  for (const account of ACCOUNTS) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    attachNetworkGuards(page, networkLog);
    const deniedPortal =
      !account.expectImports && !account.expectRules && account.role !== "sales_executive";
    await login(page, account.email, {
      allowForbidden: deniedPortal,
      next: deniedPortal ? "/admin" : "/admin/crm/imports",
    });

    if (account.expectImports || account.expectRules) {
      await page.goto(`${BASE}/admin/crm/leads`);
      const navText = await page.locator('nav[aria-label="CRM workspace"]').innerText();

      record(
        `${account.role} imports nav visibility`,
        navText.includes("Imports") === account.expectImports
      );
      record(
        `${account.role} assignment rules nav visibility`,
        navText.includes("Assignment Rules") === account.expectRules
      );

      await page.goto(`${BASE}/admin/crm/imports`);
      record(
        `${account.role} can open imports list`,
        page.url().includes("/admin/crm/imports") && !page.url().includes("forbidden")
      );
      await page.goto(`${BASE}/admin/crm/imports/new`);
      record(
        `${account.role} can open import wizard`,
        (await page.getByRole("button", { name: /upload and map columns/i }).count()) > 0
      );

      if (account.expectRules) {
        await page.goto(`${BASE}/admin/crm/settings/assignment-rules`);
        record(
          `${account.role} can open assignment rules`,
          (await page.getByText(/create assignment rule/i).count()) > 0
        );
      }
    } else {
      record(`${account.role} imports nav visibility`, true, "n/a — denied role");
      record(`${account.role} assignment rules nav visibility`, true, "n/a — denied role");
      await page.goto(`${BASE}/admin/crm/imports`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page
        .waitForURL(/\/auth\/forbidden/, { timeout: 15000 })
        .catch(() => undefined);
      const finalUrl = page.url();
      const bodyText = await page.locator("body").innerText();
      const hasImportActions =
        (await page.getByRole("link", { name: /^new import$/i }).count()) > 0;
      const blocked =
        finalUrl.includes("forbidden") ||
        bodyText.includes("CRM workspace access denied") ||
        !hasImportActions;
      record(`${account.role} imports route blocked`, blocked, finalUrl);
    }

    await page.screenshot({
      path: path.join(browserDir, `${account.role}-crm.png`),
      fullPage: true,
    });
    await context.close();
  }

  const csvPath = path.join(fixturesDir, "phase-5d-browser.csv");
  const xlsxPath = path.join(fixturesDir, "phase-5d-browser.xlsx");

  const managerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const managerPage = await managerContext.newPage();
  attachNetworkGuards(managerPage, networkLog);
  await login(managerPage, ACCOUNTS[1].email);
  const managerBatchUrl = await uploadNewImport(managerPage, csvPath);
  record(
    "manager CSV upload redirects to batch detail",
    managerBatchUrl.includes("/admin/crm/imports/")
  );
  await applyMappingAndValidate(managerPage, csvPath);
  record(
    "manager CSV mapping validates",
    (await managerPage.getByText(/ready for review/i).count()) > 0 ||
      (await managerPage.getByText(/importable/i).count()) > 0
  );
  await managerPage.getByRole("button", { name: /submit for approval/i }).waitFor({
    state: "visible",
    timeout: 60000,
  });
  await managerPage.getByRole("button", { name: /submit for approval/i }).click();
  await managerPage.getByText(/submitted for super admin approval/i).waitFor({
    timeout: 60000,
  });
  await managerPage.reload({ waitUntil: "domcontentloaded" });
  await managerPage.getByText(/pending super admin approval/i).waitFor({ timeout: 60000 });
  record(
    "manager CSV submit reaches pending approval",
    (await managerPage.getByText(/pending super admin approval/i).count()) > 0
  );
  await managerPage.screenshot({
    path: path.join(browserDir, "manager-import-batch.png"),
    fullPage: true,
  });
  const managerBatchId =
    managerBatchUrl.match(/imports\/([0-9a-f-]{36})/i)?.[1] ?? "";
  await managerContext.close();

  const saContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const saPage = await saContext.newPage();
  attachNetworkGuards(saPage, networkLog);
  await login(saPage, ACCOUNTS[0].email);
  await saPage.goto(`${BASE}/admin/crm/imports/${managerBatchId}`);
  record(
    "super admin sees pending manager batch",
    (await saPage.getByText(/pending super admin approval/i).count()) > 0
  );
  await saPage.getByRole("button", { name: /^approve$/i }).click();
  await saPage.getByText(/import batch approved/i).waitFor({ timeout: 60000 });
  await saPage.reload({ waitUntil: "domcontentloaded" });
  record(
    "super admin approves manager CSV batch",
    (await saPage.getByText(/^approved$/i).count()) > 0
  );
  await saPage.getByRole("button", { name: /start import|process next chunk/i }).click();
  await saPage.getByText(/import batch processed|completed/i).first().waitFor({
    timeout: 120000,
  });
  record(
    "super admin processes manager CSV batch",
    (await saPage.getByText(/completed/i).count()) > 0
  );
  await saContext.close();

  const saDirectContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const saDirectPage = await saDirectContext.newPage();
  attachNetworkGuards(saDirectPage, networkLog);
  await login(saDirectPage, ACCOUNTS[0].email);
  const directBatchUrl = await uploadNewImport(saDirectPage, xlsxPath);
  record(
    "super admin XLSX upload redirects to batch detail",
    directBatchUrl.includes("/admin/crm/imports/")
  );
  await applyMappingAndValidate(saDirectPage, xlsxPath);
  let directConfirmReady = true;
  let directConfirmDetail = "";
  try {
    await assertBatchReadyForDirectConfirm(saDirectPage, "super admin XLSX");
  } catch (error) {
    directConfirmReady = false;
    directConfirmDetail = error instanceof Error ? error.message : String(error);
  }
  record(
    "super admin XLSX ready for review with importable rows",
    directConfirmReady,
    directConfirmDetail
  );
  const directConfirmButton = saDirectPage.getByRole("button", {
    name: /direct confirm/i,
  });
  await directConfirmButton.waitFor({ state: "visible", timeout: 90000 });
  record(
    "super admin XLSX validates for direct confirm",
    (await directConfirmButton.count()) > 0
  );
  await directConfirmButton.click();
  await saDirectPage
    .locator('[role="status"]')
    .getByText(/import batch confirmed for direct processing/i)
    .waitFor({ timeout: 60000 });
  await saDirectPage.reload({ waitUntil: "domcontentloaded" });
  await saDirectPage.getByText(/approved/i).first().waitFor({ timeout: 60000 });
  record(
    "super admin XLSX direct confirm",
    (await saDirectPage.getByText(/approved/i).count()) > 0
  );
  const xlsxStartButton = saDirectPage.getByRole("button", {
    name: /start import|process next chunk/i,
  });
  await xlsxStartButton.waitFor({ state: "visible", timeout: 60000 });
  await xlsxStartButton.click();
  await saDirectPage.getByText(/import batch processed|completed/i).first().waitFor({
    timeout: 120000,
  });
  record(
    "super admin processes XLSX direct batch",
    (await saDirectPage.getByText(/completed/i).count()) > 0
  );
  await saDirectPage.screenshot({
    path: path.join(browserDir, "sa-direct-xlsx-batch.png"),
    fullPage: true,
  });
  await saDirectContext.close();

  const responsiveContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const responsivePage = await responsiveContext.newPage();
  attachNetworkGuards(responsivePage, networkLog);
  await login(responsivePage, ACCOUNTS[1].email);
  await responsivePage.goto(`${BASE}/admin/crm/imports/new`);
  record(
    "responsive imports wizard smoke",
    (await responsivePage.getByRole("button", { name: /upload and map columns/i }).count()) > 0
  );
  await responsiveContext.close();

  await browser.close();

  const http500 = networkLog.filter(
    (entry) => typeof entry.status === "number" && entry.status >= 500
  );
  const pageErrors = networkLog.filter((entry) => entry.type === "pageerror");
  record("no HTTP 500 responses", http500.length === 0, JSON.stringify(http500.slice(0, 3)));
  record("no page errors", pageErrors.length === 0, JSON.stringify(pageErrors.slice(0, 3)));

  const passed = checks.filter((check) => check.ok).length;
  const report = {
    phase: "5D-browser",
    passed,
    total: checks.length,
    checks,
    fixtures: { csv: csvPath, xlsx: xlsxPath },
    network: networkLog.filter((entry) => typeof entry.status === "number").slice(-40),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(browserDir, "browser-qa-report.json"),
    JSON.stringify(report, null, 2)
  );
  fs.writeFileSync(
    path.join(artifactsDir, "07-browser-qa-report.json"),
    JSON.stringify(report, null, 2)
  );
  fs.writeFileSync(
    path.join(artifactsDir, "08-browser-network.json"),
    JSON.stringify(networkLog, null, 2)
  );

  console.log(`Phase 5D browser QA: ${passed}/${checks.length} passed`);
  for (const check of checks) {
    console.log(
      `${check.ok ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`
    );
  }

  if (passed !== checks.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
