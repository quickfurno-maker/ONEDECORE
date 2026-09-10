import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  resolveCrmDashboardWindows,
} from "../contracts/dashboard-summary-contracts.ts";
import { CRM_ACTIVITY_TYPES } from "../contracts/activity-contracts.ts";

/**
 * The Owner dashboard's task summary.
 *
 * The dashboard used to answer "Today's Appointments" — consultations and site
 * visits, the two activity types a CLIENT attends. That was right for the
 * label and wrong for an owner's day: a morning of calls, a quotation
 * follow-up and two internal tasks all showed as zero.
 *
 * The card now answers "Tasks & Follow-ups" over all six canonical activity
 * types, and these tests pin the two things that make the number trustworthy:
 * WHICH rows it counts, and WHEN the boundaries fall.
 *
 * THE PREDICATE IS THE CALENDAR'S, NOT MY DAY'S. "View All" opens the CRM
 * Calendar, and a summary that disagrees with the screen it opens is worse
 * than no summary — so this counts what the Calendar shows: open status,
 * `due_at` in the window, same owner scope, every activity type.
 *
 * My Day's `overdue` is deliberately a DIFFERENT number. It additionally
 * requires `is_primary_next_action` and a lead that is not closed, because it
 * answers "which commitments have I let slip on live leads" rather than "what
 * was scheduled and is now past". Both are correct. Collapsing them would make
 * one of the two surfaces lie, and neither definition was changed here.
 */

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");

function read(...segments: readonly string[]): string {
  return readFileSync(join(ROOT, ...segments), "utf8").replace(/\r\n/g, "\n");
}

/* Comments describe what these files refuse to do; assertions are about code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

function flat(source: string): string {
  return source.replace(/\s+/g, " ");
}

const CONTRACT = read(
  "src", "features", "crm", "contracts", "dashboard-summary-contracts.ts"
);

const QUERIES = read(
  "src", "features", "crm", "server", "crm-dashboard-summary-queries.ts"
);

const CALENDAR = read(
  "src", "features", "crm", "server", "crm-calendar-queries.ts"
);

const MY_DAY_SQL = read(
  "supabase", "migrations", "20260829120000_crm_my_day_read_model.sql"
);

/* ====================================================================== */
/* Windows                                                                */
/* ====================================================================== */

describe("every boundary comes from one captured instant", () => {
  test("today and tomorrow are adjacent IST days", () => {
    /* 2026-09-10T04:30:00Z is 10:00 IST on the 10th. */
    const windows = resolveCrmDashboardWindows(
      "2026-09-10T04:30:00.000Z"
    );

    assert.equal(windows.localDate, "2026-09-10");

    /* IST is +05:30, so a local day starts at 18:30Z the evening before. */
    assert.equal(windows.today.startIso, "2026-09-09T18:30:00.000Z");
    assert.equal(windows.today.endIso, "2026-09-10T18:30:00.000Z");

    /* Tomorrow begins exactly where today ends — no gap, no overlap. */
    assert.equal(windows.tomorrow.startIso, windows.today.endIso);
    assert.equal(windows.tomorrow.endIso, "2026-09-11T18:30:00.000Z");
  });

  test("a request just before IST midnight still describes that day", () => {
    /* 18:29:59Z is 23:59:59 IST on the 10th. */
    const windows = resolveCrmDashboardWindows(
      "2026-09-10T18:29:59.000Z"
    );

    assert.equal(windows.localDate, "2026-09-10");
    assert.equal(windows.tomorrow.startIso, "2026-09-10T18:30:00.000Z");

    /* One second later is the next IST day, and everything shifts together. */
    const after = resolveCrmDashboardWindows(
      "2026-09-10T18:30:00.000Z"
    );

    assert.equal(after.localDate, "2026-09-11");
    assert.equal(after.today.startIso, "2026-09-10T18:30:00.000Z");
  });

  test("the week starts Monday and ends before the next Monday", () => {
    /* 2026-09-10 is a Thursday. */
    const windows = resolveCrmDashboardWindows(
      "2026-09-10T04:30:00.000Z"
    );

    /* Monday 2026-09-07 IST. */
    assert.equal(windows.thisWeek.startIso, "2026-09-06T18:30:00.000Z");

    /* Monday 2026-09-14 IST — EXCLUDED, because the range is half-open. */
    assert.equal(windows.thisWeek.endIso, "2026-09-13T18:30:00.000Z");
  });

  test("Monday itself starts its own week, and Sunday closes it", () => {
    const monday = resolveCrmDashboardWindows(
      "2026-09-07T04:30:00.000Z"
    );

    assert.equal(monday.localDate, "2026-09-07");
    assert.equal(monday.thisWeek.startIso, monday.today.startIso);

    const sunday = resolveCrmDashboardWindows(
      "2026-09-13T04:30:00.000Z"
    );

    assert.equal(sunday.localDate, "2026-09-13");

    /* Sunday's day ends exactly when the week does. */
    assert.equal(sunday.today.endIso, sunday.thisWeek.endIso);
  });

  test("today and tomorrow both sit inside the week they belong to", () => {
    /* Thursday: today and tomorrow are both inside this week. */
    const windows = resolveCrmDashboardWindows(
      "2026-09-10T04:30:00.000Z"
    );

    assert.ok(
      windows.today.startIso >= windows.thisWeek.startIso &&
        windows.today.endIso <= windows.thisWeek.endIso
    );

    assert.ok(
      windows.tomorrow.endIso <= windows.thisWeek.endIso
    );

    /*
     * On Sunday, tomorrow is NEXT week — so `thisWeek` legitimately does not
     * contain it. The three numbers overlap; they are not nested by rule.
     */
    const sunday = resolveCrmDashboardWindows(
      "2026-09-13T04:30:00.000Z"
    );

    assert.ok(
      sunday.tomorrow.startIso >= sunday.thisWeek.endIso
    );
  });

  test("one clock read serves the whole summary", () => {
    const body = code(QUERIES);

    /* Exactly one `new Date()` in the file, and every window derives from it. */
    assert.equal(
      (body.match(/new Date\(\)/g) ?? []).length,
      1
    );

    assert.match(
      flat(body),
      /const capturedAt = new Date\(\)\.toISOString\(\); const windows = resolveCrmDashboardWindows\(capturedAt\);/
    );

    /* And the overdue cut is that same instant, not a second read. */
    assert.match(
      flat(body),
      /countOpenActivities\(null, capturedAt, taskScopeOwnerId, db\)/
    );
  });

  test("no date arithmetic happens in the query layer", () => {
    const body = code(QUERIES);

    for (const forbidden of [
      "setDate(",
      "getDay(",
      "86400000",
      "Asia/Kolkata",
      "toLocaleDateString",
    ]) {
      assert.ok(
        !body.includes(forbidden),
        `the query must not compute dates (${forbidden})`
      );
    }
  });
});

