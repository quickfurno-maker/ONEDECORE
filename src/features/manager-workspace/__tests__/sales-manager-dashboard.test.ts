/**
 * The Sales Manager dashboard, asserted from the application side.
 *
 * TWO KINDS OF ASSERTION LIVE HERE
 *
 *   1. BEHAVIOUR — the pure derivations are executed. Priority ordering,
 *      de-duplication, bounding, and the four distinct absences (`0`,
 *      `No data`, `Unavailable`, `Not configured`) are proved by calling the
 *      functions, not by reading their source.
 *
 *   2. COMPOSITION — the dashboard is proved DEDICATED by reading the module
 *      graph: it must import the canonical read models, and must not import
 *      the owner's snapshot loader or the owner's panels. That question is
 *      about which modules exist in the import list, so source text is the
 *      honest way to ask it.
 *
 * The second kind is the one that matters over time. The role's boundary was
 * lost once by adding "just one more" owner surface to the manager, and a
 * dashboard is exactly the place that happens again.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  MANAGER_ATTENTION_PRIORITY,
  MANAGER_ATTENTION_REASONS,
  MANAGER_NOT_CONFIGURED_LABEL,
  MANAGER_NO_DATA_LABEL,
  MANAGER_PROJECT_ROW_LIMIT,
  MANAGER_UNAVAILABLE_LABEL,
  buildManagerAttentionQueue,
  buildManagerKpiStrip,
  buildManagerProjectRows,
  buildManagerWorkload,
  formatManagerAttainment,
  formatManagerCount,
  formatManagerPaise,
  managerPanelReady,
  managerPanelUnavailable,
  managerProjectStageLabel,
  type ManagerCrmSection,
  type ManagerDashboardSnapshot,
  type ManagerManagementSection,
} from "../contracts/manager-dashboard.ts";
import {
  MANAGER_NAV_ITEMS,
  MANAGER_QUICK_ACTIONS,
  isManagerNavItemActive,
} from "../contracts/manager-nav.ts";
import type { MyDaySnapshot } from "../../crm/contracts/my-day-contracts.ts";
import type { ProjectHighLevelStatus } from "../../projects/server/project-high-level-queries.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** Strips comments: these files DESCRIBE what they refuse to import. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

const DASHBOARD_SERVICE =
  "src/features/manager-workspace/server/manager-dashboard.ts";
const DASHBOARD_CONTRACT =
  "src/features/manager-workspace/contracts/manager-dashboard.ts";
const MANAGER_PAGE = "src/app/manager/page.tsx";
const MANAGER_ERROR = "src/app/manager/error.tsx";
const MANAGER_SHELL =
  "src/features/manager-workspace/components/ManagerShell.tsx";
const MANAGER_SIDEBAR =
  "src/features/manager-workspace/components/ManagerSidebar.tsx";
const MANAGER_TOP_BAR =
  "src/features/manager-workspace/components/ManagerTopBar.tsx";
const MANAGER_METRIC_CARD =
  "src/features/manager-workspace/components/ManagerMetricCard.tsx";
const MANAGER_ATTENTION =
  "src/features/manager-workspace/components/ManagerAttentionPanel.tsx";
const MANAGER_WORKLOAD =
  "src/features/manager-workspace/components/ManagerTeamWorkload.tsx";
const MANAGER_TARGET_CARD =
  "src/features/manager-workspace/components/ManagerTargetCard.tsx";
const MANAGER_PROJECTS =
  "src/features/manager-workspace/components/ManagerProjectStatus.tsx";

/**
 * Whole-identifier match.
 *
 * `ManagerMetricCard` contains `MetricCard`, and the manager is entitled to its
 * own card. The question is whether the OWNER's symbol is used, so the match is
 * anchored on identifier boundaries rather than on a substring.
 */
