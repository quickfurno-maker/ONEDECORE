import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  CRM_APPOINTMENT_ACTIVITY_TYPES,
  CRM_APPOINTMENT_LABELS,
  isAppointmentActivityType,
  resolveCrmDashboardWindows,
} from "../contracts/dashboard-summary-contracts.ts";

/**
 * The Owner dashboard's CRM summary.
 *
 * "This week" is the kind of fact that looks trivial and is not. It needs the
 * Asia/Kolkata offset, a Monday convention and a half-open bound, and a second
 * implementation on a phone would drift from this one the first time any of the
 * three was written slightly differently — silently, because both numbers would
 * look plausible.
 *
 * So the boundary maths is tested here, by behaviour rather than by shape: real
 * instants in, real ISO bounds out, including the three places this kind of code
 * actually breaks — midnight IST, the Sunday/Monday seam, and December.
 */

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");

function read(...segments: readonly string[]): string {
  return readFileSync(join(ROOT, ...segments), "utf8");
}

/* Comments explain what these files refuse to do; assertions are about code. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

const ROUTE = read(
  "src", "app", "api", "mobile", "crm", "dashboard-summary", "route.ts"
);

const QUERIES = read(
  "src", "features", "crm", "server", "crm-dashboard-summary-queries.ts"
);

const CONTRACTS = read(
  "src", "features", "crm", "contracts", "dashboard-summary-contracts.ts"
);

const MOBILE_AUTH = read(
  "src", "features", "crm", "server", "crm-mobile-auth.ts"
);

describe("the endpoint is authenticated and read-only", () => {
  test("it reuses the CRM-M1 bearer auth unchanged", () => {
    assert.match(ROUTE, /resolveCrmMobileAuth/);
    assert.match(ROUTE, /crmMobileAuthError/);

    /* It supplies the caller; it does not assemble its own access context. */
    assert.ok(
      !code(ROUTE).includes("canReadBroad:"),
      "the route must not build its own CrmAccessContext"
    );
  });

  test("an unauthenticated or unentitled caller never reaches a query", () => {
    const body = code(ROUTE);

    const authAt = body.indexOf("resolveCrmMobileAuth");
    const guardAt = body.indexOf('auth.kind !== "granted"');
    const queryAt = body.indexOf("await fetchCrmDashboardSummary(");

    assert.ok(authAt >= 0, "must resolve auth");
    assert.ok(guardAt > authAt, "must guard before querying");
    assert.ok(queryAt > guardAt, "must query only after the guard");
  });

  test("it runs as the caller, so RLS scopes every count", () => {
    assert.match(ROUTE, /auth\.db/);
    assert.match(QUERIES, /resolveCrmDb\(db\)/);

    assert.ok(
      !code(QUERIES).includes("await createClient()"),
      "the summary must not bypass the resolver"
    );
  });

  test("it exposes GET only and writes nothing", () => {
    assert.match(ROUTE, /export async function GET/);

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.ok(
        !new RegExp(`export async function ${method}\\b`).test(ROUTE),
        `must not expose ${method}`
      );
    }

    for (const write of [".insert(", ".update(", ".delete(", ".upsert("]) {
      assert.ok(
        !code(QUERIES).includes(write),
        `the summary must not ${write}`
      );
    }
  });

  test("no service-role or admin path exists", () => {
    for (const [name, source] of [
      ["route", ROUTE],
      ["queries", QUERIES],
      ["contracts", CONTRACTS],
    ] as const) {
      for (const forbidden of [
        "service-role",
        "serviceRole",
        "SERVICE_ROLE",
        "createAdminClient",
        "sb_secret_",
      ]) {
        assert.ok(
          !code(source).includes(forbidden),
          `${name} must not reference ${forbidden}`
        );
      }
    }
  });

  test("failures answer a category, not a server message", () => {
    const body = code(ROUTE);

    assert.ok(body.includes("crmMobileError"));

    assert.ok(
      !/return[^;]*error\.message/.test(body),
      "must not return a raw error message"
    );

    assert.ok(!body.includes("error.stack"));
  });
});

