/**
 * CRM 2D rendered QA — local app only, installed Chrome/Edge over CDP.
 *
 * Same dependency-free harness as crm-2b-browser-qa.mjs / crm-2c-browser-qa.mjs:
 * it drives an installed browser through the Chrome DevTools Protocol using
 * Node's built-in WebSocket. No Playwright/Puppeteer.
 *
 * Certifies the CRM 2D surfaces: unified timeline, lead command header, the five
 * locked quick actions, deterministic score + risk flags, canonical deal value,
 * stage probability and the weighted pipeline.
 *
 * Run scripts/crm-2b-owner-qa.mjs first (seeds the owner-QA staff identities),
 * and seed the CRM 2D lead fixture. This script NEVER seeds: a missing fixture
 * fails loudly rather than being silently replaced.
 *
 * Usage:
 *   PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/crm-2d-browser-qa.mjs
 *
 * Artifacts: .artifacts/crm-2d/browser/ (gitignored)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertLocalAppUrl, requireQaPassword } from "./phase-5c1-qa-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "crm-2d", "browser");
const BASE = process.env.CRM_2D_BASE_URL ?? "http://localhost:3000";
const PASSWORD = requireQaPassword();
const EMAIL = process.env.CRM_2D_QA_EMAIL ?? "owner-qa-sa@example.test";

/** The canonical CRM 2D local fixture. Never invented here. */
const FIXTURE_LEAD_ID =
  process.env.CRM_2D_FIXTURE_LEAD_ID ?? "120df5ea-46ea-4742-8e68-6ad1b80c5dd9";
const FIXTURE_NAME = process.env.CRM_2D_FIXTURE_NAME ?? "QA Anita Sharma";
/** Ex-tax canonical deal value the fixture carries (en-IN formatted). */
const FIXTURE_DEAL_VALUE = "₹84,00,000";
const FIXTURE_NOTE_FRAGMENT = "modular kitchen prioritised";

assertLocalAppUrl(BASE, "CRM_2D_BASE_URL");

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

/** Owner-locked stage probabilities, in basis points (Q7). */
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

const checks = [];
function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(message) {
  throw new Error(message);
}

function findBrowser() {
  const override = process.env.CRM_2D_BROWSER_PATH;
  if (override && fs.existsSync(override)) return override;
  const found = BROWSER_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      "No installed Chrome/Edge found. Set CRM_2D_BROWSER_PATH to a browser binary."
    );
  }
  return found;
}

async function findFreeDebugPort() {
  for (let port = 9511; port < 9560; port += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(400),
      });
    } catch {
      return port;
    }
  }
  throw new Error("No free CDP debug port in 9511-9559");
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
    `${BASE}/auth/login?next=${encodeURIComponent("/admin/crm/leads")}`
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

/* -------------------------------------------------------------------------- */
/* Probes                                                                      */
/* -------------------------------------------------------------------------- */

/** Layout + responsive safety, shared by every route and viewport. */
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

  const visible = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  return {
    overflowX,
    wide,
    smallTargets,
    clipped,
    // CRM 2D surfaces, when present on the route.
    header: visible('[data-testid="crm-lead-command-header"]'),
    scoreChip: document.querySelector('[data-testid="crm-lead-score-chip"]')?.getAttribute('data-band') ?? null,
    scoreValue: document.querySelector('[data-testid="crm-lead-score-chip"]')?.getAttribute('data-score') ?? null,
    riskFlags: [...document.querySelectorAll('[data-testid="crm-lead-risk-flags"] li')]
      .map((li) => li.getAttribute('data-risk-flag')),
    nextAction: document.querySelector('[data-testid="crm-lead-header-next-action"]')?.textContent?.trim() ?? null,
    commercial: visible('[data-testid="crm-lead-header-commercial"]'),
    dealValue: document.querySelector('[data-testid="crm-lead-header-deal-value"]')?.textContent?.trim() ?? null,
    probability: document.querySelector('[data-testid="crm-lead-header-probability"]')?.textContent?.trim() ?? null,
    weighted: document.querySelector('[data-testid="crm-lead-header-weighted-value"]')?.textContent?.trim() ?? null,
    quotationState: document.querySelector('[data-testid="crm-lead-header-quotation-state"]')?.textContent?.trim() ?? null,
    quickActions: visible('[data-testid="crm-lead-quick-actions"]'),
    quickActionIds: [...document.querySelectorAll('[data-testid^="crm-quick-action-"]')]
      .map((el) => el.getAttribute('data-testid'))
      .filter((id) => id !== 'crm-quick-action-error'),
    timeline: visible('[data-testid="crm-lead-timeline"]'),
    timelineEntries: document.querySelectorAll('[data-testid="crm-timeline-entry"]').length,
    noteComposer: Boolean(document.querySelector('[data-testid="lead-note-composer"]')),
    activityWorkspace: Boolean(document.querySelector('[data-testid="crm-activity-workspace"]')),
    statusPanel: Boolean(document.querySelector('[data-testid="lead-status-transition-panel"]')),
    cadencePanel: Boolean(document.querySelector('[data-testid="crm-lead-cadence-panel"]')),
    pipelineSummary: visible('[data-testid="crm-pipeline-value-summary"]'),
    pipelineCards: document.querySelectorAll('[data-testid="crm-pipeline-card"]').length,
    title: document.querySelector('h1')?.textContent?.trim() ?? null,
  };