/* ====================================================================== */
/* Which rows count                                                       */
/* ====================================================================== */

describe("the count is the Calendar's population", () => {
  test("only open activities count", () => {
    const body = code(QUERIES);

    assert.match(
      flat(body),
      /\.from\("lead_follow_ups"\) \.select\("id", \{ count: "exact", head: true \}\) \.eq\("status", "open"\)/
    );

    /*
     * `.eq("status","open")` excludes completed and cancelled at the database
     * rather than filtering afterwards, so neither ever reaches a count.
     */
    const helper = body.slice(
      body.indexOf("async function countOpenActivities"),
      body.indexOf("async function countLeadsReceived")
    );

    assert.ok(!helper.includes('"completed"'));
    assert.ok(!helper.includes('"cancelled"'));
  });

  test("all six canonical activity types count", () => {
    /*
     * The appointment card filtered to two types. The task card must not
     * filter at all — a call, a WhatsApp, a quotation follow-up and an
     * internal task are all work the owner has to do.
     */
    assert.deepEqual(
      [...CRM_ACTIVITY_TYPES],
      [
        "call",
        "whatsapp",
        "consultation",
        "site_visit",
        "quotation_follow_up",
        "internal_task",
      ]
    );

    const helper = code(QUERIES).slice(
      code(QUERIES).indexOf("async function countOpenActivities"),
      code(QUERIES).indexOf("async function countLeadsReceived")
    );

    /* No type filter, and no second hard-coded list to drift from. */
    assert.ok(!helper.includes("activity_type"));
    assert.ok(!helper.includes("CRM_APPOINTMENT_ACTIVITY_TYPES"));
  });

  test("it does not inherit My Day's narrower predicate", () => {
    const helper = code(QUERIES).slice(
      code(QUERIES).indexOf("async function countOpenActivities"),
      code(QUERIES).indexOf("async function countLeadsReceived")
    );

    /*
     * My Day requires a PRIMARY next action on a live lead. That is the right
     * filter for "what have I let slip" and the wrong one for "what is on my
     * calendar" — a second scheduled call is still on the calendar.
     */
    assert.ok(!helper.includes("is_primary_next_action"));
    assert.ok(!helper.includes("closed_won"));

    /* And My Day's own definition is untouched. */
    assert.match(
      MY_DAY_SQL,
      /and f\.is_primary_next_action = true/
    );

    assert.match(
      MY_DAY_SQL,
      /when f\.due_at < v_now then 'overdue'/
    );
  });

  test("SLA breach is not a task count", () => {
    const body = code(QUERIES);

    /*
     * An SLA breach is an attention condition on a LEAD, not a scheduled
     * activity. My Day keeps the two apart and so does this.
     */
    assert.ok(!body.includes("sla"));
    assert.ok(!body.includes("Sla"));
    assert.ok(!body.includes("SLA"));

    /* My Day still reports it, in its own attention section. */
    assert.match(MY_DAY_SQL, /sla_breach/);
  });

  test("the scope rule is copied from the Calendar, not invented", () => {
    /* The Calendar's rule. */
    assert.match(
      flat(code(CALENDAR)),
      /const scopeOwnerId = context\.canReadBroad \? options\.ownerId \?\? null : context\.userId;/
    );

    /*
     * The dashboard takes no owner filter, so the equivalent is the Calendar's
     * unfiltered default: a broad reader sees the team, everyone else sees
     * only their own activities.
     */
    assert.match(
      flat(code(QUERIES)),
      /return context\.canReadBroad \? null : context\.userId;/
    );

    assert.match(
      code(QUERIES),
      /request = request\.eq\("owner_id", scopeOwnerId\)/
    );
  });

  test("overdue is unbounded below", () => {
    const helper = code(QUERIES).slice(
      code(QUERIES).indexOf("async function countOpenActivities"),
      code(QUERIES).indexOf("async function countLeadsReceived")
    );

    /*
     * An action scheduled last month and never closed is still overdue. A
     * lower bound would quietly stop reporting the most neglected work.
     */
    assert.match(
      flat(helper),
      /if \(beforeIso\) \{ request = request\.lt\("due_at", beforeIso\); \}/
    );

    assert.ok(!helper.includes('gte("due_at", beforeIso'));
  });
});

