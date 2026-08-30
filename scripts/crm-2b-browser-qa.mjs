/**
 * CRM 2B rendered QA — local app only, installed Chrome/Edge over CDP.
 *
 * Deliberately dependency-free: it drives an already-installed browser through
 * the Chrome DevTools Protocol using Node's built-in WebSocket (Node >= 22).
 * No Playwright/Puppeteer is installed for QA.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/crm-2b-browser-qa.mjs
 *
 * Artifacts: .artifacts/crm-2b/browser/ (gitignored)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertLocalAppUrl, requireQaPassword } from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "crm-2b", "browser");
const BASE = process.env.CRM_2B_BASE_URL ?? "http://localhost:3000";
const PASSWORD = requireQaPassword();
const EMAIL = process.env.CRM_2B_QA_EMAIL ?? "owner-qa-sa@example.test";

assertLocalAppUrl(BASE, "CRM_2B_BASE_URL");

const BROWSER_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

const VIEWPORTS = [
  { label: "360x800", width: 360, height: 800, mobile: true },
  { label: "390x844", width: 390, height: 844, mobile: true },
  { label: "430x932", width: 430, height: 932, mobile: true },
  { label: "768x1024", width: 768, height: 1024, mobile: false },
  { label: "1024x768", width: 1024, height: 768, mobile: false },
  { label: "1366x768", width: 1366, height: 768, mobile: false },
  { label: "1440x900", width: 1440, height: 900, mobile: false },
];

const ROUTES = [
  { key: "calendar-week", path: "/admin/crm/calendar?view=week", nav: "Calendar" },
  { key: "calendar-day", path: "/admin/crm/calendar?view=day", nav: "Calendar" },
  { key: "calendar-month", path: "/admin/crm/calendar?view=month", nav: "Calendar" },
  { key: "pipeline", path: "/admin/crm/pipeline", nav: "Pipeline" },
  { key: "leads", path: "/admin/crm/leads", nav: "Leads" },
  { key: "my-day", path: "/admin/crm/my-day", nav: "My Day" },
  { key: "lead-detail", path: null, nav: "Leads" },
];

const checks = [];
function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function findBrowser() {
  const override = process.env.CRM_2B_BROWSER_PATH;
  if (override && fs.existsSync(override)) return override;
  const found = BROWSER_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      "No installed Chrome/Edge found. Set CRM_2B_BROWSER_PATH to a browser binary."
    );
  }
  return found;
}

/** Finds a debug port nothing is already listening on. */
async function findFreeDebugPort() {
  for (let port = 9411; port < 9460; port += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(400),
      });
    } catch {
      return port;
    }
  }
  throw new Error("No free CDP debug port in 9411-9459");
}

async function waitFor(fn, { timeout = 60000, interval = 250, label = "condition" } = {}) {
  const deadline = Date.now() + timeout;
  let lastError;
  let lastValue;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      lastValue = value;
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(
    `Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}${
      lastValue !== undefined ? ` (last value: ${JSON.stringify(lastValue)})` : ""
    }`
  );
}