describe("received-lead windows are canonical", () => {
  /*
   * 2026-09-05 is a Friday. 08:30Z is 14:00 IST, comfortably mid-day, so the
   * local date is unambiguous.
   */
  const FRIDAY = "2026-09-05T08:30:00.000Z";

  test("the local date is the Asia/Kolkata one", () => {
    const windows = resolveCrmDashboardWindows(FRIDAY);

    assert.equal(windows.localDate, "2026-09-05");
  });

  test("today is half-open from IST midnight to IST midnight", () => {
    const { today } = resolveCrmDashboardWindows(FRIDAY);

    /* IST midnight is 18:30Z the previous day. */
    assert.equal(today.startIso, "2026-09-04T18:30:00.000Z");
    assert.equal(today.endIso, "2026-09-05T18:30:00.000Z");
  });

  /*
   * The boundary case that catches an off-by-one. An instant at exactly IST
   * midnight belongs to the NEW day: `start` is inclusive, `end` exclusive, so
   * every lead lands in exactly one day.
   */
  test("IST midnight belongs to the new day, and to only one day", () => {
    const midnightIst = "2026-09-04T18:30:00.000Z";

    const windows = resolveCrmDashboardWindows(midnightIst);

    assert.equal(windows.localDate, "2026-09-05");
    assert.equal(windows.today.startIso, midnightIst);

    /* The previous day's window ends exactly where this one starts. */
    const previous = resolveCrmDashboardWindows(
      "2026-09-04T18:29:59.999Z"
    );

    assert.equal(previous.localDate, "2026-09-04");
    assert.equal(previous.today.endIso, windows.today.startIso);
  });

  test("the week starts Monday and runs seven days", () => {
    const { thisWeek } = resolveCrmDashboardWindows(FRIDAY);

    /* Monday 2026-08-31 at IST midnight = 2026-08-30T18:30:00Z. */
    assert.equal(thisWeek.startIso, "2026-08-30T18:30:00.000Z");
    assert.equal(thisWeek.endIso, "2026-09-06T18:30:00.000Z");

    const spanDays =
      (Date.parse(thisWeek.endIso) - Date.parse(thisWeek.startIso)) /
      86_400_000;

    assert.equal(spanDays, 7);
  });

  /*
   * The seam a Sunday-start convention gets wrong. On Sunday the week must
   * still be the one that began the PREVIOUS Monday, and Monday must open a
   * new one.
   */
  test("Sunday closes the week and Monday opens the next", () => {
    /* 2026-09-06 is a Sunday; 08:30Z is 14:00 IST. */
    const sunday = resolveCrmDashboardWindows("2026-09-06T08:30:00.000Z");

    assert.equal(sunday.localDate, "2026-09-06");
    assert.equal(sunday.thisWeek.startIso, "2026-08-30T18:30:00.000Z");

    /* 2026-09-07 is the Monday after. */
    const monday = resolveCrmDashboardWindows("2026-09-07T08:30:00.000Z");

    assert.equal(monday.localDate, "2026-09-07");
    assert.equal(monday.thisWeek.startIso, sunday.thisWeek.endIso);
  });

  test("the month runs from the first to the first", () => {
    const { thisMonth } = resolveCrmDashboardWindows(FRIDAY);

    assert.equal(thisMonth.startIso, "2026-08-31T18:30:00.000Z");
    assert.equal(thisMonth.endIso, "2026-09-30T18:30:00.000Z");
  });

  /* December is where a naive month+1 produces month 13. */
  test("December rolls into January of the next year", () => {
    const december = resolveCrmDashboardWindows("2026-12-20T08:30:00.000Z");

    assert.equal(december.localDate, "2026-12-20");
    assert.equal(december.thisMonth.startIso, "2026-11-30T18:30:00.000Z");
    assert.equal(december.thisMonth.endIso, "2026-12-31T18:30:00.000Z");
  });

  test("every window is resolved from ONE instant", () => {
    /*
     * A summary whose windows came from separate `Date.now()` calls could
     * report a "today" and a "this week" that disagreed about the date.
     */
    assert.match(
      code(QUERIES),
      /const capturedAt = new Date\(\)\.toISOString\(\);\s*const windows = resolveCrmDashboardWindows\(capturedAt\)/
    );
  });
});