/* ====================================================================== */
/* Cost and safety                                                        */
/* ====================================================================== */

describe("the summary stays cheap and caller-scoped", () => {
  test("every task count is a head-only count", () => {
    const helper = code(QUERIES).slice(
      code(QUERIES).indexOf("async function countOpenActivities"),
      code(QUERIES).indexOf("async function countLeadsReceived")
    );

    assert.match(helper, /count: "exact", head: true/);

    /* No activity row is selected, so none crosses the wire. */
    assert.ok(!helper.includes("due_at, title"));
    assert.ok(!helper.includes("leads!"));
  });

  test("the four counts run concurrently with the rest", () => {
    const body = flat(code(QUERIES));

    assert.match(body, /await Promise\.all\(\[/);

    for (const call of [
      "countOpenActivities(windows.today, null, taskScopeOwnerId, db)",
      "countOpenActivities(windows.tomorrow, null, taskScopeOwnerId, db)",
      "countOpenActivities(windows.thisWeek, null, taskScopeOwnerId, db)",
      "countOpenActivities(null, capturedAt, taskScopeOwnerId, db)",
    ]) {
      assert.ok(body.includes(call), call);
    }
  });

  test("there is no service-role path and no write", () => {
    const body = code(QUERIES);

    for (const forbidden of [
      "service_role",
      "SERVICE_ROLE",
      "serviceRole",
      ".insert(",
      ".update(",
      ".delete(",
      ".upsert(",
      ".rpc(",
    ]) {
      assert.ok(
        !body.includes(forbidden),
        `the summary must not ${forbidden}`
      );
    }

    /* It runs as the caller, like every other CRM read. */
    assert.match(body, /resolveCrmDb\(db\)/);
  });
});

/* ====================================================================== */
/* The contract                                                           */
/* ====================================================================== */

describe("the response gains tasks without losing anything", () => {
  test("tasks carries exactly the four public counts", () => {
    assert.match(
      flat(code(CONTRACT)),
      /export interface CrmDashboardTaskCounts \{ readonly today: number; readonly tomorrow: number; readonly thisWeek: number; readonly overdue: number; \}/
    );
  });

  test("the summary still carries leads and appointments", () => {
    const body = flat(code(CONTRACT));

    assert.match(
      body,
      /export interface CrmDashboardSummary \{ readonly capturedAt: string; readonly localDate: string; readonly leads: CrmDashboardLeadCounts; readonly appointments: CrmDashboardAppointments; readonly tasks: CrmDashboardTaskCounts; \}/
    );

    /*
     * ADDITIVE on purpose. Removing `appointments` would break the shipped
     * Android build in the field rather than at review; it goes when every
     * tracked consumer has moved, as its own change.
     */
    assert.match(
      CONTRACT,
      /kept for compatibility/
    );
  });

  test("the lead counts are untouched", () => {
    assert.match(
      flat(code(CONTRACT)),
      /export interface CrmDashboardLeadCounts \{ readonly today: number; readonly thisWeek: number; readonly thisMonth: number; \}/
    );

    assert.match(
      flat(code(QUERIES)),
      /leads: \{ today: todayCount, thisWeek: weekCount, thisMonth: monthCount, \}/
    );
  });

  test("no migration is implied", () => {
    const body = code(QUERIES);

    /* Everything comes from the table the Calendar already reads. */
    assert.match(body, /\.from\("lead_follow_ups"\)/);

    for (const invented of [
      "task_summary",
      "dashboard_counts",
      "materialized",
    ]) {
      assert.ok(!body.includes(invented));
    }
  });
});