/** Minimal CDP session over Node's built-in WebSocket. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    });
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("CDP socket error")), { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression: `(async () => { ${expression} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? "evaluate failed");
    }
    return result.result.value;
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    // Waiting on readyState alone is not enough: the previous document is still
    // "complete" the instant navigate returns, so match the pathname too.
    // (Compare pathname, not href — Chrome re-encodes query strings.)
    const expected = new URL(url).pathname;
    await waitFor(
      async () => {
        const state = await this.evaluate(
          "return JSON.stringify({ path: location.pathname, ready: document.readyState })"
        );
        const { path: current, ready } = JSON.parse(state);
        if (ready === "complete" && current === expected) return true;
        throw new Error(`at ${current} (${ready}), want ${expected}`);
      },
      { timeout: 120000, label: `load ${url}` }
    );
    // Let the App Router settle its client render (dev builds compile on demand).
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  async setViewport({ width, height, mobile }) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    });
  }

  async screenshot(file) {
    const shot = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  }
}

async function login(cdp) {
  await cdp.navigate(`${BASE}/auth/login?next=${encodeURIComponent("/admin/crm/calendar")}`);
  await cdp.evaluate(`
    const email = document.querySelector('input[type="email"], input[name="email"]');
    const password = document.querySelector('input[type="password"], input[name="password"]');
    if (!email || !password) throw new Error('login form not found');
    const setValue = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setValue(email, ${JSON.stringify(EMAIL)});
    setValue(password, ${JSON.stringify(PASSWORD)});
    (email.form ?? document.querySelector('form')).requestSubmit();
    return true;
  `);

  await waitFor(
    async () => {
      const url = await cdp.evaluate("return location.pathname");
      return url.startsWith("/admin");
    },
    { timeout: 90000, label: "login redirect into /admin" }
  );
}

/** Overflow, nav, a11y and route-shape probes run inside the page. */
const PAGE_PROBE = `
  const doc = document.documentElement;
  const overflowX = doc.scrollWidth - doc.clientWidth;
  const wide = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.right > doc.clientWidth + 1;
    })
    .slice(0, 5)
    .map((el) => el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 60));

  const nav = document.querySelector('nav[aria-label="CRM workspace"]');
  const navLabels = nav ? [...nav.querySelectorAll('a')].map((a) => a.textContent.trim()) : [];
  const activeNav = nav
    ? [...nav.querySelectorAll('a[aria-current="page"]')].map((a) => a.textContent.trim())
    : [];

  const smallTargets = [...document.querySelectorAll('a[href], button:not([disabled])')]
    .filter((el) => {
      // Visually-hidden skip links are keyboard affordances, not touch targets.
      if (el.closest('.sr-only')) return false;
      if (el.classList.contains('sr-only')) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      // A stretched-overlay link inherits its card's hit area.
      const stretched = getComputedStyle(el, '::after').position === 'absolute';
      if (stretched) return false;
      return rect.height < 32;
    })
    .slice(0, 5)
    .map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40));

  return {
    overflowX,
    wide,
    navLabels,
    activeNav,
    smallTargets,
    title: document.querySelector('h1')?.textContent?.trim() ?? null,
    rangeTitle: document.querySelector('[data-testid="crm-calendar-range-title"]')?.textContent?.trim() ?? null,
    calendarDay: Boolean(document.querySelector('[data-testid="crm-calendar-day"]')),
    calendarWeek: Boolean(document.querySelector('[data-testid="crm-calendar-week"]')),
    calendarMonth: Boolean(document.querySelector('[data-testid="crm-calendar-month"]')),
    events: document.querySelectorAll('[data-testid="crm-calendar-event"]').length,
    pipelineColumns: [...document.querySelectorAll('[data-testid="crm-pipeline-column"]')]
      .map((el) => el.getAttribute('data-stage')),
    pipelineCards: document.querySelectorAll('[data-testid="crm-pipeline-card"]').length,
    moveButtons: document.querySelectorAll('[data-testid="crm-pipeline-move-stage"]').length,
    urgencies: [...document.querySelectorAll('[data-testid="crm-pipeline-card"]')]
      .map((el) => el.getAttribute('data-urgency')),
    leadsPipelineLink: Boolean(document.querySelector('[data-testid="crm-leads-pipeline-link"]')),
    legacyPipelineToggle: Boolean(document.querySelector('a[href*="view=pipeline"]')),
  };
`;

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const browserPath = findBrowser();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm2b-qa-"));
  // Never reuse 9222: the operator may already have Chrome listening there, and
  // attaching to their browser would both read the wrong page and risk closing it.
  const port = await findFreeDebugPort();

  const browser = spawn(
    browserPath,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let cdp;
  try {
    const target = await waitFor(
      async () => {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        const targets = await response.json();
        return targets.find(
          (entry) => entry.type === "page" && entry.url === "about:blank"
        );
      },
      { label: "CDP page target" }
    );

    cdp = await Cdp.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    await login(cdp);
    record("login as super_admin", true, EMAIL);

    // Resolve a representative lead detail route from the live Leads page.
    await cdp.navigate(`${BASE}/admin/crm/leads`);
    const leadHref = await cdp.evaluate(`
      const link = document.querySelector('a[href^="/admin/crm/leads/"]:not([href$="/new"])');
      return link ? link.getAttribute('href') : null;
    `);
    const routes = ROUTES.map((route) =>
      route.key === "lead-detail" ? { ...route, path: leadHref } : route
    );
    record("representative lead detail resolved", Boolean(leadHref), leadHref ?? "none");

    const results = [];
    for (const viewport of VIEWPORTS) {
      await cdp.setViewport(viewport);
      for (const route of routes) {
        if (!route.path) continue;
        await cdp.navigate(`${BASE}${route.path}`);
        const probe = await cdp.evaluate(PAGE_PROBE);
        await cdp.screenshot(
          path.join(artifactsDir, `${viewport.label}-${route.key}.png`)
        );

        record(
          `no horizontal overflow ${viewport.label} ${route.key}`,
          probe.overflowX <= 0,
          probe.overflowX > 0 ? `overflowX=${probe.overflowX} ${probe.wide.join(" | ")}` : ""
        );
        record(
          `nav active state ${viewport.label} ${route.key}`,
          probe.activeNav.includes(route.nav),
          `active=${probe.activeNav.join(",") || "none"}`
        );
        results.push({ viewport: viewport.label, route: route.key, ...probe });
      }
    }

    // Route-shape assertions (checked once, at desktop width).
    await cdp.setViewport(VIEWPORTS[6]);

    await cdp.navigate(`${BASE}/admin/crm/calendar?view=day`);
    const day = await cdp.evaluate(PAGE_PROBE);
    record("day view renders a time grid", day.calendarDay, day.rangeTitle ?? "");

    await cdp.navigate(`${BASE}/admin/crm/calendar?view=week`);
    const week = await cdp.evaluate(PAGE_PROBE);
    record("week view renders", week.calendarWeek, `${week.events} events`);
    record("week shows CRM activities", week.events > 0, `${week.events} events`);

    await cdp.navigate(`${BASE}/admin/crm/calendar?view=month`);
    const month = await cdp.evaluate(PAGE_PROBE);
    record("month view renders", month.calendarMonth, month.rangeTitle ?? "");

    // Date controls move the rendered range.
    const beforeNext = month.rangeTitle;
    await cdp.evaluate(`
      document.querySelector('[data-testid="crm-calendar-next"]').click();
      return true;
    `);
    await waitFor(
      async () =>
        (await cdp.evaluate(
          `return document.querySelector('[data-testid="crm-calendar-range-title"]')?.textContent?.trim() ?? null`
        )) !== beforeNext,
      { label: "next period" }
    );
    const afterNext = await cdp.evaluate(
      `return document.querySelector('[data-testid="crm-calendar-range-title"]')?.textContent?.trim() ?? null`
    );
    record("next period control advances the range", afterNext !== beforeNext, `${beforeNext} -> ${afterNext}`);

    await cdp.evaluate(`document.querySelector('[data-testid="crm-calendar-today"]').click(); return true;`);
    await waitFor(
      async () =>
        (await cdp.evaluate(
          `return document.querySelector('[data-testid="crm-calendar-range-title"]')?.textContent?.trim() ?? null`
        )) === beforeNext,
      { label: "today reset" }
    );
    record("today control returns to the current period", true, beforeNext ?? "");

    // Event click opens the focused detail dialog with a non-drag reschedule.
    await cdp.navigate(`${BASE}/admin/crm/calendar?view=week`);
    const dialog = await cdp.evaluate(`
      const chip = document.querySelector('[data-testid="crm-calendar-event"]');
      if (!chip) return { opened: false };
      chip.click();
      await new Promise((r) => setTimeout(r, 400));
      const shell = document.querySelector('[data-testid="crm-calendar-event-dialog"]');
      return {
        opened: Boolean(shell),
        openLead: Boolean(document.querySelector('[data-testid="crm-calendar-open-lead"]')),
        reschedule: Boolean(document.querySelector('[data-testid="crm-calendar-reschedule-open"]')),
        modal: shell?.getAttribute('aria-modal') === 'true',
      };
    `);
    record("event click opens detail dialog", dialog.opened);
    record("dialog offers Open lead", Boolean(dialog.openLead));
    record("dialog offers non-drag Reschedule", Boolean(dialog.reschedule));

    const rescheduleForm = await cdp.evaluate(`
      const button = document.querySelector('[data-testid="crm-calendar-reschedule-open"]');
      if (!button) return { shown: false };
      button.click();
      await new Promise((r) => setTimeout(r, 300));
      return {
        shown: Boolean(document.querySelector('[data-testid="crm-calendar-reschedule-due"]')),
        submit: Boolean(document.querySelector('[data-testid="crm-calendar-reschedule-submit"]')),
      };
    `);
    record("keyboard reschedule form opens", Boolean(rescheduleForm.shown));
    record("keyboard reschedule can submit", Boolean(rescheduleForm.submit));

    // Pipeline shape.
    await cdp.navigate(`${BASE}/admin/crm/pipeline`);
    const pipeline = await cdp.evaluate(PAGE_PROBE);
    record(
      "pipeline renders canonical stage columns",
      pipeline.pipelineColumns.length === 8,
      pipeline.pipelineColumns.join(",")
    );
    record(
      "closed_won is not a droppable column",
      !pipeline.pipelineColumns.includes("closed_won"),
      pipeline.pipelineColumns.join(",")
    );
    record("pipeline renders cards", pipeline.pipelineCards > 0, `${pipeline.pipelineCards} cards`);
    record(
      "every card exposes a non-drag Move stage control",
      pipeline.moveButtons === pipeline.pipelineCards,
      `${pipeline.moveButtons}/${pipeline.pipelineCards}`
    );
    record(
      "urgency signals are present and never fabricate SLA",
      pipeline.urgencies.length > 0 && !pipeline.urgencies.includes("sla_breach"),
      pipeline.urgencies.join(",")
    );

    const openMoveDialogFor = (stage) => `
      const column = document.querySelector('[data-testid="crm-pipeline-column"][data-stage="${stage}"]');
      const button = column?.querySelector('[data-testid="crm-pipeline-move-stage"]');
      if (!button) return { opened: false, forward: 0 };
      button.click();
      await new Promise((r) => setTimeout(r, 400));
      const shell = document.querySelector('[data-testid="crm-pipeline-move-dialog"]');
      const forwardTargets = [...document.querySelectorAll('[data-testid^="crm-pipeline-move-to-"]')]
        .map((el) => el.getAttribute('data-testid').replace('crm-pipeline-move-to-', ''));
      return {
        opened: Boolean(shell),
        forward: forwardTargets.length,
        forwardTargets,
        onHold: Boolean(document.querySelector('[data-testid="crm-pipeline-on-hold"]')),
        closedLost: Boolean(document.querySelector('[data-testid="crm-pipeline-closed-lost"]')),
        closedWon: document.body.innerText.includes('Closed Won is set only when a quotation is accepted'),
        offersClosedWonButton: Boolean(document.querySelector('[data-testid="crm-pipeline-move-to-closed_won"]')),
      };
    `;

    const moveDialog = await cdp.evaluate(openMoveDialogFor("contacted"));
    record("move-stage dialog opens", Boolean(moveDialog.opened));
    record(
      "dialog offers forward stages",
      moveDialog.forward > 0,
      moveDialog.forwardTargets?.join(",") ?? "none"
    );
    record("dialog routes on-hold through its reason flow", Boolean(moveDialog.onHold));
    record("dialog routes closed-lost through its reason flow", Boolean(moveDialog.closedLost));
    record("Closed Won cannot be selected", !moveDialog.offersClosedWonButton);
    record("Closed Won authority is explained", Boolean(moveDialog.closedWon));

    // Assignment-owned stages must offer no forward hop from the board.
    await cdp.navigate(`${BASE}/admin/crm/pipeline`);
    const newStageDialog = await cdp.evaluate(openMoveDialogFor("new"));
    record(
      "new-stage cards offer no forward hop (assignment owns it)",
      newStageDialog.opened && newStageDialog.forward === 0,
      `${newStageDialog.forward} targets`
    );

    // Touch targets across the two new workspaces.
    for (const routePath of ["/admin/crm/calendar?view=week", "/admin/crm/pipeline"]) {
      await cdp.setViewport(VIEWPORTS[1]);
      await cdp.navigate(`${BASE}${routePath}`);
      const probe = await cdp.evaluate(PAGE_PROBE);
      record(
        `touch targets >= 32px on ${routePath}`,
        probe.smallTargets.length === 0,
        probe.smallTargets.join(" | ")
      );
    }
    await cdp.setViewport(VIEWPORTS[6]);

    // Leads cutover.
    await cdp.navigate(`${BASE}/admin/crm/leads`);
    const leads = await cdp.evaluate(PAGE_PROBE);
    record("leads links to the dedicated pipeline", Boolean(leads.leadsPipelineLink));
    record("leads keeps no view=pipeline toggle", !leads.legacyPipelineToggle);

    const summary = {
      capturedAt: new Date().toISOString(),
      base: BASE,
      browser: browserPath,
      viewports: VIEWPORTS.map((v) => v.label),
      routes: routes.filter((r) => r.path).map((r) => r.key),
      checks,
      results,
    };
    fs.writeFileSync(
      path.join(artifactsDir, "report.json"),
      `${JSON.stringify(summary, null, 2)}\n`
    );

    const failed = checks.filter((check) => !check.ok);
    console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
    console.log(`artifacts: ${path.relative(root, artifactsDir)}`);
    if (failed.length > 0) {
      console.log("\nFailures:");
      for (const check of failed) console.log(` - ${check.name}: ${check.detail}`);
      process.exitCode = 1;
    }
  } finally {
    // Only ever terminate the browser this script spawned.
    browser.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