`;

/** Lead-detail semantics: timeline content, labels, dedupe, note body. */
const LEAD_DETAIL_PROBE = `
  const entries = [...document.querySelectorAll('[data-testid="crm-timeline-entry"]')].map((li) => ({
    category: li.getAttribute('data-category'),
    source: li.getAttribute('data-source'),
    text: li.textContent.replace(/\\s+/g, ' ').trim(),
  }));

  const breakdownToggle = document.querySelector('[data-testid="crm-lead-score-toggle"]');
  if (breakdownToggle) breakdownToggle.click();
  await new Promise((r) => setTimeout(r, 200));
  const breakdown = document.querySelector('[data-testid="crm-lead-score-breakdown"]')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null;
  if (breakdownToggle) breakdownToggle.click();

  return {
    entries,
    entryCount: entries.length,
    breakdown,
    // Raw dotted DB/event codes must never reach the UI.
    rawCodes: entries
      .map((e) => e.text)
      .filter((t) => /\\b(lead|status|assignment|follow_up|cadence|quotation)\\.[a-z_]+/.test(t))
      .slice(0, 5),
    // A single business action must not render twice.
    stageEntries: entries.filter((e) => e.category === 'stage').length,
    assignmentEntries: entries.filter((e) => e.category === 'assignment').length,
    noteEntries: entries.filter((e) => e.category === 'note'),
    whatsappEntries: entries.filter((e) => /whatsapp/i.test(e.text)).length,
    quotationEntries: entries.filter((e) => e.category === 'quotation').length,
    hasNoteComposer: Boolean(document.querySelector('[data-testid="lead-note-composer"]')),
    // The old duplicate note-history list must be gone.
    legacyNoteList: document.body.textContent.includes('No notes recorded'),
    quotationHref: document.querySelector('[data-testid="crm-quick-action-quotation"]')?.getAttribute('href') ?? null,
  };
`;

/** Pipeline board: card facts and the server-backed value summary. */
const PIPELINE_PROBE = `
  const parseInr = (text) => {
    if (!text) return null;
    const m = text.match(/₹([\\d.]+)(Cr|L|K)?/);
    if (!m) return null;
    const n = Number(m[1]);
    if (m[2] === 'Cr') return n * 10000000;
    if (m[2] === 'L') return n * 100000;
    if (m[2] === 'K') return n * 1000;
    return n;
  };

  const columns = [...document.querySelectorAll('[data-testid="crm-pipeline-column"]')].map((col) => ({
    stage: col.getAttribute('data-stage'),
    total: Number(col.querySelector('header span')?.textContent?.trim() ?? '0'),
    renderedCards: col.querySelectorAll('[data-testid="crm-pipeline-card"]').length,
    valueLine: col.querySelector('[data-testid="crm-pipeline-column-value"]')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
  }));

  const summaryEl = document.querySelector('[data-testid="crm-pipeline-value-summary"]');
  const summaryText = summaryEl?.textContent?.replace(/\\s+/g, ' ').trim() ?? null;
  const valuedMatch = summaryText?.match(/(\\d+) of (\\d+) leads valued/) ?? null;

  const cards = [...document.querySelectorAll('[data-testid="crm-pipeline-card"]')].slice(0, 40).map((card) => ({
    leadId: card.getAttribute('data-lead-id'),
    urgency: card.getAttribute('data-urgency'),
    band: card.querySelector('[data-testid="crm-lead-score-chip"]')?.getAttribute('data-band') ?? null,
    score: card.querySelector('[data-testid="crm-lead-score-chip"]')?.getAttribute('data-score') ?? null,
    dealValue: card.querySelector('[data-testid="crm-pipeline-card-deal-value"]')?.textContent?.trim() ?? null,
  }));

  return {
    columns,
    summaryText,
    summaryWeightedRupees: parseInr(summaryText),
    valuedCount: valuedMatch ? Number(valuedMatch[1]) : null,
    totalCount: valuedMatch ? Number(valuedMatch[2]) : null,
    cards,
    cardsWithScore: cards.filter((c) => c.band !== null).length,
    cardsWithValue: cards.filter((c) => c.dealValue !== null).length,
    parkedLine: document.querySelector('[data-testid="crm-pipeline-parked-summary"]')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
  };