const usesIdentifier = (source: string, name: string) =>
  new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`).test(source);

/**
 * The owner's dashboard, named once.
 *
 * Every one of these is a Super Admin surface. None may appear anywhere in the
 * manager dashboard's module graph — not imported, not re-rendered, not
 * wrapped.
 */
const OWNER_SURFACES = [
  "loadOpsDashboardSnapshot",
  "OpsDashboardSnapshot",
  "OpsKpiItem",
  "MetricCard",
  "PipelinePanel",
  "NeedsAttentionPanel",
  "ActivityFeed",
  "SourceDonut",
  "RecentLeadsPanel",
  "TargetPanel",
  "AdminShell",
  "AdminSidebar",
  "AdminTopBar",
  "CommandPalette",
] as const;

/** Routes the Sales Manager role does not hold. */
const FORBIDDEN_ROUTES = [
  "/admin/campaigns",
  "/admin/landing-pages",
  "/admin/portfolio",
  "/admin/commerce",
  "/admin/crm/imports",
  "/admin/staff",
  "/admin/salary",
  "/admin/attendance-policies",
  "/admin/holidays",
  "/admin/crm/settings",
] as const;

/* ========================================================================== */
/* Fixtures                                                                    */
/* ========================================================================== */

function attentionRow(
  leadId: string,
  reason: "no_next_action" | "new_uncontacted" | "unassigned" | "sla_breach",
  overrides: Partial<{
    assigneeLabel: string | null;
    receivedAt: string;
    slaDueAt: string | null;
  }> = {}
) {
  return {
    leadId,
    leadDisplayLabel: `Lead ${leadId}`,
    assigneeId: overrides.assigneeLabel === null ? null : "user-1",
    assigneeLabel:
      overrides.assigneeLabel === undefined ? "Asha" : overrides.assigneeLabel,
    leadStatus: "new" as const,
    receivedAt: overrides.receivedAt ?? "2026-09-01T05:00:00.000Z",
    slaDueAt: overrides.slaDueAt ?? null,
    attentionReason: reason,
  };
}

function taskRow(activityId: string, leadId: string, dueAt: string) {
  return {
    activityId,
    leadId,
    leadDisplayLabel: `Lead ${leadId}`,
    ownerId: "user-1",
    ownerLabel: "Asha",
    activityType: "call",
    title: "Follow up",
    priority: "normal",
    dueAt,
    reminderAt: null,
    source: "manual",
    leadStatus: "contacted" as const,
  };
}

function myDay(overrides: Partial<MyDaySnapshot> = {}): MyDaySnapshot {
  const base: MyDaySnapshot = {
    capturedAt: "2026-09-06T09:00:00.000Z",
    localDate: "2026-09-06",
    scopeOwnerId: null,
    isTeamScope: true,
    canViewManagerSections: true,
    summary: {
      overdue: 0,
      dueToday: 0,
      upcoming: 0,
      noNextAction: 0,
      newUncontacted: 0,
      unassigned: 0,
      slaBreaches: 0,
    },
    tasks: { overdue: [], dueToday: [], upcoming: [] },
    attention: {
      noNextAction: [],
      newUncontacted: [],
      unassigned: [],
      slaBreaches: [],
    },
  };
  return { ...base, ...overrides };
}

const CRM_SECTION: ManagerCrmSection = {
  rangeLabel: "This month (IST)",
  totalLeads: 42,
  closedWonCount: 5,
  closedLostCount: 3,
  openFollowUps: 11,
  overdueFollowUps: 2,
  workload: buildManagerWorkload([]),
};

const MANAGEMENT_SECTION: ManagerManagementSection = {
  period: "2026-09",
  slaComplianceBasisPoints: 8_000,
  slaDecidedCount: 10,
  slaBreachedCount: 2,
  wonRateBasisPoints: 1_200,
  receivedCount: 42,
  medianFirstContactSeconds: 900,
  target: null,
};

function snapshot(
  overrides: Partial<ManagerDashboardSnapshot> = {}
): ManagerDashboardSnapshot {
  const day = myDay();
  const base: ManagerDashboardSnapshot = {
    capturedAt: day.capturedAt,
    localDate: day.localDate,
    identity: {
      userId: "user-1",
      displayName: "Asha Menon",
      firstName: "Asha",
      roleLabel: "Sales Manager",
    },
    execution: {
      localDate: day.localDate,
      isTeamScope: true,
      summary: day.summary,
      attention: [],
      attentionTotal: 0,
    },
    crm: managerPanelReady(CRM_SECTION),
    management: managerPanelReady(MANAGEMENT_SECTION),
    projects: managerPanelReady({ rows: [], totalCount: 0 }),
  };
  return { ...base, ...overrides };
}

function project(
  projectId: string,
  overrides: Partial<ProjectHighLevelStatus> = {}
): ProjectHighLevelStatus {
  return {
    projectId,
    projectNumber: `PRJ-${projectId}`,
    status: "in_progress",
    clientDisplayName: "Client",
    quotationNumber: null,
    commercialCurrency: null,
    commercialGrandTotalPaise: null,
    currentProjectManager: "Ravi",
    currentLeadDesigner: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    handoverAcceptedAt: null,
    designState: null,
    designStartedAt: null,
    designCompletedAt: null,
    executionState: null,
    executionInitializationStatus: null,
    executionUpdatedAt: null,
    executionCompletedAt: null,
    ...overrides,
  };
}

/* ========================================================================== */
/* 1. The dashboard is composed of the manager's own reads                     */
/* ========================================================================== */

describe("the manager dashboard composes canonical read models, not the owner's", () => {
  const service = read(DASHBOARD_SERVICE);
  const serviceCode = code(service);

  test("it reads My Day, reporting, management analytics and project status", () => {
    for (const source of [
      "fetchCrmMyDaySnapshot",
      "fetchCrmReportingSnapshotForContext",
      "fetchCrmManagementAnalyticsSnapshot",
      "readProjectHighLevelStatus",
      "fetchOpsIdentity",
    ]) {
      assert.ok(
        serviceCode.includes(source),
        `the snapshot service must compose ${source}`
      );
    }
  });

  test("it never reaches for the owner's dashboard loader or panels", () => {
    for (const owned of OWNER_SURFACES) {
      assert.ok(
        !usesIdentifier(serviceCode, owned),
        `the snapshot service must not use ${owned}`
      );
    }
  });

  test("it issues no SQL of its own", () => {
    /*
     * Every number is produced by a read model that enforces its own
     * permission. A `.rpc(` or a `.from(` here would be this module inventing
     * a read — which is how a dashboard ends up needing a new grant.
     */
    assert.doesNotMatch(serviceCode, /\.rpc\(/);
    assert.doesNotMatch(serviceCode, /\.from\(/);
    assert.doesNotMatch(serviceCode, /createClient/);
  });

  test("the period comes from the canonical IST range helper", () => {
    assert.match(serviceCode, /resolveReportDateRange\(\{\s*preset:\s*"this_month"/);
  });

  test("no boundary is hand-built out of UTC", () => {
    for (const forbidden of ["toISOString(", "T00:00:00Z", "setUTCDate", "Date.UTC"]) {
      assert.ok(
        !serviceCode.includes(forbidden),
        `the service must not hand-build a range with ${forbidden}`
      );
    }
  });

  test("the optional reads are isolated from each other", () => {
    assert.match(serviceCode, /Promise\.allSettled/);
  });

  test("a caller without CRM read access is refused, not shown an empty frame", () => {
    assert.match(serviceCode, /if \(!crmContext\)/);
    assert.match(serviceCode, /redirect\("\/auth\/forbidden"\)/);
  });

  test("the primary My Day read is awaited OUTSIDE the settled group", () => {
    const myDayAt = serviceCode.indexOf("await fetchCrmMyDaySnapshot");
    const settledAt = serviceCode.indexOf("Promise.allSettled");
    assert.ok(myDayAt > 0, "the primary read must exist");
    assert.ok(
      myDayAt < settledAt,
      "My Day must fail closed before the optional reads run"
    );
  });

  test("failing closed is a visible outcome, not a blank page", () => {
    const boundary = read(MANAGER_ERROR);
    assert.match(boundary, /could not load your dashboard/i);
    // The database's own words never reach the screen.
    assert.match(boundary, /digest/);
    assert.doesNotMatch(boundary, /\{error\.message\}/);
  });
});

/* ========================================================================== */
/* 2. The page is a dedicated dashboard                                        */
/* ========================================================================== */

describe("the manager page renders manager components only", () => {
  const page = read(MANAGER_PAGE);
  const pageCode = code(page);

  test("it is gated and fed by the manager's own service", () => {
    assert.match(pageCode, /await requireSalesManager\(\)/);
    assert.match(pageCode, /await loadManagerDashboardSnapshot\(access\)/);
  });

  test("it renders the dedicated shell and every dedicated panel", () => {
    for (const component of [
      "ManagerShell",
      "ManagerMetricCard",
      "ManagerAttentionPanel",
      "ManagerSalesPerformance",
      "ManagerTeamWorkload",
      "ManagerProjectStatus",
      "ManagerQuickActions",
    ]) {
      assert.ok(
        pageCode.includes(`<${component}`),
        `the page must render ${component}`
      );
    }
  });

  test("it borrows nothing from the Super Admin dashboard", () => {
    for (const owned of OWNER_SURFACES) {
      assert.ok(
        !usesIdentifier(pageCode, owned),
        `the manager page must not use ${owned}`
      );
    }
  });

  test("it links to nothing the role has lost", () => {
    for (const forbidden of FORBIDDEN_ROUTES) {
      assert.ok(
        !page.includes(forbidden),
        `the manager page must not link ${forbidden}`
      );
    }
  });

  test("it is a read surface: no mutation reaches it", () => {
    assert.doesNotMatch(pageCode, /"use server"/);
    assert.doesNotMatch(pageCode, /<form/);
    assert.doesNotMatch(pageCode, /action=/);
  });

  test("the KPI strip is rendered from the derived strip, not from ad-hoc props", () => {
    assert.match(pageCode, /buildManagerKpiStrip\(snapshot\)/);
    assert.match(pageCode, /kpis\.map/);
  });

  test("sign-out moved into the shell and is still an ordinary POST", () => {
    const topBar = read(MANAGER_TOP_BAR);
    assert.match(topBar, /method="post"/);
    assert.match(topBar, /action="\/auth\/signout"/);
  });

  test("the shell is the manager's own, with no owner nav model behind it", () => {
    const shell = code(read(MANAGER_SHELL));
    const sidebar = code(read(MANAGER_SIDEBAR));
    for (const owned of OWNER_SURFACES) {
      assert.ok(
        !usesIdentifier(shell, owned),
        `ManagerShell must not use ${owned}`
      );
      assert.ok(
        !usesIdentifier(sidebar, owned),
        `ManagerSidebar must not use ${owned}`
      );
    }
    assert.ok(!sidebar.includes("OpsNavFlags"), "no owner nav flags");
  });

  test("the page no longer claims the dashboard is unbuilt", () => {
    assert.doesNotMatch(page, /FOUNDATION, not a dashboard/i);
    assert.doesNotMatch(page, /is being designed/i);
    assert.doesNotMatch(page, /no metrics here/i);
  });
});

/* ========================================================================== */
/* 3. Four absences, kept apart                                                */
/* ========================================================================== */

describe("zero, no data, unavailable and not configured are four different things", () => {
  test("the strip is six cards", () => {
    assert.equal(buildManagerKpiStrip(snapshot()).length, 6);
  });

  test("a known zero renders as 0", () => {
    const strip = buildManagerKpiStrip(snapshot());
    const breaches = strip.find((kpi) => kpi.key === "sla_breaches");
    assert.equal(breaches?.state, "known");
    assert.equal(breaches?.value, 0);
    assert.equal(breaches?.display, "0");
  });

  test("a failed reporting read renders Unavailable, not 0", () => {
    const strip = buildManagerKpiStrip(
      snapshot({ crm: managerPanelUnavailable("down") })
    );
    const card = strip.find((kpi) => kpi.key === "new_this_month");
    assert.equal(card?.state, "unavailable");
    assert.equal(card?.value, null);
    assert.equal(card?.display, MANAGER_UNAVAILABLE_LABEL);
    assert.notEqual(card?.display, "0");
  });

  test("a failed analytics read renders Unavailable, not 0%", () => {
    const strip = buildManagerKpiStrip(
      snapshot({ management: managerPanelUnavailable("down") })
    );
    const card = strip.find((kpi) => kpi.key === "won_rate");
    assert.equal(card?.state, "unavailable");
    assert.equal(card?.display, MANAGER_UNAVAILABLE_LABEL);
    assert.notEqual(card?.display, "0%");
  });

  test("a rate with no denominator is No data, never 0%", () => {
    const strip = buildManagerKpiStrip(
      snapshot({
        management: managerPanelReady({
          ...MANAGEMENT_SECTION,
          wonRateBasisPoints: null,
        }),
      })
    );
    const card = strip.find((kpi) => kpi.key === "won_rate");
    assert.equal(card?.state, "no_data");
    assert.equal(card?.value, null);
    assert.equal(card?.display, MANAGER_NO_DATA_LABEL);
    assert.notEqual(card?.display, "0%");
  });

  test("a genuine zero rate still renders 0%", () => {
    const strip = buildManagerKpiStrip(
      snapshot({
        management: managerPanelReady({
          ...MANAGEMENT_SECTION,
          wonRateBasisPoints: 0,
        }),
      })
    );
    const card = strip.find((kpi) => kpi.key === "won_rate");
    assert.equal(card?.state, "known");
    assert.equal(card?.display, "0%");
  });

  test("unreadable money is Unavailable, and zero money is ₹0", () => {
    assert.equal(formatManagerPaise(null), MANAGER_UNAVAILABLE_LABEL);
    assert.notEqual(formatManagerPaise(null), formatManagerPaise(0));
  });

  test("an unreadable count is Unavailable, not 0", () => {
    assert.equal(formatManagerCount(null), MANAGER_UNAVAILABLE_LABEL);
    assert.equal(formatManagerCount(0), "0");
  });

  test("attainment with no denominator is No data, and real attainment is a percent", () => {
    assert.equal(formatManagerAttainment(null), MANAGER_NO_DATA_LABEL);
    assert.equal(formatManagerAttainment(0), "0%");
    assert.equal(formatManagerAttainment(7_500), "75%");
  });

  test("an absent target says Not configured on the card itself", () => {
    const card = read(MANAGER_TARGET_CARD);
    assert.match(card, /MANAGER_NOT_CONFIGURED_LABEL/);
    assert.equal(MANAGER_NOT_CONFIGURED_LABEL, "Not configured");
    assert.match(card, /formatManagerPaise\(target\.achievedPaise\)/);
  });

  test("no card is ever rendered through a zero fallback", () => {
    for (const rel of [
      MANAGER_METRIC_CARD,
      MANAGER_TARGET_CARD,
      MANAGER_WORKLOAD,
      MANAGER_PROJECTS,
    ]) {
      assert.doesNotMatch(code(read(rel)), /\?\?\s*0\b/, `${rel} must not coerce null to 0`);
    }
    assert.match(code(read(MANAGER_METRIC_CARD)), /\{kpi\.display\}/);
  });
});

/* ========================================================================== */
/* 4. Needs Attention                                                          */
/* ========================================================================== */

describe("the needs-attention queue is ordered, bounded and de-duplicated", () => {
  test("the priority order is SLA, overdue, unassigned, no next action, new", () => {
    assert.deepEqual(
      [...MANAGER_ATTENTION_PRIORITY],
      [
        "sla_breach",
        "overdue_follow_up",
        "unassigned",
        "no_next_action",
        "new_uncontacted",
      ]
    );
    assert.deepEqual([...MANAGER_ATTENTION_REASONS], [...MANAGER_ATTENTION_PRIORITY]);
  });

  test("rows come out worst-first regardless of the order they went in", () => {
    const queue = buildManagerAttentionQueue(
      myDay({
        summary: {
          overdue: 1,
          dueToday: 0,
          upcoming: 0,
          noNextAction: 1,
          newUncontacted: 1,
          unassigned: 1,
          slaBreaches: 1,
        },
        tasks: {
          overdue: [taskRow("a1", "lead-overdue", "2026-09-05T04:00:00.000Z")],
          dueToday: [],
          upcoming: [],
        },
        attention: {
          newUncontacted: [attentionRow("lead-new", "new_uncontacted")],
          noNextAction: [attentionRow("lead-nna", "no_next_action")],
          unassigned: [
            attentionRow("lead-unassigned", "unassigned", { assigneeLabel: null }),
          ],
          slaBreaches: [
            attentionRow("lead-sla", "sla_breach", {
              slaDueAt: "2026-09-04T04:00:00.000Z",
            }),
          ],
        },
      })
    );

    assert.deepEqual(
      queue.items.map((item) => item.reason),
      [
        "sla_breach",
        "overdue_follow_up",
        "unassigned",
        "no_next_action",
        "new_uncontacted",
      ]
    );
  });

  test("within a reason, the oldest problem comes first", () => {
    const queue = buildManagerAttentionQueue(
      myDay({
        summary: {
          overdue: 0,
          dueToday: 0,
          upcoming: 0,
          noNextAction: 0,
          newUncontacted: 2,
          unassigned: 0,
          slaBreaches: 0,
        },
        attention: {
          newUncontacted: [
            attentionRow("newer", "new_uncontacted", {
              receivedAt: "2026-09-05T00:00:00.000Z",
            }),
            attentionRow("older", "new_uncontacted", {
              receivedAt: "2026-09-01T00:00:00.000Z",
            }),
          ],
          noNextAction: [],
          unassigned: [],
          slaBreaches: [],
        },
      })
    );
    assert.deepEqual(
      queue.items.map((item) => item.leadId),
      ["older", "newer"]
    );
  });

  test("one lead qualifying twice appears once, at its worst reason", () => {
    const queue = buildManagerAttentionQueue(
      myDay({
        summary: {
          overdue: 0,
          dueToday: 0,
          upcoming: 0,
          noNextAction: 0,
          newUncontacted: 1,
          unassigned: 1,
          slaBreaches: 0,
        },
        attention: {
          newUncontacted: [attentionRow("lead-1", "new_uncontacted")],
          unassigned: [
            attentionRow("lead-1", "unassigned", { assigneeLabel: null }),
          ],
          noNextAction: [],
          slaBreaches: [],
        },
      })
    );
    assert.equal(queue.items.length, 1);
    assert.equal(queue.items[0]?.reason, "unassigned");
  });

  test("the rendered list is bounded but the count is not", () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      attentionRow(`lead-${index}`, "new_uncontacted")
    );
    const queue = buildManagerAttentionQueue(
      myDay({
        summary: {
          overdue: 0,
          dueToday: 0,
          upcoming: 0,
          noNextAction: 0,
          newUncontacted: 40,
          unassigned: 0,
          slaBreaches: 0,
        },
        attention: {
          newUncontacted: rows,
          noNextAction: [],
          unassigned: [],
          slaBreaches: [],
        },
      }),
      5
    );
    assert.equal(queue.items.length, 5);
    // The total is the read model's counter, not the length of a capped list.
    assert.equal(queue.total, 40);
  });

  test("an unassigned row says so rather than rendering an empty owner", () => {
    const queue = buildManagerAttentionQueue(
      myDay({
        summary: {
          overdue: 0,
          dueToday: 0,
          upcoming: 0,
          noNextAction: 0,
          newUncontacted: 0,
          unassigned: 1,
          slaBreaches: 0,
        },
        attention: {
          newUncontacted: [],
          noNextAction: [],
          unassigned: [
            attentionRow("lead-1", "unassigned", { assigneeLabel: null }),
          ],
          slaBreaches: [],
        },
      })
    );
    assert.equal(queue.items[0]?.assigneeLabel, null);
    assert.match(read(MANAGER_ATTENTION), /item\.assigneeLabel \?\? "Unassigned"/);
  });

  test("the queue carries no customer contact detail", () => {
    const queue = buildManagerAttentionQueue(
      myDay({
        summary: {
          overdue: 0,
          dueToday: 0,
          upcoming: 0,
          noNextAction: 0,
          newUncontacted: 1,
          unassigned: 0,
          slaBreaches: 0,
        },
        attention: {
          newUncontacted: [attentionRow("lead-1", "new_uncontacted")],
          noNextAction: [],
          unassigned: [],
          slaBreaches: [],
        },
      })
    );
    const serialised = JSON.stringify(queue.items[0]).toLowerCase();
    for (const forbidden of ["email", "phone", "mobile", "message", "whatsapp"]) {
      assert.ok(
        !serialised.includes(forbidden),
        `an attention row must not carry ${forbidden}`
      );
    }
  });

  test("the panel renders no contact detail either", () => {
    const panel = code(read(MANAGER_ATTENTION));
    for (const forbidden of [
      "submittedEmail",
      "contactEmail",
      "phone",
      "whatsapp",
      "messageBody",
    ]) {
      assert.ok(
        !panel.includes(forbidden),
        `the attention panel must not render ${forbidden}`
      );
    }
  });
});

/* ========================================================================== */
/* 5. Team workload is a distribution, not a scoreboard                        */
/* ========================================================================== */

describe("team workload counts work without ranking people", () => {
  const workload = buildManagerWorkload([
    { assigneeId: null, assigneeName: "Unassigned", leadCount: 7 },
    { assigneeId: "u2", assigneeName: "Zoya", leadCount: 9 },
    { assigneeId: "u1", assigneeName: "Asha", leadCount: 2 },
  ]);

  test("members are alphabetical, NOT ordered by volume", () => {
    assert.deepEqual(
      workload.members.map((row) => row.label),
      ["Asha", "Zoya"]
    );
  });

  test("unassigned is lifted out of the people list", () => {
    assert.equal(workload.unassigned?.leadCount, 7);
    assert.ok(
      workload.members.every((row) => row.assigneeId !== null),
      "unassigned must not be listed as a person"
    );
    assert.equal(workload.assignedTotal, 11);
  });

  test("no unassigned backlog means no row at all, not a zero row", () => {
    const clean = buildManagerWorkload([
      { assigneeId: "u1", assigneeName: "Asha", leadCount: 2 },
    ]);
    assert.equal(clean.unassigned, null);
  });

  test("the panel invents no performance metric", () => {
    const panel = code(read(MANAGER_WORKLOAD));
    for (const forbidden of [
      "conversionRate",
      "responseTime",
      "ranking",
      "topPerformer",
      "score",
      "productivity",
    ]) {
      assert.ok(
        !panel.includes(forbidden),
        `the workload panel must not compute ${forbidden}`
      );
    }
    assert.doesNotMatch(panel, /sort\(/);
  });
});

/* ========================================================================== */
/* 6. Project status is high level and bounded                                 */
/* ========================================================================== */

describe("the project panel shows status, not the project workspace", () => {
  test("rows are bounded and the total is still reported", () => {
    const projects = Array.from({ length: 14 }, (_, index) =>
      project(`p${index}`, {
        executionUpdatedAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      })
    );
    const section = buildManagerProjectRows(projects);
    assert.equal(section.rows.length, MANAGER_PROJECT_ROW_LIMIT);
    assert.ok(MANAGER_PROJECT_ROW_LIMIT >= 5 && MANAGER_PROJECT_ROW_LIMIT <= 8);
    assert.equal(section.totalCount, 14);
  });

  test("the most recently touched project is first", () => {
    const section = buildManagerProjectRows([
      project("old", { executionUpdatedAt: "2026-08-01T00:00:00.000Z" }),
      project("new", { executionUpdatedAt: "2026-09-05T00:00:00.000Z" }),
    ]);
    assert.equal(section.rows[0]?.projectId, "new");
  });

  test("the stage label reads the furthest-along fact and stops", () => {
    assert.equal(managerProjectStageLabel(project("a")), "Handover pending");
    assert.equal(
      managerProjectStageLabel(
        project("b", { handoverAcceptedAt: "2026-08-02T00:00:00.000Z" })
      ),
      "Handover accepted"
    );
    assert.match(
      managerProjectStageLabel(project("c", { designState: "in_progress" })),
      /^Design — /
    );
    assert.match(
      managerProjectStageLabel(project("d", { executionState: "in_progress" })),
      /^Execution — /
    );
    assert.equal(
      managerProjectStageLabel(
        project("e", { executionCompletedAt: "2026-09-01T00:00:00.000Z" })
      ),
      "Execution complete"
    );
  });

  test("no commercial or operational detail leaks into a row", () => {
    const section = buildManagerProjectRows([
      project("p1", { commercialGrandTotalPaise: 5_000_000 }),
    ]);
    const serialised = JSON.stringify(section.rows[0]);
    for (const forbidden of ["commercial", "quotation", "Paise", "evidence"]) {
      assert.ok(
        !serialised.includes(forbidden),
        `a project row must not carry ${forbidden}`
      );
    }
  });

  test("a project with no manager says so rather than showing a blank", () => {
    assert.match(read(MANAGER_PROJECTS), /row\.ownerLabel \?\? "Not assigned"/);
  });

  test("the read distinguishes an empty list from a failed read", () => {
    const queries = code(
      read("src/features/projects/server/project-high-level-queries.ts")
    );
    assert.match(queries, /readProjectHighLevelStatus/);
    assert.match(queries, /status: "unavailable"/);
  });
});

/* ========================================================================== */
/* 7. Navigation offers only what the role holds                               */
/* ========================================================================== */

describe("the manager's navigation is its own list", () => {
  test("it offers nothing the role has lost", () => {
    for (const item of MANAGER_NAV_ITEMS) {
      for (const forbidden of FORBIDDEN_ROUTES) {
        assert.notEqual(item.href, forbidden);
        assert.ok(!item.href.startsWith(`${forbidden}/`));
      }
    }
  });

  test("the dashboard itself is not offered as a quick action", () => {
    assert.ok(MANAGER_QUICK_ACTIONS.every((item) => item.href !== "/manager"));
    assert.equal(MANAGER_QUICK_ACTIONS.length, MANAGER_NAV_ITEMS.length - 1);
  });

  test("/manager is active only on /manager, and subtrees match their own root", () => {
    const dashboard = MANAGER_NAV_ITEMS[0]!;
    assert.equal(dashboard.href, "/manager");
    assert.ok(isManagerNavItemActive(dashboard, "/manager"));
    assert.ok(!isManagerNavItemActive(dashboard, "/admin/crm/leads"));

    const enquiries = MANAGER_NAV_ITEMS.find(
      (item) => item.href === "/admin/crm/leads"
    )!;
    assert.ok(isManagerNavItemActive(enquiries, "/admin/crm/leads/abc"));
    assert.ok(!isManagerNavItemActive(enquiries, "/admin/crm/reports"));
  });
});

/* ========================================================================== */
/* 8. This change added no authority                                           */
/* ========================================================================== */

describe("the dashboard was built without widening anything", () => {
  test("it adds no migration", () => {
    const migrations = readdirSync(join(root, "supabase/migrations"));
    for (const file of migrations) {
      assert.ok(
        !/dashboard/i.test(file),
        `${file} looks like a dashboard migration — this change adds none`
      );
    }
  });

  test("it adds no permission code", () => {
    const service = code(read(DASHBOARD_SERVICE));
    const contract = code(read(DASHBOARD_CONTRACT));
    for (const source of [service, contract]) {
      assert.doesNotMatch(source, /has_permission/);
      assert.doesNotMatch(source, /has_active_role/);
      assert.doesNotMatch(source, /grant\s+/i);
    }
  });

  test("the workspace gate is still the role, checked in the layout", () => {
    const layout = code(read("src/app/manager/layout.tsx"));
    assert.match(layout, /await requireSalesManager\(\)/);
  });
});
