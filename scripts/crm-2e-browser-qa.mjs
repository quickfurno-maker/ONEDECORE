/**
 * CRM 2E rendered QA — local app only, installed Chrome/Edge over CDP.
 *
 * Same dependency-free harness as crm-2b/2c/2d-browser-qa.mjs: it drives an
 * installed browser through the Chrome DevTools Protocol using Node's built-in
 * WebSocket. No Playwright/Puppeteer.
 *
 * Certifies /admin/crm/reports: the four summary cards, first-response SLA
 * compliance, the conversion funnel, sales velocity, the current weighted
 * forecast, target achievement, role separation (Management Analytics vs My
 * Performance), and the seven locked viewports.
 *
 * Every metric is re-derived in the browser from the row's own data attributes,
 * so a rendered percentage is only accepted when it equals the arithmetic on the
 * numerator and denominator the page itself carries.
 *
 * Run scripts/crm-2e-owner-qa.mjs first (seeds the identities and the fixture).
 * This script NEVER seeds: a missing fixture fails loudly.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/crm-2e-browser-qa.mjs
 *
 * Artifacts: .artifacts/crm-2e/browser/ (gitignored)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertLocalAppUrl, requireQaPassword } from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "crm-2e", "browser");
const BASE = process.env.CRM_2E_BASE_URL ?? "http://localhost:3000";
const PASSWORD = requireQaPassword();

const SUPER_ADMIN_EMAIL = process.env.CRM_2E_QA_EMAIL ?? "owner-qa-sa@example.test";
const EXEC_EMAIL = process.env.CRM_2E_QA_EXEC_EMAIL ?? "owner-qa-execa@example.test";

const REPORTS_PATH = "/admin/crm/reports";

assertLocalAppUrl(BASE, "CRM_2E_BASE_URL");

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

/** Owner-locked CRM 2D stage probabilities, in basis points. Unchanged by 2E. */
const STAGE_PROBABILITY_BP = {
  new: 500,
  assigned: 1000,
  contacted: 2000,
  qualified: 3500,
  consultation_scheduled: 5000,
  proposal_sent: 6500,
  negotiation: 8000,
  closed_won: 10000,
  closed_lost: 0,
  on_hold: 0,
};

const FUNNEL_LADDER = [
  "received",
  "contacted",
  "qualified",
  "consultation_scheduled",
  "proposal_sent",
  "negotiation",
  "closed_won",
];

const checks = [];
function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(message) {
  throw new Error(message);
}

function findBrowser() {
  const override = process.env.CRM_2E_BROWSER_PATH;
  if (override && fs.existsSync(override)) return override;
  const found = BROWSER_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    fail("No installed Chrome/Edge found. Set CRM_2E_BROWSER_PATH to a browser binary.");
  }
  return found;
}

async function findFreeDebugPort() {
  for (let port = 9611; port < 9660; port += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(400),
      });
    } catch {
      return port;
    }
  }
  fail("No free CDP debug port in 9611-9659");
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
    await new Promise((resolve) => setTimeout(resolve, 900));
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

  async clearCookies() {
    await this.send("Network.clearBrowserCookies");
  }
}

