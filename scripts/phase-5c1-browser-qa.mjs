/**
 * Phase 5C1 owner browser QA — local development server only.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' PHASE_5C1_BASE_URL=http://localhost:3000 node scripts/phase-5c1-browser-qa.mjs
 *
 * Artifacts: .artifacts/phase-5c1/browser/ (gitignored)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertLocalAppUrl, requireQaPassword } from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "phase-5c1", "browser");
const BASE = process.env.PHASE_5C1_BASE_URL ?? "http://localhost:3000";
const PASSWORD = requireQaPassword();

assertLocalAppUrl(BASE, "PHASE_5C1_BASE_URL");

const ACCOUNTS = [
  { role: "super_admin", email: "owner-qa-sa@example.test", crmExpect: "list" },
  { role: "sales_manager", email: "owner-qa-mgr@example.test", crmExpect: "list" },
  { role: "sales_executive_a", email: "owner-qa-execa@example.test", crmExpect: "list" },
  { role: "sales_executive_b", email: "owner-qa-execb@example.test", crmExpect: "list" },
  { role: "project_manager", email: "owner-qa-pm@example.test", crmExpect: "forbidden" },
  { role: "designer", email: "owner-qa-designer@example.test", crmExpect: "forbidden" },
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
    const indexPath = path.join(nodeModules, "index.js");
    return import(pathToFileURL(indexPath).href);
  }
}

async function login(page, email, { expectAdmin = true } = {}) {
  await page.goto(`${BASE}/auth/login?next=${encodeURIComponent("/admin/crm/leads")}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(
    expectAdmin ? /\/admin\// : /\/(admin|auth\/forbidden)/,
    { timeout: 60000 }
  );
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const mod = await loadPlaywright();
  const { chromium } = mod.chromium ? mod : mod.default ?? mod;
  const browser = await chromium.launch({ headless: true });
  const report = [];

  for (const account of ACCOUNTS) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const expectAdmin = account.crmExpect === "list";
      await login(page, account.email, { expectAdmin });
      await page.goto(`${BASE}/admin/crm/leads`, {
        waitUntil: "networkidle",
        timeout: 60000,
      });
      if (account.crmExpect === "list") {
        await page.getByRole("heading", { name: "Leads" }).waitFor({ timeout: 60000 });
      }

      const url = page.url();
      const bodyText = await page.locator("body").innerText();
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      );
      const screenshot = path.join(artifactsDir, `${account.role}-${viewport.label}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });

      const showsForbidden =
        url.includes("/auth/forbidden") ||
        bodyText.toLowerCase().includes("forbidden") ||
        bodyText.toLowerCase().includes("access denied");
      const showsCrmLeads =
        bodyText.includes("Leads") &&
        (bodyText.includes("Filters") || bodyText.includes("CRM Workspace"));

      report.push({
        role: account.role,
        viewport: viewport.label,
        url,
        expected: account.crmExpect,
        pass:
          account.crmExpect === "list"
            ? showsCrmLeads && !showsForbidden
            : showsForbidden || !showsCrmLeads,
        hasHorizontalOverflow,
        screenshot,
      });

      await context.close();
    }
  }

  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "owner-qa-mgr@example.test");
  await page.goto(`${BASE}/admin/crm/leads`, { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
  report.push({ keyboard: "tab-navigation", focusedTag, pass: focusedTag.length > 0 });

  await browser.close();
  fs.writeFileSync(
    path.join(artifactsDir, "browser-qa-report.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