describe("the counts are bounded and use created_at", () => {
  test("received leads are counted on created_at, never updated_at", () => {
    const body = code(QUERIES);

    assert.match(body, /\.gte\("created_at", window\.startIso\)/);
    assert.match(body, /\.lt\("created_at", window\.endIso\)/);

    assert.ok(
      !body.includes("updated_at"),
      "a lead must not move into today because somebody edited it today"
    );
  });

  test("the bounds are half-open: gte start, lt end", () => {
    const body = code(QUERIES);

    assert.ok(!body.includes(".lte(\"created_at\""));
    assert.ok(!body.includes(".lte(\"due_at\""));
  });

  test("counts are head-only, so no lead rows cross the wire", () => {
    const body = code(QUERIES);

    /*
     * Two head-count SITES: one shared lead-window helper, invoked once per
     * window, and one inline appointment total. Four counts, two places.
     */
    const headCounts = body.match(/count: "exact", head: true/g) ?? [];

    assert.equal(headCounts.length, 2);

    const invocations = body.match(/countLeadsReceived\(windows\./g) ?? [];

    assert.equal(invocations.length, 3);

    /* And no select of lead rows anywhere in the summary. */
    assert.ok(
      !/from\("leads"\)\s*\.select\("[^"]*,/.test(body),
      "the summary must not select lead columns"
    );
  });

  test("no cohort is fetched and counted", () => {
    const body = code(QUERIES);

    for (const forbidden of [
      "queryLeadListPage",
      "readCohortRows",
      "prepareLeadListFilters",
      "fetchLeadScoreBatch",
      "CRM_LEAD_COHORT_MAX_ROWS",
      ".range(",
    ]) {
      assert.ok(
        !body.includes(forbidden),
        `the summary must not use ${forbidden}`
      );
    }
  });

  test("the appointment scan is capped, and the headline count is not", () => {
    const body = code(QUERIES);

    assert.match(body, /\.limit\(APPOINTMENT_SCAN_LIMIT\)/);

    /*
     * `totalToday` comes from its own exact count rather than the capped list,
     * so the number an owner reads stays true even at the ceiling.
     */
    assert.match(body, /totalToday: totalTodayResult\.count \?\? 0/);

    assert.ok(
      !body.includes("totalToday: rows.length"),
      "the headline count must not come from the capped scan"
    );
  });
});

describe("appointments are canonically classified", () => {
  test("only consultations and site visits count", () => {
    assert.deepEqual(
      [...CRM_APPOINTMENT_ACTIVITY_TYPES],
      ["consultation", "site_visit"]
    );

    assert.ok(isAppointmentActivityType("consultation"));
    assert.ok(isAppointmentActivityType("site_visit"));
  });

  /*
   * The exclusions are the point. A call and a WhatsApp message are outreach
   * the owner controls; a quotation follow-up is a task about a document; an
   * internal task involves no client. Counting any of them would inflate the
   * number an owner plans their day around.
   */
  test("outreach and internal work are not appointments", () => {
    for (const activityType of [
      "call",
      "whatsapp",
      "quotation_follow_up",
      "internal_task",
    ]) {
      assert.ok(
        !isAppointmentActivityType(activityType),
        `${activityType} must not count as an appointment`
      );
    }
  });

  test("both types carry an owner-facing label", () => {
    for (const activityType of CRM_APPOINTMENT_ACTIVITY_TYPES) {
      assert.ok(CRM_APPOINTMENT_LABELS[activityType]);
    }

    /* Resolved server-side, so the phone never maps a code to a word. */
    assert.match(QUERIES, /activityLabel: CRM_APPOINTMENT_LABELS\[nextType\]/);
  });

  test("the query filters to those types and excludes cancelled", () => {
    const body = code(QUERIES);

    assert.match(body, /\.in\("activity_type", appointmentTypes\)/);
    assert.match(body, /\.neq\("status", "cancelled"\)/);
  });

  test("upcoming and pending are split server-side at capturedAt", () => {
    const body = code(QUERIES);

    assert.match(body, /const nowMs = Date\.parse\(capturedAt\)/);
    assert.match(body, /Date\.parse\(row\.due_at\) >= nowMs/);
    assert.match(body, /Date\.parse\(row\.due_at\) < nowMs/);

    /* Only OPEN appointments split; a completed one is neither. */
    assert.match(body, /rows\.filter\(\(row\) => row\.status === "open"\)/);
  });

  test("next is the earliest upcoming one, taken from server ordering", () => {
    const body = code(QUERIES);

    assert.match(body, /\.order\("due_at", \{ ascending: true \}\)/);
    assert.match(body, /const nextRow = upcoming\[0\] \?\? null/);
  });

  test("a day with nothing left returns a null next", () => {
    assert.match(QUERIES, /next:\s*nextRow && nextType\s*\?/);
  });
});

describe("no invented data", () => {
  /*
   * The mockup showed "+20% vs yesterday". Nothing canonical returns
   * period-over-period comparisons, so the field does not exist rather than
   * being computed from two numbers that were never meant to be compared.
   */
  test("no trend or comparison field is fabricated", () => {
    for (const [name, source] of [
      ["contracts", CONTRACTS],
      ["queries", QUERIES],
    ] as const) {
      for (const forbidden of [
        "comparison",
        "Pct",
        "percent",
        "trend",
        "vsYesterday",
        "vsLastWeek",
      ]) {
        assert.ok(
          !code(source).includes(forbidden),
          `${name} must not fabricate ${forbidden}`
        );
      }
    }
  });

  test("the response carries only what was measured", () => {
    const body = code(CONTRACTS);

    assert.match(body, /interface CrmDashboardSummary/);
    assert.match(body, /readonly capturedAt: string/);
    assert.match(body, /readonly localDate: string/);
    assert.match(body, /readonly leads: CrmDashboardLeadCounts/);
    assert.match(body, /readonly appointments: CrmDashboardAppointments/);
  });
});

describe("the boundary maths is not duplicated", () => {
  /*
   * The windows compose the calendar contract the CRM already scans sales weeks
   * with. A second offset constant here is how the dashboard and the calendar
   * would start disagreeing about which week it is.
   */
  test("windows compose the canonical calendar helpers", () => {
    const body = code(CONTRACTS);

    for (const helper of [
      "calendarLocalDate",
      "calendarLocalDayStartUtc",
      "calendarStartOfWeek",
      "calendarStartOfMonth",
      "addCalendarDays",
    ]) {
      assert.ok(body.includes(helper), `windows must use ${helper}`);
    }
  });

  test("no timezone offset or day length is restated", () => {
    for (const [name, source] of [
      ["contracts", CONTRACTS],
      ["queries", QUERIES],
      ["route", ROUTE],
    ] as const) {
      for (const forbidden of [
        "330",
        "19800",
        "86400000",
        "86_400_000",
        "Asia/Kolkata",
        "+05:30",
        "getTimezoneOffset",
      ]) {
        assert.ok(
          !code(source).includes(forbidden),
          `${name} must not restate ${forbidden}`
        );
      }
    }
  });
});

describe("the existing mobile endpoints are untouched", () => {
  test("the shared error envelope still carries every category", () => {
    for (const category of [
      "unauthenticated",
      "forbidden",
      "invalid_request",
      "not_found",
      "conflict",
      "unavailable",
    ]) {
      assert.ok(
        MOBILE_AUTH.includes(category),
        `missing error category ${category}`
      );
    }
  });

  test("the leads and pipeline routes are unchanged in shape", () => {
    assert.match(
      read("src", "app", "api", "mobile", "crm", "leads", "route.ts"),
      /queryLeadListPage/
    );

    assert.match(
      read("src", "app", "api", "mobile", "crm", "pipeline", "route.ts"),
      /fetchCrmPipelineBoard/
    );
  });
});