`;

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const browserPath = findBrowser();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "crm2d-qa-"));
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

    /* ---- Fixture precondition: fail loudly, never substitute -------------- */
    const leadPath = `/admin/crm/leads/${FIXTURE_LEAD_ID}`;
    await cdp.navigate(`${BASE}${leadPath}`);
    const fixture = await cdp.evaluate(`
      return {
        title: document.querySelector('h1')?.textContent?.trim() ?? null,
        header: Boolean(document.querySelector('[data-testid="crm-lead-command-header"]')),
        dealValue: document.querySelector('[data-testid="crm-lead-header-deal-value"]')?.textContent?.trim() ?? null,
        stage: document.querySelector('[data-testid="crm-lead-command-header"]')?.textContent?.includes('Assigned') ?? false,
      };
    `);
    if (!fixture.header || fixture.title !== FIXTURE_NAME) {
      fail(
        `CRM 2D fixture missing. Expected lead ${FIXTURE_LEAD_ID} ("${FIXTURE_NAME}") ` +
          `with a command header; got title=${JSON.stringify(fixture.title)}. ` +
          `Seed the CRM 2D local QA fixture before running this script.`
      );
    }
    if (!String(fixture.dealValue ?? "").includes(FIXTURE_DEAL_VALUE)) {
      fail(
        `CRM 2D fixture has the wrong commercial state. Expected deal value ` +
          `${FIXTURE_DEAL_VALUE}; got ${JSON.stringify(fixture.dealValue)}. ` +
          `Reseed the issued-quotation fixture; this script will not invent one.`
      );
    }
    record("CRM 2D fixture resolved", true, `${FIXTURE_NAME} @ ${FIXTURE_DEAL_VALUE}`);

    const routes = [
      { key: "lead-detail", path: leadPath },
      { key: "pipeline", path: "/admin/crm/pipeline" },
      { key: "leads", path: "/admin/crm/leads" },
    ];

    /* ---- Responsive sweep across all seven locked viewports --------------- */
    const results = [];
    for (const viewport of VIEWPORTS) {
      await cdp.setViewport(viewport);
      for (const route of routes) {
        await cdp.navigate(`${BASE}${route.path}`);
        const probe = await cdp.evaluate(LAYOUT_PROBE);
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

        if (route.key === "lead-detail") {
          record(`command header visible ${viewport.label}`, probe.header === true);
          record(
            `score band rendered ${viewport.label}`,
            probe.scoreChip !== null && probe.scoreValue !== null,
            `${probe.scoreChip} ${probe.scoreValue}`
          );
          record(
            `overdue risk flag surfaced ${viewport.label}`,
            probe.riskFlags.includes("OVERDUE_NEXT_ACTION"),
            probe.riskFlags.join(",")
          );
          record(
            `primary next action + overdue state visible ${viewport.label}`,
            Boolean(probe.nextAction) && /Overdue/i.test(probe.nextAction),
            (probe.nextAction ?? "").slice(0, 60)
          );
          record(
            `commercial facts present without breakage ${viewport.label}`,
            probe.commercial === true && probe.overflowX <= 0
          );
          record(
            `canonical deal value ${FIXTURE_DEAL_VALUE} ${viewport.label}`,
            String(probe.dealValue ?? "").includes(FIXTURE_DEAL_VALUE),
            probe.dealValue ?? ""
          );
          record(
            `quick-action area visible ${viewport.label}`,
            probe.quickActions === true && probe.quickActionIds.length === 5,
            probe.quickActionIds.join(",")
          );
          record(
            `unified timeline renders ${viewport.label}`,
            probe.timeline === true && probe.timelineEntries > 0,
            `${probe.timelineEntries} entries`
          );
          record(
            `note composer retained ${viewport.label}`,
            probe.noteComposer === true
          );
        }

        if (route.key === "pipeline") {
          record(
            `weighted pipeline summary visible ${viewport.label}`,
            probe.pipelineSummary === true
          );
        }

        results.push({ viewport: viewport.label, route: route.key, ...probe });
      }
    }

    /* ---- Desktop functional checks ---------------------------------------- */
    await cdp.setViewport(VIEWPORTS[6]);
    await cdp.navigate(`${BASE}${leadPath}`);

    const header = await cdp.evaluate(LAYOUT_PROBE);
    const detail = await cdp.evaluate(LEAD_DETAIL_PROBE);

    // Stage probability + weighted value must match the owner-locked table.
    const stageBp = STAGE_PROBABILITY_BP.assigned;
    record(
      "stage probability matches the locked table for the fixture stage",
      String(header.probability ?? "").includes(`${stageBp / 100}%`),
      header.probability ?? ""
    );
    record(
      "weighted value equals deal value x locked probability",
      String(header.weighted ?? "").includes("₹8,40,000"),
      `${header.weighted} (expected ₹84,00,000 x ${stageBp / 100}%)`
    );
    record(
      "quotation state reads Issued to client",
      String(header.quotationState ?? "").includes("Issued"),
      header.quotationState ?? ""
    );

    // Score orthogonality: maturity + engagement must equal the rendered score,
    // so a risk flag cannot have moved the number.
    const parts = (detail.breakdown ?? "").match(/Maturity (\d+) . Engagement (\d+)/);
    record(
      "risk flags do not alter the score (maturity + engagement === score)",
      Boolean(parts) && Number(parts[1]) + Number(parts[2]) === Number(header.scoreValue),
      `${detail.breakdown ?? "no breakdown"} vs score=${header.scoreValue}`
    );

    // Timeline semantics.
    record("no raw event codes leak into the timeline", detail.rawCodes.length === 0, detail.rawCodes.join(" | "));
    record(
      "no systematic event/activity twin duplication",
      detail.stageEntries <= 1 && detail.assignmentEntries <= 1,
      `stage=${detail.stageEntries} assignment=${detail.assignmentEntries}`
    );
    record(
      "full note body appears in the timeline",
      detail.noteEntries.some((e) => e.text.includes(FIXTURE_NOTE_FRAGMENT)),
      detail.noteEntries.map((e) => e.text.slice(0, 60)).join(" | ")
    );
    record(
      "duplicate note-history list removed, composer kept",
      detail.legacyNoteList === false && detail.hasNoteComposer === true
    );
    record("quotation timeline entries present", detail.quotationEntries > 0, `${detail.quotationEntries}`);
    record(
      "no unsupported WhatsApp timeline entry",
      detail.whatsappEntries === 0,
      `${detail.whatsappEntries}`
    );

    // Quick actions: the five locked ones, and no WhatsApp action.
    record(
      "exactly the five locked quick actions",
      header.quickActionIds.length === 5 &&
        ["call", "complete", "add-activity", "add-note", "quotation"].every((slug) =>
          header.quickActionIds.includes(`crm-quick-action-${slug}`)
        ),
      header.quickActionIds.join(",")
    );
    record(
      "no WhatsApp quick action",
      !header.quickActionIds.some((id) => /whatsapp/i.test(id))
    );

    // Stage transition, assignment and cadence stay in their own controls.
    const separation = await cdp.evaluate(`
      const qa = document.querySelector('[data-testid="crm-lead-quick-actions"]');
      return {
        statusPanel: Boolean(document.querySelector('[data-testid="lead-status-transition-panel"]')),
        cadencePanel: Boolean(document.querySelector('[data-testid="crm-lead-cadence-panel"]')),
        statusInsideQuickActions: Boolean(qa?.querySelector('[data-testid="lead-status-transition-panel"]')),
        cadenceInsideQuickActions: Boolean(qa?.querySelector('[data-testid="crm-lead-cadence-panel"]')),
        onHoldInsideQuickActions: Boolean(qa?.querySelector('[data-testid="lead-on-hold-button"]')),
      };
    `);
    record(
      "stage transition / cadence controls remain separate from quick actions",
      separation.statusPanel &&
        !separation.statusInsideQuickActions &&
        !separation.cadenceInsideQuickActions &&
        !separation.onHoldInsideQuickActions,
      JSON.stringify(separation)
    );

    // Quick action -> canonical owner. Non-destructive: nothing is submitted.
    const callAction = await cdp.evaluate(`
      document.querySelector('[data-testid="crm-quick-action-call"]').click();
      await new Promise((r) => setTimeout(r, 500));
      const form = document.querySelector('[data-testid="crm-create-activity-form"]');
      const type = document.querySelector('[data-testid="crm-create-activity-type"]');
      return { form: Boolean(form), type: type?.value ?? null };
    `);
    record(
      "Call opens the canonical create-activity form prefilled as call",
      callAction.form === true && callAction.type === "call",
      JSON.stringify(callAction)
    );

    const addActivity = await cdp.evaluate(`
      document.querySelector('[data-testid="crm-quick-action-add-activity"]').click();
      await new Promise((r) => setTimeout(r, 400));
      return Boolean(document.querySelector('[data-testid="crm-create-activity-form"]'));
    `);
    record("Add Activity reaches the canonical create-activity form", addActivity === true);

    const completeAction = await cdp.evaluate(`
      document.querySelector('[data-testid="crm-quick-action-complete"]').click();
      await new Promise((r) => setTimeout(r, 600));
      const opened = Boolean(document.querySelector('[data-testid="crm-complete-submit"]'));
      // Close again without submitting — QA must not mutate lifecycle state.
      const closer = [...document.querySelectorAll('button')]
        .find((b) => /^(cancel|close)$/i.test(b.textContent.trim()));
      if (closer) closer.click();
      await new Promise((r) => setTimeout(r, 300));
      return { opened, closed: !document.querySelector('[data-testid="crm-complete-submit"]') };
    `);
    record(
      "Complete Next Action opens the canonical completion dialog",
      completeAction.opened === true,
      JSON.stringify(completeAction)
    );
    record(
      "completion dialog closed without mutating the activity",
      completeAction.closed === true
    );

    const addNote = await cdp.evaluate(`
      document.querySelector('[data-testid="crm-quick-action-add-note"]').click();
      await new Promise((r) => setTimeout(r, 500));
      const body = document.querySelector('[data-testid="lead-note-body"]');
      return { composer: Boolean(body), focused: document.activeElement === body, value: body?.value ?? '' };
    `);
    record(
      "Add Note focuses the canonical note composer",
      addNote.composer === true && addNote.focused === true,
      JSON.stringify({ composer: addNote.composer, focused: addNote.focused })
    );
    record("Add Note submits nothing on its own", addNote.value === "");

    record(
      "Quotation quick action links to the canonical quotation editor",
      /^\/admin\/quotations\/[0-9a-f-]+\/draft$/.test(detail.quotationHref ?? ""),
      detail.quotationHref ?? "not a link"
    );

    /* ---- Pipeline: cards + server-backed aggregate ------------------------ */
    await cdp.navigate(`${BASE}/admin/crm/pipeline`);
    const pipeline = await cdp.evaluate(PIPELINE_PROBE);
    await cdp.screenshot(path.join(artifactsDir, "pipeline-desktop.png"));

    record(
      "pipeline cards render score and band",
      pipeline.cardsWithScore === pipeline.cards.length && pipeline.cards.length > 0,
      `${pipeline.cardsWithScore}/${pipeline.cards.length}`
    );
    record(
      "pipeline cards render urgency (risk) state",
      pipeline.cards.every((card) => card.urgency !== null)
    );
    record(
      "pipeline card shows the canonical deal value where known",
      pipeline.cardsWithValue > 0,
      `${pipeline.cardsWithValue} valued cards`
    );
    record(
      "per-column weighted value line present",
      pipeline.columns.some((col) => col.valueLine !== null),
      pipeline.columns.map((c) => `${c.stage}:${c.valueLine ?? "-"}`).slice(0, 3).join(" | ")
    );

    // The board fetches a bounded head per column. If any column's exact total
    // exceeds its rendered cards, a client-side sum of visible cards could not
    // produce the summary — proving the aggregate is server-backed.
    const truncated = pipeline.columns.filter((col) => col.total > col.renderedCards);
    record(
      "a column is truncated, so the summary cannot come from visible cards",
      truncated.length > 0,
      truncated.map((c) => `${c.stage} ${c.renderedCards}/${c.total}`).join(" | ")
    );
    record(
      "weighted summary counts every RLS-scoped lead, not just rendered cards",
      pipeline.totalCount !== null &&
        pipeline.totalCount > pipeline.cards.length &&
        pipeline.valuedCount <= pipeline.totalCount,
      `${pipeline.valuedCount}/${pipeline.totalCount} valued vs ${pipeline.cards.length} rendered`
    );
    record(
      "unknown-value leads are excluded from totals rather than counted as zero",
      pipeline.valuedCount !== null && pipeline.valuedCount < pipeline.totalCount,
      `${pipeline.valuedCount} valued of ${pipeline.totalCount}`
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
      fixtureLeadId: FIXTURE_LEAD_ID,
      viewports: VIEWPORTS.map((v) => v.label),
      routes: routes.map((r) => r.key),
      checks,
      leadDetail: { ...detail, entries: detail.entries.slice(0, 20) },
      pipeline,
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