async function login(cdp, email) {
  await cdp.navigate(
    `${BASE}/auth/login?next=${encodeURIComponent(REPORTS_PATH)}`
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
    setValue(email, ${JSON.stringify(email)});
    setValue(password, ${JSON.stringify(PASSWORD)});
    (email.form ?? document.querySelector('form')).requestSubmit();
    return true;
  `);
  await waitFor(
    async () => (await cdp.evaluate("return location.pathname")).startsWith("/admin"),
    { timeout: 90000, label: "login redirect into /admin" }
  );
}

/* -------------------------------------------------------------------------- */
/* Probes                                                                      */
/* -------------------------------------------------------------------------- */

/** Layout + responsive safety, shared by every viewport. */
const LAYOUT_PROBE = `
  const doc = document.documentElement;
  const overflowX = doc.scrollWidth - doc.clientWidth;
  const wide = [...document.querySelectorAll('body *')]
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.right > doc.clientWidth + 1;
    })
    .slice(0, 5)
    .map((el) => el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 60));

  const isScrollable = (el) => {
    const style = getComputedStyle(el);
    return ['auto', 'scroll'].includes(style.overflowX) || ['auto', 'scroll'].includes(style.overflow);
  };
  // A horizontally scrollable ancestor (admin sidebar, CRM nav strip, the wide
  // analytics tables) is a deliberate affordance, not a clipped control.
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

  const visible = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const root = document.querySelector('[data-testid="crm-2e-analytics"]');

  return {
    overflowX,
    wide,
    smallTargets,
    clipped,
    title: document.querySelector('h1')?.textContent?.trim() ?? null,
    scope: root?.getAttribute('data-scope') ?? null,
    analytics: visible('[data-testid="crm-2e-analytics"]'),
    summary: visible('[data-testid="crm-2e-summary"]'),
    cards: [
      'crm-2e-card-sla',
      'crm-2e-card-won-rate',
      'crm-2e-card-forecast',
      'crm-2e-card-target',
    ].filter((id) => visible('[data-testid="' + id + '"]')),
    sections: [
      'crm-2e-sla',
      'crm-2e-funnel',
      'crm-2e-velocity',
      'crm-2e-forecast',
      'crm-2e-targets',
    ].filter((id) => visible('[data-testid="' + id + '"]')),
    // The existing factual reports must survive underneath.
    legacyHeadings: [...document.querySelectorAll('h2')]
      .map((el) => el.textContent.trim())
      .filter((text) => text.length > 0),
    assigneeFilter: Boolean(document.querySelector('select[name="assignee"]')),
    presetFilter: Boolean(document.querySelector('select[name="preset"]')),
  };
