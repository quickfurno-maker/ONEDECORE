/**
 * Phase 5C2B browser QA — local development server only.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' PHASE_5C2B_BASE_URL=http://localhost:3000 node scripts/phase-5c2b-browser-qa.mjs
 *
 * After phase-5c2b-owner-qa.mjs on the same DB, skip the duplicate 5C1 seed:
 *   PHASE_5C2B_SKIP_C1_SEED=1 node scripts/phase-5c2b-browser-qa.mjs
 *
 * Depends on Phase 5C1 fixture seed (owner-qa-sa/mgr/execa/pm/designer @example.test).
 * Artifacts: .artifacts/phase-5c2b/browser/ (gitignored)
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertLocalAppUrl, requireQaPassword } from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "phase-5c2b", "browser");
const BASE =
  process.env.PHASE_5C2B_BASE_URL ??
  process.env.PHASE_5C1_BASE_URL ??
  "http://localhost:3000";
const PASSWORD = requireQaPassword();

assertLocalAppUrl(BASE, "PHASE_5C2B_BASE_URL");

const ACCOUNTS = [
  {
    role: "super_admin",
    email: "owner-qa-sa@example.test",
    expectCreateAccess: true,
    expectAssigneeSelect: true,
  },
  {
    role: "sales_manager",
    email: "owner-qa-mgr@example.test",
    expectCreateAccess: true,
    expectAssigneeSelect: true,
  },
  {
    role: "sales_executive",
    email: "owner-qa-execa@example.test",
    expectCreateAccess: true,
    expectAssigneeSelect: false,
  },
  {
    role: "project_manager",
    email: "owner-qa-pm@example.test",
    expectCreateAccess: false,
    expectAssigneeSelect: false,
  },
  {
    role: "designer",
    email: "owner-qa-designer@example.test",
    expectCreateAccess: false,
    expectAssigneeSelect: false,
  },
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
  await page.goto(
    `${BASE}/auth/login?next=${encodeURIComponent("/admin/crm/leads/new")}`,
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

async function openNewLeadPage(page) {
  await page.goto(`${BASE}/admin/crm/leads/new`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
}

async function waitForCreatePageReady(page) {
  await page.getByRole("heading", { name: /new lead/i }).waitFor({ timeout: 60000 });
  await page
    .getByText(/does not record marketing or whatsapp consent/i)
    .first()
    .waitFor({ timeout: 60000 });
}

function isAccessDenied(bodyText, url) {
  const normalized = bodyText.toLowerCase();
  return (
    url.includes("/auth/forbidden") ||
    normalized.includes("forbidden") ||
    normalized.includes("access denied")
  );
}

async function assertFormAccessibility(page) {
  const nameInput = page.locator('input[name="submittedName"]');
  const phoneInput = page.locator('input[name="phone"]');
  const serviceSelect = page.locator('select[name="serviceCode"]');
  const checkButton = page.getByRole("button", { name: /check duplicates/i });
  const createButton = page.getByRole("button", { name: /create lead/i });

  await nameInput.waitFor({ timeout: 60000 });
  await phoneInput.waitFor({ timeout: 60000 });
  await serviceSelect.waitFor({ timeout: 60000 });
  await checkButton.waitFor({ timeout: 60000 });
  await createButton.waitFor({ timeout: 60000 });

  const nameLabelled = await nameInput.evaluate((el) => {
    const id = el.id;
    return Boolean(id && document.querySelector(`label[for="${id}"]`));
  });
  const phoneLabelled = await phoneInput.evaluate((el) => {
    const id = el.id;
    return Boolean(id && document.querySelector(`label[for="${id}"]`));
  });
  const checkBox = await checkButton.boundingBox();
  const createBox = await createButton.boundingBox();

  return {
    hasNameLabel: nameLabelled,
    hasPhoneLabel: phoneLabelled,
    checkButtonTouchTarget:
      Boolean(checkBox && checkBox.height >= 40 && checkBox.width >= 40),
    createButtonDisabled: await createButton.isDisabled(),
  };
}

function shouldSkipC1Seed() {
  const flag = process.env.PHASE_5C2B_SKIP_C1_SEED ?? "";
  return flag === "1" || flag.toLowerCase() === "true";
}

function attachServerActionFailureGuards(page) {
  const failures = [];

  page.on("response", (response) => {
    const request = response.request();
    if (
      request.method() === "POST" &&
      /\/admin\/crm\/leads\/new/.test(response.url()) &&
      response.status() >= 500
    ) {
      failures.push(`HTTP ${response.status()} on ${response.url()}`);
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

async function submitDuplicateCheck(flowPage) {
  await flowPage.locator('input[name="submittedName"]').fill("Owner QA Browser Lead");
  await flowPage.locator('input[name="phone"]').fill("+919810000050");
  const responsePromise = flowPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/admin\/crm\/leads\/new/.test(response.url()),
    { timeout: 60000 }
  );
  await flowPage.getByRole("button", { name: /check duplicates/i }).click();
  const response = await responsePromise;
  return response;
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
        const expectAdmin = account.expectCreateAccess;
        await login(page, account.email, context, { expectAdmin });
        await openNewLeadPage(page);

        if (account.expectCreateAccess) {
          await waitForCreatePageReady(page);
        }

        const bodyText = await page.locator("body").innerText();
        const onNewLeadRoute = /\/admin\/crm\/leads\/new/.test(page.url());
        const hasNewLeadHeading = (await page.getByRole("heading", { name: /new lead/i }).count()) > 0;
        const hasConsentNotice = /does not record marketing or whatsapp consent/i.test(
          bodyText
        );
        const hasRawSql = /SQLSTATE|postgres|supabase/i.test(bodyText);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1
        );

        let assigneeSelectCount = 0;
        let hasExecutiveSelfAssignCopy = false;
        let accessibility = null;
        let pass = false;

        if (account.expectCreateAccess) {
          assigneeSelectCount = await page.locator('select[name="assigneeId"]').count();
          hasExecutiveSelfAssignCopy = /assigned to you/i.test(bodyText);
          accessibility = await assertFormAccessibility(page);
          pass =
            onNewLeadRoute &&
            hasNewLeadHeading &&
            hasConsentNotice &&
            !hasRawSql &&
            !overflow &&
            accessibility.hasNameLabel &&
            accessibility.hasPhoneLabel &&
            accessibility.checkButtonTouchTarget &&
            accessibility.createButtonDisabled &&
            (account.expectAssigneeSelect
              ? assigneeSelectCount > 0
              : assigneeSelectCount === 0 && hasExecutiveSelfAssignCopy);
        } else {
          pass = isAccessDenied(bodyText, page.url());
        }

        const screenshotPath = path.join(
          artifactsDir,
          `${account.role}-${viewport.label}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });

        report.push({
          kind: "role-viewport-matrix",
          role: account.role,
          viewport: viewport.label,
          expectCreateAccess: account.expectCreateAccess,
          expectAssigneeSelect: account.expectAssigneeSelect,
          onNewLeadRoute,
          hasNewLeadHeading,
          hasConsentNotice,
          assigneeSelectCount,
          hasExecutiveSelfAssignCopy,
          accessibility,
          horizontalOverflow: overflow,
          noRawSql: !hasRawSql,
          pass,
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
  const serverActionFailures = attachServerActionFailureGuards(flowPage);

  await login(flowPage, "owner-qa-mgr@example.test", flowContext);
  await openNewLeadPage(flowPage);
  const duplicateResponse = await submitDuplicateCheck(flowPage);
  await flowPage
    .getByText(/no similar active or recent enquiry was found/i)
    .first()
    .waitFor({ timeout: 60000 });
  const previewPass =
    duplicateResponse.status() < 400 &&
    serverActionFailures.length === 0;
  report.push({
    kind: "duplicate-preview-flow",
    pass: previewPass,
    detail: previewPass
      ? "duplicate preview POST succeeded"
      : `duplicate preview failed (status=${duplicateResponse.status()}, failures=${serverActionFailures.join("; ") || "missing success notice"})`,
    responseStatus: duplicateResponse.status(),
    serverActionFailures,
  });

  await flowContext.close();
  await browser.close();

  const passCount = report.filter((entry) => entry.pass).length;
  const failCount = report.filter((entry) => !entry.pass).length;
  const summary = {
    phase: "5C2B",
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    route: "/admin/crm/leads/new",
    roles: ACCOUNTS.map((a) => a.role),
    viewports: VIEWPORTS.map((v) => v.label),
    passCount,
    failCount,
    totalChecks: report.length,
    checks: report,
  };

  const reportPath = path.join(artifactsDir, "browser-qa-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  console.log(
    `Phase 5C2B browser QA: ${passCount}/${report.length} PASS (${failCount} failed)`
  );

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
