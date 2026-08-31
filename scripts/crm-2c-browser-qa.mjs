/**
 * CRM 2C rendered QA — local app only, installed Chrome/Edge over CDP.
 *
 * Same dependency-free harness as crm-2b-browser-qa.mjs: it drives an installed
 * browser through the Chrome DevTools Protocol using Node's built-in WebSocket.
 * Adds console-exception and failed-request capture, which CRM 2C QA requires.
 *
 * Run scripts/crm-2b-owner-qa.mjs then scripts/crm-2c-owner-qa.mjs first.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/crm-2c-browser-qa.mjs
 *
 * Artifacts: .artifacts/crm-2c/browser/ (gitignored)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertLocalAppUrl, requireQaPassword } from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "crm-2c", "browser");
const BASE = process.env.CRM_2C_BASE_URL ?? "http://localhost:3000";
const PASSWORD = requireQaPassword();
const EMAIL = process.env.CRM_2C_QA_EMAIL ?? "owner-qa-sa@example.test";

assertLocalAppUrl(BASE, "CRM_2C_BASE_URL");

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

const checks = [];
function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function findBrowser() {
  const override = process.env.CRM_2C_BROWSER_PATH;
  if (override && fs.existsSync(override)) return override;
  const found = BROWSER_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      "No installed Chrome/Edge found. Set CRM_2C_BROWSER_PATH to a browser binary."
    );
  }
  return found;
}

async function findFreeDebugPort() {
  for (let port = 9461; port < 9510; port += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(400),
      });
    } catch {
      return port;
    }
  }
  throw new Error("No free CDP debug port in 9461-9509");
}

async function waitFor(fn, { timeout = 60000, interval = 250, label = "condition" } = {}) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(
    `Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`
  );
}

/** Minimal CDP session over Node's built-in WebSocket. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.failedRequests = [];
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.consoleErrors.push(
          message.params?.exceptionDetails?.exception?.description ??
            message.params?.exceptionDetails?.text ??
            "unknown exception"
        );
      }
      if (
        message.method === "Runtime.consoleAPICalled" &&
        message.params?.type === "error"
      ) {
        this.consoleErrors.push(
          (message.params.args ?? [])
            .map((arg) => arg.description ?? arg.value ?? "")
            .join(" ")
            .slice(0, 300)
        );
      }
      if (message.method === "Network.loadingFailed" && !message.params?.canceled) {
        this.failedRequests.push(
          `${message.params?.type ?? "?"} ${message.params?.errorText ?? "?"}`
        );
      }
      if (
        message.method === "Network.responseReceived" &&
        message.params?.response?.status >= 500
      ) {
        this.failedRequests.push(
          `${message.params.response.status} ${message.params.response.url}`
        );
      }
    });
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("CDP socket error")), {
        once: true,
      });
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
      throw new Error(
        result.exceptionDetails.exception?.description ?? "evaluate failed"
      );
    }
    return result.result.value;
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
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
  await cdp.navigate(
    `${BASE}/auth/login?next=${encodeURIComponent("/admin/crm/cadences")}`
  );
  // Dev builds compile /auth/login on demand; wait for hydration before typing.
  await waitFor(
    async () =>
      await cdp.evaluate(
        `return Boolean(document.querySelector('input[type="email"], input[name="email"]'))`
      ),
    { timeout: 120000, label: "login form" }
  );
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
    async () => (await cdp.evaluate("return location.pathname")).startsWith("/admin"),
    { timeout: 90000, label: "login redirect into /admin" }
  );
}

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

  const isScrollable = (el) => {
    const style = getComputedStyle(el);
    return ['auto', 'scroll'].includes(style.overflowX) || ['auto', 'scroll'].includes(style.overflow);
  };
  // A horizontally scrollable ancestor (admin sidebar, CRM nav strip, pipeline
  // board) is a deliberate affordance, not a clipped control.
  const insideScroller = (el) => {
    let parent = el.parentElement;
    while (parent && parent !== doc) {
      if (isScrollable(parent)) return true;
      parent = parent.parentElement;
    }
    return false;
  };

  const smallTargets = [...document.querySelectorAll('a[href], button:not([disabled]), select')]
    .filter((el) => {
      if (el.closest('.sr-only') || el.classList.contains('sr-only')) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const stretched = getComputedStyle(el, '::after').position === 'absolute';
      if (stretched) return false;
      return rect.height < 32;
    })
    .slice(0, 5)
    .map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40));

  const clipped = [...document.querySelectorAll('button, a[href], select')]
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return false;
      if (insideScroller(el)) return false;
      return rect.left < -1 || rect.right > doc.clientWidth + 1;
    })
    .slice(0, 5)
    .map((el) => (el.textContent || el.tagName).trim().slice(0, 40));

  return {
    overflowX,
    wide,
    navLabels,
    smallTargets,
    clipped,
    title: document.querySelector('h1')?.textContent?.trim() ?? null,
    cadenceRows: document.querySelectorAll('[data-testid="crm-cadence-row"]').length,
    cadenceEditor: Boolean(document.querySelector('[data-testid="crm-cadence-draft-editor"]')),
    cadenceStepRows: document.querySelectorAll('[data-testid="crm-cadence-step-row"]').length,
    readonlySteps: document.querySelectorAll('[data-testid="crm-cadence-step-readonly"]').length,
    leadCadencePanel: Boolean(document.querySelector('[data-testid="crm-lead-cadence-panel"]')),
    cadenceProgress: document.querySelector('[data-testid="crm-lead-cadence-progress"]')?.textContent?.trim() ?? null,
    cadenceUpcoming: document.querySelector('[data-testid="crm-lead-cadence-upcoming"]')?.textContent?.trim() ?? null,
    activityWorkspace: Boolean(document.querySelector('[data-testid="crm-activity-workspace"]')),
  };
`;

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const browserPath = findBrowser();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm2c-qa-"));
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
        return targets.find((entry) => entry.type === "page" && entry.url === "about:blank");
      },
      { label: "CDP page target" }
    );

    cdp = await Cdp.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");

    await login(cdp);
    record("login as super_admin", true, EMAIL);

    // Resolve the seeded cadence templates and an enrolled lead.
    await cdp.navigate(`${BASE}/admin/crm/cadences`);
    const catalogue = await cdp.evaluate(`
      const rows = [...document.querySelectorAll('[data-testid="crm-cadence-row"]')];
      return rows.map((row) => ({
        href: row.getAttribute('href'),
        name: row.querySelector('p')?.textContent?.trim() ?? '',
        status: row.querySelector('[data-testid^="crm-cadence-status-"]')
          ?.getAttribute('data-testid')?.replace('crm-cadence-status-', '') ?? null,
      }));
    `);
    const draft = catalogue.find((row) => row.status === "draft");
    const published = catalogue.find((row) => row.status === "published");
    record("cadence catalogue lists seeded templates", catalogue.length >= 3, `${catalogue.length} rows`);
    record("catalogue exposes a draft and a published cadence", Boolean(draft && published));

    await cdp.navigate(`${BASE}/admin/crm/leads`);
    const enrolledLead = await cdp.evaluate(`
      const links = [...document.querySelectorAll('a[href^="/admin/crm/leads/"]')]
        .map((a) => a.getAttribute('href'))
        .filter((href) => href && !href.endsWith('/new'));
      return links[0] ?? null;
    `);

    // Find the lead detail page that actually has a cadence panel with progress.
    let cadenceLeadHref = null;
    const leadHrefs = await cdp.evaluate(`
      const hrefs = [...document.querySelectorAll('a[href^="/admin/crm/leads/"]')]
        .map((a) => a.getAttribute('href'))
        .filter((href) => href && !href.endsWith('/new'));
      return [...new Set(hrefs)];
    `);
    for (const href of leadHrefs) {
      await cdp.navigate(`${BASE}${href}`);
      const probe = await cdp.evaluate(PAGE_PROBE);
      if (probe.cadenceProgress) {
        cadenceLeadHref = href;
        break;
      }
    }
    record("enrolled lead detail resolved", Boolean(cadenceLeadHref), cadenceLeadHref ?? "none");

    const routes = [
      { key: "cadence-list", path: "/admin/crm/cadences" },
      { key: "cadence-new", path: "/admin/crm/cadences/new" },
      { key: "cadence-draft", path: draft?.href ?? null },
      { key: "cadence-published", path: published?.href ?? null },
      { key: "lead-cadence", path: cadenceLeadHref ?? enrolledLead },
      { key: "my-day", path: "/admin/crm/my-day" },
      { key: "calendar", path: "/admin/crm/calendar?view=week" },
      { key: "pipeline", path: "/admin/crm/pipeline" },
    ].filter((route) => route.path);

    const results = [];
    for (const viewport of VIEWPORTS) {
      await cdp.setViewport(viewport);
      for (const route of routes) {
        await cdp.navigate(`${BASE}${route.path}`);
        const probe = await cdp.evaluate(PAGE_PROBE);
        await cdp.screenshot(path.join(artifactsDir, `${viewport.label}-${route.key}.png`));

        record(
          `no horizontal overflow ${viewport.label} ${route.key}`,
          probe.overflowX <= 0,
          probe.overflowX > 0 ? `overflowX=${probe.overflowX} ${probe.wide.join(" | ")}` : ""
        );
        record(
          `no clipped controls ${viewport.label} ${route.key}`,
          probe.clipped.length === 0,
          probe.clipped.join(" | ")
        );
        if (viewport.mobile) {
          record(
            `touch targets >= 32px ${viewport.label} ${route.key}`,
            probe.smallTargets.length === 0,
            probe.smallTargets.join(" | ")
          );
        }
        results.push({ viewport: viewport.label, route: route.key, ...probe });
      }
    }

    // ---- Desktop behaviour checks -----------------------------------------
    await cdp.setViewport(VIEWPORTS[6]);

    await cdp.navigate(`${BASE}/admin/crm/cadences`);
    const nav = await cdp.evaluate(PAGE_PROBE);
    record("Cadences is a secondary CRM nav entry", nav.navLabels.includes("Cadences"), nav.navLabels.join(","));
    record(
      "primary daily nav keeps its CRM 2B order",
      nav.navLabels.slice(0, 4).join(",") === "My Day,Leads,Pipeline,Calendar",
      nav.navLabels.slice(0, 4).join(",")
    );

    if (draft?.href) {
      await cdp.navigate(`${BASE}${draft.href}`);
      const editor = await cdp.evaluate(`
        const upButtons = document.querySelectorAll('[data-testid="crm-cadence-step-up"]');
        const before = document.querySelectorAll('[data-testid="crm-cadence-step-row"]').length;
        document.querySelector('[data-testid="crm-cadence-add-step"]').click();
        await new Promise((r) => setTimeout(r, 250));
        const after = document.querySelectorAll('[data-testid="crm-cadence-step-row"]').length;
        const firstTitleBefore = document.querySelectorAll('[data-testid="crm-cadence-step-title"]')[0]?.value ?? null;
        const downs = document.querySelectorAll('[data-testid="crm-cadence-step-down"]');
        if (downs[0] && !downs[0].disabled) {
          downs[0].click();
          await new Promise((r) => setTimeout(r, 250));
        }
        const firstTitleAfter = document.querySelectorAll('[data-testid="crm-cadence-step-title"]')[0]?.value ?? null;
        return {
          editor: Boolean(document.querySelector('[data-testid="crm-cadence-draft-editor"]')),
          before,
          after,
          reordered: firstTitleBefore !== firstTitleAfter,
          hasUpDown: upButtons.length > 0,
          draggable: document.querySelectorAll('[data-testid="crm-cadence-step-row"][draggable="true"]').length,
          publish: Boolean(document.querySelector('[data-testid="crm-cadence-publish"]')),
          archive: Boolean(document.querySelector('[data-testid="crm-cadence-archive"]')),
        };
      `);
      record("draft renders the ordered step editor", editor.editor);
      record("Add step appends a step", editor.after === editor.before + 1, `${editor.before} -> ${editor.after}`);
      record("steps reorder without drag", editor.hasUpDown && editor.reordered);
      record("step rows are not drag-only", editor.draggable === 0);
      record("draft offers Publish and Archive", editor.publish && editor.archive);
    }

    if (published?.href) {
      await cdp.navigate(`${BASE}${published.href}`);
      const publishedView = await cdp.evaluate(`
        return {
          readonlySteps: document.querySelectorAll('[data-testid="crm-cadence-step-readonly"]').length,
          editor: Boolean(document.querySelector('[data-testid="crm-cadence-draft-editor"]')),
          duplicate: Boolean(document.querySelector('[data-testid="crm-cadence-duplicate"]')),
          publish: Boolean(document.querySelector('[data-testid="crm-cadence-publish"]')),
        };
      `);
      record("published cadence steps are read-only", publishedView.readonlySteps > 0 && !publishedView.editor);
      record("published cadence offers Duplicate to draft", publishedView.duplicate);
      record("published cadence cannot be published again", !publishedView.publish);
    }

    if (cadenceLeadHref) {
      await cdp.navigate(`${BASE}${cadenceLeadHref}`);
      const panel = await cdp.evaluate(`
        return {
          panel: Boolean(document.querySelector('[data-testid="crm-lead-cadence-panel"]')),
          progress: document.querySelector('[data-testid="crm-lead-cadence-progress"]')?.textContent?.trim() ?? null,
          upcoming: document.querySelector('[data-testid="crm-lead-cadence-upcoming"]')?.textContent?.trim() ?? null,
          status: document.querySelector('[data-testid="crm-lead-cadence-status"]')?.textContent?.trim() ?? null,
          pause: Boolean(document.querySelector('[data-testid="crm-lead-cadence-pause"]')),
          cancel: Boolean(document.querySelector('[data-testid="crm-lead-cadence-cancel"]')),
          history: Boolean(document.querySelector('[data-testid="crm-lead-cadence-history"]')) ||
            Boolean([...document.querySelectorAll('summary')].find((s) => s.textContent.includes('Cadence history'))),
          activities: Boolean(document.querySelector('[data-testid="crm-activity-workspace"]')),
          cadenceActivity: [...document.querySelectorAll('[data-testid="crm-activity-workspace"] *')]
            .some((el) => el.textContent === 'Cadence'),
        };
      `);
      record("lead detail shows the cadence panel", panel.panel);
      record("cadence panel shows progress", Boolean(panel.progress), panel.progress ?? "");
      record("cadence panel shows the upcoming step", Boolean(panel.upcoming), panel.upcoming ?? "");
      record("cadence panel offers pause and cancel", panel.pause && panel.cancel, panel.status ?? "");
      record("cadence panel exposes history", panel.history);
      record("Activities workspace still owns the activity UI", panel.activities);
    }

    // ---- Stage gate rejection UX ------------------------------------------
    await cdp.navigate(`${BASE}/admin/crm/pipeline`);
    const pipelineGate = await cdp.evaluate(`
      const card = [...document.querySelectorAll('[data-testid="crm-pipeline-card"]')]
        .find((el) => el.closest('[data-stage="assigned"]'));
      if (!card) return { attempted: false };
      card.querySelector('[data-testid="crm-pipeline-move-stage"]').click();
      await new Promise((r) => setTimeout(r, 350));
      const target = document.querySelector('[data-testid="crm-pipeline-move-to-contacted"]');
      if (!target) return { attempted: false, dialog: true };
      target.click();
      await new Promise((r) => setTimeout(r, 2500));
      const stillAssigned = Boolean(
        [...document.querySelectorAll('[data-stage="assigned"] [data-testid="crm-pipeline-card"]')].length
      );
      return {
        attempted: true,
        error: document.querySelector('[data-testid="crm-pipeline-error"]')?.textContent?.trim() ?? null,
        stillAssigned,
      };
    `);
    record("Pipeline attempts a gated move", Boolean(pipelineGate.attempted));
    record(
      "Pipeline shows the first-contact gate explanation",
      (pipelineGate.error ?? "").includes("first contact attempt"),
      pipelineGate.error ?? "none"
    );
    record(
      "Pipeline rolls the optimistic move back",
      Boolean(pipelineGate.stillAssigned),
      "card stayed in Assigned"
    );

    // Same rejection from lead detail, through the same server authority.
    const assignedLeadHref = await cdp.evaluate(`
      const card = [...document.querySelectorAll('[data-stage="assigned"] [data-testid="crm-pipeline-card"]')][0];
      const link = card?.querySelector('a[href^="/admin/crm/leads/"]');
      return link ? link.getAttribute('href') : null;
    `);
    if (assignedLeadHref) {
      await cdp.navigate(`${BASE}${assignedLeadHref}`);
      const detailGate = await cdp.evaluate(`
        const button = document.querySelector('[data-testid="lead-status-transition-contacted"]');
        if (!button) return { attempted: false };
        button.click();
        await new Promise((r) => setTimeout(r, 2500));
        const panel = document.querySelector('[data-testid="lead-status-transition-panel"]');
        return {
          attempted: true,
          error: panel?.querySelector('[role="alert"]')?.textContent?.trim() ?? null,
          stillPresent: Boolean(document.querySelector('[data-testid="lead-status-transition-contacted"]')),
        };
      `);
      record("lead detail attempts the same gated move", Boolean(detailGate.attempted));
      record(
        "lead detail shows the identical gate explanation",
        (detailGate.error ?? "").includes("first contact attempt"),
        detailGate.error ?? "none"
      );
      record("lead detail preserves UI state after rejection", Boolean(detailGate.stillPresent));
    }

    // ---- My Day / Calendar pick cadence activities up ----------------------
    await cdp.navigate(`${BASE}/admin/crm/my-day`);
    const myDay = await cdp.evaluate(`
      return { text: document.body.innerText.includes('Send intro and portfolio') ||
                     document.body.innerText.includes('First contact call') };
    `);
    record("My Day lists a cadence-generated activity", myDay.text);

    await cdp.navigate(`${BASE}/admin/crm/calendar?view=month`);
    const calendar = await cdp.evaluate(`
      return { events: document.querySelectorAll('[data-testid="crm-calendar-event"]').length };
    `);
    record("Calendar renders activities including cadence steps", calendar.events > 0, `${calendar.events} events`);

    // ---- Console / network health -----------------------------------------
    const ignorableConsole = cdp.consoleErrors.filter(
      (entry) => !/favicon|Download the React DevTools/i.test(entry)
    );
    record(
      "no console exceptions",
      ignorableConsole.length === 0,
      ignorableConsole.slice(0, 3).join(" | ")
    );
    const ignorableRequests = cdp.failedRequests.filter(
      (entry) => !/favicon/i.test(entry)
    );
    record(
      "no failed network requests",
      ignorableRequests.length === 0,
      ignorableRequests.slice(0, 3).join(" | ")
    );

    const summary = {
      capturedAt: new Date().toISOString(),
      base: BASE,
      browser: browserPath,
      viewports: VIEWPORTS.map((v) => v.label),
      routes: routes.map((r) => r.key),
      checks,
      probes: results,
      consoleErrors: ignorableConsole,
      failedRequests: ignorableRequests,
    };
    fs.writeFileSync(
      path.join(artifactsDir, "summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`
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
  } finally {
    try {
      cdp?.ws.close();
    } catch {
      /* socket already closed */
    }
    browser.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