`;

/** Every CRM 2E number, straight off the elements that render it. */
const METRIC_PROBE = `
  const num = (el, attr) => {
    const raw = el?.getAttribute(attr);
    if (raw === null || raw === undefined || raw === 'unknown' || raw === '') return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const txt = (sel) => document.querySelector(sel)?.textContent?.replace(/\\s+/g, ' ').trim() ?? null;
  const val = (sel, attr = 'data-value') => num(document.querySelector(sel), attr);

  const funnel = [...document.querySelectorAll('[data-testid="crm-2e-funnel-row"]')].map((row) => ({
    stage: row.getAttribute('data-stage'),
    reached: num(row, 'data-reached'),
    previousStage: row.getAttribute('data-previous-stage') || null,
    previousCount: num(row, 'data-previous-count'),
    stepBp: num(row, 'data-step-bp'),
    overallBp: num(row, 'data-overall-bp'),
  }));

  const transitions = [...document.querySelectorAll('[data-testid="crm-2e-transition-row"]')].map((row) => ({
    fromStage: row.getAttribute('data-from-stage'),
    toStage: row.getAttribute('data-to-stage'),
    sample: num(row, 'data-sample'),
    medianSeconds: num(row, 'data-median-seconds'),
  }));

  const forecast = [...document.querySelectorAll('[data-testid="crm-2e-forecast-row"]')].map((row) => ({
    stage: row.getAttribute('data-stage'),
    probabilityBp: num(row, 'data-probability-bp'),
    leadCount: num(row, 'data-lead-count'),
    valuedCount: num(row, 'data-valued-count'),
    dealValuePaise: num(row, 'data-deal-value-paise'),
    weightedPaise: num(row, 'data-weighted-paise'),
    cells: [...row.querySelectorAll('td')].map((cell) => cell.textContent.trim()),
  }));

  const parkedEl = document.querySelector('[data-testid="crm-2e-forecast-parked"]');
  const targets = [...document.querySelectorAll('[data-testid="crm-2e-target-row"]')].map((row) => ({
    scope: row.getAttribute('data-scope'),
    targetUserId: row.getAttribute('data-target-user-id') || null,
    targetPaise: num(row, 'data-target-paise'),
    achievedPaise: num(row, 'data-achieved-paise'),
    remainingPaise: num(row, 'data-remaining-paise'),
    attainmentBp: num(row, 'data-attainment-bp'),
    acceptedCount: num(row, 'data-accepted-count'),
    text: row.textContent.replace(/\\s+/g, ' ').trim(),
  }));
  const periodEl = document.querySelector('[data-testid="crm-2e-targets-period"]');

  return {
    scope: document.querySelector('[data-testid="crm-2e-analytics"]')?.getAttribute('data-scope') ?? null,
    sla: {
      eligible: val('[data-testid="crm-2e-sla-eligible"]'),
      met: val('[data-testid="crm-2e-sla-met"]'),
      breached: val('[data-testid="crm-2e-sla-breached"]'),
      pending: val('[data-testid="crm-2e-sla-pending"]'),
      outOfPolicy: val('[data-testid="crm-2e-sla-out-of-policy"]'),
      complianceBp: val('[data-testid="crm-2e-sla-compliance"]'),
      complianceText: txt('[data-testid="crm-2e-sla-compliance"]'),
      nonRetroactiveNote: txt('[data-testid="crm-2e-sla-non-retroactive-note"]'),
    },
    cards: {
      slaBp: val('[data-testid="crm-2e-card-sla"]'),
      wonRateBp: val('[data-testid="crm-2e-card-won-rate"]'),
      forecastPaise: val('[data-testid="crm-2e-card-forecast"]'),
      targetBp: val('[data-testid="crm-2e-card-target"]'),
      targetText: txt('[data-testid="crm-2e-card-target"]'),
    },
    funnel,
    lost: val('[data-testid="crm-2e-funnel-lost"]'),
    onHold: val('[data-testid="crm-2e-funnel-on-hold"]'),
    wonRateBp: val('[data-testid="crm-2e-funnel-won-rate"]'),
    velocity: {
      firstContactSeconds: val('[data-testid="crm-2e-velocity-first-contact"]'),
      firstContactText: txt('[data-testid="crm-2e-velocity-first-contact"]'),
      leadAgeSeconds: val('[data-testid="crm-2e-velocity-lead-age"]'),
      stageAgeSeconds: val('[data-testid="crm-2e-velocity-stage-age"]'),
      openCount: val('[data-testid="crm-2e-velocity-open-count"]'),
      transitions,
    },
    forecast: {
      rows: forecast,
      knownValuePaise: val('[data-testid="crm-2e-forecast-known-value"]'),
      weightedPaise: val('[data-testid="crm-2e-forecast-weighted"]'),
      valuedCount: val('[data-testid="crm-2e-forecast-known-count"]'),
      unknownCount: val('[data-testid="crm-2e-forecast-unknown-count"]'),
      openCountText: txt('[data-testid="crm-2e-forecast-known-count"]'),
      parkedCount: num(parkedEl, 'data-parked-count'),
      parkedValuedCount: num(parkedEl, 'data-parked-valued-count'),
      parkedPaise: num(parkedEl, 'data-parked-paise'),
    },
    targets: {
      rows: targets,
      period: periodEl?.getAttribute('data-period') ?? null,
      canReadCommercial: periodEl?.getAttribute('data-can-read-commercial') ?? null,
      periodAchievedPaise: num(periodEl, 'data-period-achieved-paise'),
      periodAcceptedCount: num(periodEl, 'data-period-accepted-count'),
      emptyNotice: txt('[data-testid="crm-2e-targets-empty"]'),
    },
    // Money CELLS only. Explanatory copy legitimately names the rule itself
    // ("never counted as zero rupees"), and prose is not a rendered value.
    moneyCells: [
      ...document.querySelectorAll(
        '[data-testid="crm-2e-forecast-row"] td, [data-testid="crm-2e-target-row"] td'
      ),
    ].map((cell) => cell.textContent.replace(/\\s+/g, ' ').trim()),
    // A row whose underlying value is UNKNOWN must render a word, not a number.
    unknownRowTexts: [
      ...document.querySelectorAll('[data-testid="crm-2e-target-row"]'),
    ]
      .filter((row) => row.getAttribute('data-achieved-paise') === 'unknown')
      .map((row) => row.textContent.replace(/\\s+/g, ' ').trim()),
    bodyText: document.body.textContent.replace(/\\s+/g, ' ').trim().slice(0, 4000),
  };
`;

/* -------------------------------------------------------------------------- */

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const browserPath = findBrowser();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm2e-qa-"));
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

    /* ---- Manager / super-admin: Management Analytics --------------------- */
    await cdp.setViewport(VIEWPORTS[6]);
    await login(cdp, SUPER_ADMIN_EMAIL);
    record("login as super_admin", true, SUPER_ADMIN_EMAIL);

    await cdp.navigate(`${BASE}${REPORTS_PATH}`);
    const managerLayout = await cdp.evaluate(LAYOUT_PROBE);

    if (!managerLayout.analytics) {
      fail(
        "CRM 2E analytics panel did not render on /admin/crm/reports. " +
          "Run scripts/crm-2e-owner-qa.mjs first; this script never seeds."
      );
    }
    const manager = await cdp.evaluate(METRIC_PROBE);
    if (manager.sla.eligible === null || manager.funnel.length !== 7) {
      fail(
        "CRM 2E fixture missing. Expected a seeded SLA cohort and a seven-stage funnel; " +
          `got eligible=${manager.sla.eligible}, funnel rows=${manager.funnel.length}.`
      );
    }
    record(
      "CRM 2E fixture resolved",
      true,
      `${manager.sla.eligible} SLA-eligible, ${manager.funnel[0].reached} received`
    );

    record(
      "manager sees Management Analytics on the existing reports route",
      managerLayout.title === "Management Analytics" && manager.scope === "management",
      `${managerLayout.title} / ${manager.scope}`
    );
    record(
      "the four locked summary cards are present",
      managerLayout.cards.length === 4,
      managerLayout.cards.join(",")
    );
    record(
      "all five analytics sections render",
      managerLayout.sections.length === 5,
      managerLayout.sections.join(",")
    );
    record(
      "existing factual reports survive underneath",
      [
        "Lead volume",
        "Pipeline status",
        "Lead trend",
        "Lead sources",
        "Assignment / workload",
        "Follow-up health",
        "Lead aging",
        "Closed-lost reasons",
      ].every((heading) => managerLayout.legacyHeadings.includes(heading)),
      managerLayout.legacyHeadings.join(" | ")
    );
    record(
      "one shared filter form governs both surfaces",
      managerLayout.presetFilter && managerLayout.assigneeFilter
    );

    /* ---- A. SLA ---------------------------------------------------------- */
    const decided = manager.sla.met + manager.sla.breached;
    record(
      "SLA buckets partition the eligible denominator exactly",
      manager.sla.met + manager.sla.breached + manager.sla.pending === manager.sla.eligible,
      `${manager.sla.met}+${manager.sla.breached}+${manager.sla.pending} vs ${manager.sla.eligible}`
    );
    record(
      "SLA compliance equals met / (met + breached)",
      manager.sla.complianceBp === Math.round((manager.sla.met * 10000) / decided),
      `${manager.sla.complianceBp} vs ${Math.round((manager.sla.met * 10000) / decided)}`
    );
    record(
      "pending leads are excluded from both sides of the ratio",
      manager.sla.pending > 0 && decided < manager.sla.eligible,
      `pending=${manager.sla.pending} decided=${decided} eligible=${manager.sla.eligible}`
    );
    record(
      "leads with no due snapshot are shown as outside policy, not breached",
      manager.sla.outOfPolicy > 0 &&
        /non-retroactive/i.test(manager.sla.nonRetroactiveNote ?? ""),
      `${manager.sla.outOfPolicy} outside policy`
    );
    record(
      "the summary card repeats the section's compliance figure",
      manager.cards.slaBp === manager.sla.complianceBp,
      `${manager.cards.slaBp} vs ${manager.sla.complianceBp}`
    );

    /* ---- C. Conversion --------------------------------------------------- */
    record(
      "funnel renders the canonical ladder in order",
      manager.funnel.map((row) => row.stage).join(",") === FUNNEL_LADDER.join(","),
      manager.funnel.map((row) => row.stage).join(",")
    );
    record(
      "closed_lost and on_hold are never inside the ladder",
      !manager.funnel.some((row) => ["closed_lost", "on_hold"].includes(row.stage)) &&
        manager.lost !== null &&
        manager.onHold !== null,
      `lost=${manager.lost} onHold=${manager.onHold}`
    );
    record(
      "stage reach never increases down the ladder",
      manager.funnel.every((row, index) =>
        index === 0 ? true : row.reached <= manager.funnel[index - 1].reached
      ),
      manager.funnel.map((r) => `${r.stage}=${r.reached}`).join(" ")
    );
    record(
      "every step % equals reached / its own named previous stage",
      manager.funnel.slice(1).every((row) => {
        const previous = manager.funnel.find((r) => r.stage === row.previousStage);
        return (
          previous !== undefined &&
          previous.reached === row.previousCount &&
          row.stepBp === Math.round((row.reached * 10000) / row.previousCount)
        );
      }),
      manager.funnel
        .slice(1)
        .map((r) => `${r.stage}:${r.reached}/${r.previousCount}=${r.stepBp}`)
        .join(" ")
    );
    record(
      "every of-received % equals reached / the funnel head",
      manager.funnel.every(
        (row) => row.overallBp === Math.round((row.reached * 10000) / manager.funnel[0].reached)
      ),
      manager.funnel.map((r) => `${r.stage}:${r.overallBp}`).join(" ")
    );
    const wonRow = manager.funnel.find((row) => row.stage === "closed_won");
    record(
      "won rate equals closed_won reach / received, on the card and in the section",
      manager.wonRateBp === wonRow.overallBp &&
        manager.cards.wonRateBp === manager.wonRateBp,
      `${manager.wonRateBp} vs ${wonRow.overallBp}`
    );
    record(
      "accepted-quotation Closed-Won is counted in the funnel",
      wonRow.reached >= 1,
      `closed_won reach=${wonRow.reached}`
    );

    /* ---- B. Velocity ----------------------------------------------------- */
    record(
      "velocity medians render, and an unknown reads as No data rather than 0",
      manager.velocity.firstContactSeconds !== null ||
        /No data/.test(manager.velocity.firstContactText ?? ""),
      `${manager.velocity.firstContactText}`
    );
    record(
      "every stage-to-stage row carries a real sample size",
      manager.velocity.transitions.length > 0 &&
        manager.velocity.transitions.every((row) => row.sample > 0),
      manager.velocity.transitions
        .map((r) => `${r.fromStage}->${r.toStage}:${r.sample}`)
        .join(" ")
    );
    record(
      "stage-to-stage pairs stay on the canonical ladder",
      manager.velocity.transitions.every((row) => {
        const from = FUNNEL_LADDER.indexOf(row.fromStage);
        const to = FUNNEL_LADDER.indexOf(row.toStage);
        return from >= 0 && to === from + 1;
      }),
      manager.velocity.transitions.map((r) => `${r.fromStage}->${r.toStage}`).join(" ")
    );
    record(
      "median durations are non-negative or explicitly unknown",
      manager.velocity.transitions.every(
        (row) => row.medianSeconds === null || row.medianSeconds >= 0
      )
    );

    /* ---- D. Forecast ----------------------------------------------------- */
    record(
      "forecast excludes parked and terminal stages from the active table",
      manager.forecast.rows.every(
        (row) => !["on_hold", "closed_won", "closed_lost"].includes(row.stage)
      ),
      manager.forecast.rows.map((r) => r.stage).join(",")
    );
    record(
      "every forecast row carries the owner-locked CRM 2D probability",
      manager.forecast.rows.every(
        (row) => row.probabilityBp === STAGE_PROBABILITY_BP[row.stage]
      ),
      manager.forecast.rows.map((r) => `${r.stage}:${r.probabilityBp}`).join(" ")
    );
    record(
      "weighted value equals deal value x probability, in exact paise",
      manager.forecast.rows.every(
        (row) =>
          row.weightedPaise === Math.round((row.dealValuePaise * row.probabilityBp) / 10000)
      ),
      manager.forecast.rows
        .map((r) => `${r.stage}:${r.dealValuePaise}x${r.probabilityBp}=${r.weightedPaise}`)
        .join(" ")
    );
    record(
      "forecast totals equal the sum of the rendered stage rows",
      manager.forecast.weightedPaise ===
        manager.forecast.rows.reduce((sum, row) => sum + row.weightedPaise, 0) &&
        manager.forecast.knownValuePaise ===
          manager.forecast.rows.reduce((sum, row) => sum + row.dealValuePaise, 0),
      `${manager.forecast.weightedPaise} weighted / ${manager.forecast.knownValuePaise} known`
    );
    record(
      "unknown-value leads are counted separately, never as zero rupees",
      manager.forecast.unknownCount ===
        manager.forecast.rows.reduce(
          (sum, row) => sum + (row.leadCount - row.valuedCount),
          0
        ) && manager.forecast.unknownCount > 0,
      `${manager.forecast.unknownCount} unknown`
    );
    record(
      "on hold is reported separately and excluded from every active total",
      manager.forecast.parkedCount !== null &&
        !manager.forecast.rows.some((row) => row.stage === "on_hold"),
      `parked=${manager.forecast.parkedCount}`
    );
    record(
      "the summary card repeats the section's weighted total",
      manager.cards.forecastPaise === manager.forecast.weightedPaise,
      `${manager.cards.forecastPaise} vs ${manager.forecast.weightedPaise}`
    );

    /* ---- E. Target achievement ------------------------------------------- */
    record(
      "target period is the Asia/Kolkata achievement month",
      /^\d{4}-\d{2}$/.test(manager.targets.period ?? ""),
      manager.targets.period ?? ""
    );
    record(
      "manager sees a team target row",
      manager.targets.rows.some((row) => row.scope === "sales_team"),
      manager.targets.rows.map((r) => r.scope).join(",")
    );
    record(
      "attainment equals achieved / target in exact paise",
      manager.targets.rows.every(
        (row) =>
          row.attainmentBp === Math.round((row.achievedPaise * 10000) / row.targetPaise)
      ),
      manager.targets.rows
        .map((r) => `${r.scope}:${r.achievedPaise}/${r.targetPaise}=${r.attainmentBp}`)
        .join(" ")
    );
    record(
      "remaining equals target minus achieved and never goes negative",
      manager.targets.rows.every(
        (row) => row.remainingPaise === Math.max(row.targetPaise - row.achievedPaise, 0)
      ),
      manager.targets.rows.map((r) => `${r.scope}:${r.remainingPaise}`).join(" ")
    );
    record(
      "achieved comes from accepted commercial truth, not the pipeline",
      manager.targets.canReadCommercial === "true" &&
        manager.targets.periodAcceptedCount >= 1 &&
        manager.targets.periodAchievedPaise > 0,
      `${manager.targets.periodAcceptedCount} accepted / ${manager.targets.periodAchievedPaise} paise`
    );
    record(
      "the summary card repeats the headline attainment",
      manager.cards.targetBp ===
        (manager.targets.rows.find((row) => row.scope === "sales_team")?.attainmentBp ?? null),
      `${manager.cards.targetBp}`
    );
    // A stage with nothing valued has an UNKNOWN money aggregate, not a zero
    // one. A target with a real, readable achievement of zero is a genuine
    // \u20B90 and must still render as such \u2014 the two are not interchangeable.
    const unknownAsZero = manager.forecast.rows.filter(
      (row) => row.valuedCount === 0 && row.cells.some((text) => /^\u20B90$/.test(text))
    );
    record(
      "a money aggregate over nothing valued renders unknown, never \u20B90",
      unknownAsZero.length === 0 &&
        manager.unknownRowTexts.every((text) => /Not visible|Unknown/.test(text)),
      unknownAsZero.map((row) => `${row.stage}:${row.cells.join("/")}`).join(" | ")
    );
    record(
      "a stage with valued leads still renders its real amount",
      manager.forecast.rows
        .filter((row) => row.valuedCount > 0)
        .every((row) => row.cells.some((text) => /\u20B9/.test(text))),
      manager.forecast.rows
        .filter((row) => row.valuedCount > 0)
        .map((row) => `${row.stage}:${row.cells.join("/")}`)
        .join(" | ")
    );

    await cdp.screenshot(path.join(artifactsDir, "manager-desktop.png"));

    /* ---- Responsive sweep, seven locked viewports ------------------------ */
    const results = [];
    for (const viewport of VIEWPORTS) {
      await cdp.setViewport(viewport);
      await cdp.navigate(`${BASE}${REPORTS_PATH}`);
      const probe = await cdp.evaluate(LAYOUT_PROBE);
      await cdp.screenshot(path.join(artifactsDir, `${viewport.label}-reports.png`));

      record(
        `no horizontal overflow ${viewport.label}`,
        probe.overflowX <= 0,
        probe.overflowX > 0 ? `overflowX=${probe.overflowX} ${probe.wide.join(" | ")}` : ""
      );
      record(
        `no clipped controls ${viewport.label}`,
        probe.clipped.length === 0,
        probe.clipped.join(" | ")
      );
      record(
        `all four summary cards and five sections visible ${viewport.label}`,
        probe.cards.length === 4 && probe.sections.length === 5,
        `${probe.cards.length} cards / ${probe.sections.length} sections`
      );
      if (viewport.mobile) {
        record(
          `touch targets >= 32px ${viewport.label}`,
          probe.smallTargets.length === 0,
          probe.smallTargets.join(" | ")
        );
      }
      results.push({ viewport: viewport.label, ...probe });
    }

    /* ---- Sales executive: My Performance, personal scope only ------------ */
    await cdp.setViewport(VIEWPORTS[6]);
    await cdp.navigate(`${BASE}/auth/signout`);
    await cdp.clearCookies();
    await login(cdp, EXEC_EMAIL);
    record("login as sales_executive", true, EXEC_EMAIL);

    await cdp.navigate(`${BASE}${REPORTS_PATH}`);
    const execLayout = await cdp.evaluate(LAYOUT_PROBE);
    const exec = await cdp.evaluate(METRIC_PROBE);
    await cdp.screenshot(path.join(artifactsDir, "executive-desktop.png"));

    record(
      "executive sees My Performance, not Management Analytics",
      execLayout.title === "My Performance" && exec.scope === "personal",
      `${execLayout.title} / ${exec.scope}`
    );
    record(
      "executive gets no assignee filter",
      execLayout.assigneeFilter === false
    );
    record(
      "executive sees no team target row",
      !exec.targets.rows.some((row) => row.scope === "sales_team"),
      exec.targets.rows.map((r) => r.scope).join(",") || "none"
    );
    record(
      "executive cohort is a strict subset of the team cohort (no aggregate leakage)",
      exec.funnel[0].reached < manager.funnel[0].reached &&
        exec.forecast.rows.reduce((sum, row) => sum + row.leadCount, 0) <=
          manager.forecast.rows.reduce((sum, row) => sum + row.leadCount, 0),
      `${exec.funnel[0].reached} < ${manager.funnel[0].reached} received`
    );
    record(
      "executive SLA denominator is its own, not the team's",
      exec.sla.eligible < manager.sla.eligible,
      `${exec.sla.eligible} < ${manager.sla.eligible}`
    );
    record(
      "executive personal attainment is exact and self-consistent",
      exec.targets.rows.every(
        (row) =>
          row.attainmentBp === Math.round((row.achievedPaise * 10000) / row.targetPaise) &&
          row.remainingPaise === Math.max(row.targetPaise - row.achievedPaise, 0)
      ),
      exec.targets.rows
        .map((r) => `${r.achievedPaise}/${r.targetPaise}=${r.attainmentBp}`)
        .join(" ")
    );
    record(
      "executive page states team aggregates are not shown",
      /Team aggregates are not shown/.test(exec.bodyText)
    );

    /* ---- A crafted assignee parameter must not widen scope ---------------- */
    await cdp.navigate(
      `${BASE}${REPORTS_PATH}?assignee=f4444444-4444-4444-4444-444444444444`
    );
    const crafted = await cdp.evaluate(METRIC_PROBE);
    record(
      "a crafted assignee parameter cannot widen an executive's scope",
      crafted.scope === "personal" && crafted.funnel[0].reached === exec.funnel[0].reached,
      `${crafted.funnel[0].reached} vs ${exec.funnel[0].reached}`
    );

    /* ---- Console + network ------------------------------------------------ */
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
      route: REPORTS_PATH,
      viewports: VIEWPORTS.map((v) => v.label),
      checks,
      manager: { ...manager, bodyText: undefined },
      executive: { ...exec, bodyText: undefined },
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
