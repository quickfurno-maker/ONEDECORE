import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  CRM_CALENDAR_DEFAULT_VIEW,
  CRM_CALENDAR_EVENT_LIMIT,
  CRM_CALENDAR_VIEWS,
  addCalendarDays,
  calendarLocalDayStartUtc,
  calendarWeekdayIndex,
  isCalendarLocalDate,
  parseCalendarAnchorDate,
  parseCalendarView,
  resolveCalendarRange,
} from "../contracts/calendar-contracts.ts";
import { parseMyDayOwnerFilter } from "../contracts/my-day-contracts.ts";

/**
 * The Owner mobile app's CRM calendar endpoint.
 *
 * The mobile phase audited whether Android could read `lead_follow_ups`
 * directly and concluded it could not — not because the rows are unreachable,
 * but because THREE facts wrapped around them are server-owned: the Day/Week/
 * Month range, the `canReadBroad` scope, and the server's own "today". A phone
 * reproducing any of them would be right most days and quietly wrong on the
 * ones that matter.
 *
 * So this route exists to own none of them. These tests prove that twice over:
 * by behaviour, against the canonical pure contract functions the route
 * delegates to, and by shape, against the route and query source — because the
 * failure mode being guarded here is not a wrong answer, it is a SECOND answer.
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
  "src", "app", "api", "mobile", "crm", "calendar", "route.ts"
);

const QUERIES = read(
  "src", "features", "crm", "server", "crm-calendar-queries.ts"
);

const CONTRACTS = read(
  "src", "features", "crm", "contracts", "calendar-contracts.ts"
);

const PAGE = read(
  "src", "app", "admin", "crm", "calendar", "page.tsx"
);

const MOBILE_AUTH = read(
  "src", "features", "crm", "server", "crm-mobile-auth.ts"
);

/* ========================================================================== */
/* Route auth                                                                 */
/* ========================================================================== */

describe("the endpoint is authenticated, caller-scoped and read-only", () => {
  test("it reuses the CRM-M1 bearer auth unchanged", () => {
    assert.match(ROUTE, /resolveCrmMobileAuth\(request\)/);
    assert.match(ROUTE, /crmMobileAuthError\(auth\.kind\)/);

    /* It supplies the caller; it does not assemble its own access context. */
    assert.ok(
      !code(ROUTE).includes("canReadBroad"),
      "the route must not build or read its own access decision"
    );
  });

  test("a missing or invalid bearer answers 401 without reaching a query", () => {
    const body = code(ROUTE);

    const authAt = body.indexOf("resolveCrmMobileAuth");
    const guardAt = body.indexOf('auth.kind !== "granted"');
    const queryAt = body.indexOf("await fetchCrmCalendarSnapshot(");

    assert.ok(authAt >= 0, "must resolve auth");
    assert.ok(guardAt > authAt, "must guard before querying");
    assert.ok(queryAt > guardAt, "must query only after the guard");

    /*
     * Both cases resolve to `unauthenticated` in the shared resolver: no token
     * at all, and a token the auth server refuses to verify.
     */
    assert.match(MOBILE_AUTH, /if \(!token\) \{/);
    assert.match(MOBILE_AUTH, /if \(error \|\| !data\.user\) \{/);
    assert.match(MOBILE_AUTH, /unauthenticated: 401/);
  });

  test("an authenticated but unentitled caller answers 403", () => {
    assert.match(MOBILE_AUTH, /forbidden: 403/);

    /* `inactive` and `denied` both answer forbidden, and neither says why. */
    assert.ok(
      !code(ROUTE).includes("inactive") && !code(ROUTE).includes("denied"),
      "the route must not re-map auth outcomes"
    );
  });

  test("the caller's own client reaches the calendar query", () => {
    assert.match(
      code(ROUTE),
      /fetchCrmCalendarSnapshot\(\s*auth\.context,\s*\{ view, anchorDate, ownerId \},\s*auth\.db\s*\)/
    );

    assert.match(QUERIES, /resolveCrmDb\(db\)/);

    assert.ok(
      !QUERIES.includes("await createClient()"),
      "the calendar read must not create its own client"
    );
  });

  test("the injected client is optional, so the browser page is unaffected", () => {
    assert.ok(
      QUERIES.includes("db?: CrmDb"),
      "the calendar read must take an OPTIONAL client"
    );

    assert.ok(
      !/db:\s*CrmDb[,)]/.test(QUERIES),
      "the calendar read must not require a client"
    );
  });

  test("the directory lookup runs as the same caller", () => {
    /*
     * Forwarding `db` is not cosmetic: without it the owner-label lookup would
     * fall back to a cookie client that does not exist on a mobile request.
     */
    assert.match(QUERIES, /fetchCrmAssigneeDirectory\(context, db\)/);
  });

  test("no browser-only auth path is required", () => {
    const body = code(ROUTE);

    for (const browserOnly of [
      "requireCrmReadAccess",
      "createClient",
      "cookies",
      "next/headers",
    ]) {
      assert.ok(
        !body.includes(browserOnly),
        `the mobile route must not depend on ${browserOnly}`
      );
    }
  });

  test("no service-role or admin path exists", () => {
    for (const [name, source] of [
      ["route", ROUTE],
      ["queries", QUERIES],
    ] as const) {
      for (const forbidden of [
        "service_role",
        "SERVICE_ROLE",
        "SUPABASE_SERVICE",
        "serviceRole",
        "admin_secret",
        "ADMIN_SECRET",
      ]) {
        assert.ok(
          !source.includes(forbidden),
          `${name} must not reference ${forbidden}`
        );
      }
    }
  });

  test("the bearer token is never logged or put in a URL", () => {
    const body = code(ROUTE);

    assert.ok(!body.includes("token"), "the route must not handle the token");

    /* The only log is a category-tagged error, with no request or headers. */
    assert.match(body, /console\.error\("\[mobile\/crm\/calendar\]", error\)/);
    assert.ok(
      !/console\.(log|info|warn)/.test(body),
      "no incidental logging"
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

    for (const [name, source] of [
      ["route", code(ROUTE)],
      ["queries", code(QUERIES)],
    ] as const) {
      for (const write of [".insert(", ".update(", ".delete(", ".upsert("]) {
        assert.ok(
          !source.includes(write),
          `${name} must not ${write}`
        );
      }
    }
  });

  test("failures answer a category, not a server message", () => {
    const body = code(ROUTE);

    assert.match(body, /crmMobileError\(\s*"unavailable"/);

    assert.ok(
      !body.includes("error.message"),
      "must not return a database message"
    );

    assert.ok(
      !body.includes("error.stack"),
      "must not return a stack trace"
    );
  });
});

/* ========================================================================== */
/* Query parameters                                                           */
/* ========================================================================== */

describe("the query parameters are parsed canonically", () => {
  test("the three canonical views are the only ones", () => {
    assert.deepEqual([...CRM_CALENDAR_VIEWS], ["day", "week", "month"]);

    for (const view of CRM_CALENDAR_VIEWS) {
      assert.equal(parseCalendarView(view), view);
    }
  });

  test("an omitted view takes the canonical default", () => {
    assert.equal(CRM_CALENDAR_DEFAULT_VIEW, "week");
    assert.equal(parseCalendarView(undefined), CRM_CALENDAR_DEFAULT_VIEW);
  });

  test("a view the canonical vocabulary does not admit is refused, not defaulted", () => {
    /*
     * The canonical parser substitutes the default, which is right for a URL a
     * human typed and wrong for a client that asked for something specific: the
     * phone would render a week and label it a quarter.
     */
    assert.equal(parseCalendarView("quarter"), CRM_CALENDAR_DEFAULT_VIEW);

    const body = code(ROUTE);
    assert.match(
      body,
      /rawView !== null &&\s*!\(CRM_CALENDAR_VIEWS as readonly string\[\]\)\.includes\(rawView\)/
    );
    assert.match(body, /crmMobileError\(\s*"invalid_request"/);
  });

  test("the date is parsed by the canonical anchor parser", () => {
    assert.match(code(ROUTE), /parseCalendarAnchorDate\(rawDate \?\? undefined\)/);
    assert.equal(parseCalendarAnchorDate("2026-09-05"), "2026-09-05");
  });

  test("an omitted date anchors on the Asia/Kolkata day, not the UTC one", () => {
    /* 20:00Z on 5 Sep is already 01:30 on 6 Sep in IST. */
    assert.equal(
      parseCalendarAnchorDate(undefined, Date.parse("2026-09-05T20:00:00.000Z")),
      "2026-09-06"
    );
  });

  test("an unparseable date is refused rather than silently replaced by today", () => {
    assert.equal(isCalendarLocalDate("2026-02-31"), false);
    assert.equal(isCalendarLocalDate("05-09-2026"), false);
    assert.equal(isCalendarLocalDate("2026-09-05"), true);

    assert.match(
      code(ROUTE),
      /rawDate !== null && !isCalendarLocalDate\(rawDate\.trim\(\)\)/
    );
  });

  test("the owner filter is optional and canonical", () => {
    assert.equal(parseMyDayOwnerFilter(undefined), null);
    assert.equal(parseMyDayOwnerFilter("team"), null);
    assert.equal(parseMyDayOwnerFilter(""), null);

    const uuid = "3f1a5c7e-9b2d-4e11-8a76-0c4d2b8e5f31";
    assert.equal(parseMyDayOwnerFilter(uuid), uuid);

    assert.match(code(ROUTE), /parseMyDayOwnerFilter\(rawOwner \?\? undefined\)/);
  });

  test("an unparseable owner is refused, because falling back would widen it", () => {
    /*
     * The canonical parser answers null — team scope — for a value it cannot
     * read. Honouring that here would return MORE than the caller asked for, so
     * the route refuses in the safe direction instead.
     */
    assert.equal(parseMyDayOwnerFilter("not-a-uuid"), null);

    const body = code(ROUTE);
    assert.match(body, /rawOwner !== null &&\s*ownerId === null/);
    assert.match(body, /rawOwner\.trim\(\) !== "team"/);
  });

  test("the route never maps a string onto a view, date or owner itself", () => {
    const body = code(ROUTE);

    /* Every interpretation is a canonical import, not a local re-spelling. */
    for (const canonical of [
      "parseCalendarView",
      "parseCalendarAnchorDate",
      "parseMyDayOwnerFilter",
      "isCalendarLocalDate",
      "CRM_CALENDAR_VIEWS",
    ]) {
      assert.ok(body.includes(canonical), `must use ${canonical}`);
    }

    assert.ok(
      !/"(day|week|month)"/.test(body),
      "the route must not spell a view code of its own"
    );

    assert.ok(
      !/\d{4}-\d{2}-\d{2}/.test(body) &&
        !body.includes("330") &&
        !body.includes("05:30"),
      "the route must not restate a date or an offset"
    );
  });
});

/* ========================================================================== */
/* Range — the canonical helper is the only authority                          */
/* ========================================================================== */

describe("the range comes from the canonical helper and passes through whole", () => {
  test("the route returns the snapshot verbatim", () => {
    const body = code(ROUTE);

    assert.match(body, /return NextResponse\.json\(snapshot\)/);

    /* No re-shaping, no mobile-only aliases, no added fields. */
    for (const invented of [
      "events:",
      "range:",
      "truncated:",
      "todayLocalDate",
      "scopeOwnerId",
      "isTeamScope",
    ]) {
      assert.ok(
        !body.includes(invented),
        `the route must not restate ${invented}`
      );
    }
  });

  test("the route computes no boundary of its own", () => {
    const body = code(ROUTE);

    for (const boundary of [
      "resolveCalendarRange",
      "startUtc",
      "endUtc",
      "startOfWeek",
      "startOfMonth",
      "getUTCDay",
      "86400",
      "Date.UTC",
    ]) {
      assert.ok(
        !body.includes(boundary),
        `the route must not compute ${boundary}`
      );
    }

    assert.match(
      QUERIES,
      /resolveCalendarRange\(\s*options\.view,\s*options\.anchorDate\s*\)/
    );
  });

  test("a day range is exactly one Asia/Kolkata day, half-open", () => {
    const range = resolveCalendarRange("day", "2026-09-05");

    assert.equal(range.periodStartDate, "2026-09-05");
    assert.equal(range.periodEndDate, "2026-09-05");
    assert.deepEqual([...range.days], ["2026-09-05"]);

    /* IST midnight is 18:30Z the previous day. */
    assert.equal(range.startUtc, "2026-09-04T18:30:00.000Z");
    assert.equal(range.endUtc, "2026-09-05T18:30:00.000Z");
  });

  test("a week range starts Monday and runs seven days", () => {
    const range = resolveCalendarRange("week", "2026-09-05");

    assert.equal(calendarWeekdayIndex(range.periodStartDate), 0);
    assert.equal(range.days.length, 7);
    assert.equal(
      range.periodEndDate,
      addCalendarDays(range.periodStartDate, 6)
    );
    assert.equal(range.visibleStartDate, range.periodStartDate);
    assert.equal(range.visibleEndDate, range.periodEndDate);
  });

  test("a month range overshoots to whole Monday-start weeks, and the fetch follows it", () => {
    const range = resolveCalendarRange("month", "2026-09-05");

    assert.equal(range.periodStartDate, "2026-09-01");
    assert.equal(range.periodEndDate, "2026-09-30");

    /* The grid renders whole weeks, so the FETCH must cover the whole grid. */
    assert.equal(calendarWeekdayIndex(range.visibleStartDate), 0);
    assert.equal(calendarWeekdayIndex(range.visibleEndDate), 6);
    assert.ok(range.visibleStartDate <= range.periodStartDate);
    assert.ok(range.visibleEndDate >= range.periodEndDate);
    assert.equal(range.days.length % 7, 0);
  });

  test("every range is half-open: the end is the next day's start", () => {
    for (const view of CRM_CALENDAR_VIEWS) {
      const range = resolveCalendarRange(view, "2026-12-31");

      assert.equal(
        range.endUtc,
        calendarLocalDayStartUtc(addCalendarDays(range.visibleEndDate, 1)),
        `${view} must end where the next local day begins`
      );

      assert.equal(range.days[0], range.visibleStartDate);
      assert.equal(range.days[range.days.length - 1], range.visibleEndDate);
    }
  });

  test("the query applies those bounds half-open, and nothing else", () => {
    assert.match(QUERIES, /\.gte\("due_at", range\.startUtc\)/);
    assert.match(QUERIES, /\.lt\("due_at", range\.endUtc\)/);
    assert.match(QUERIES, /\.eq\("status", "open"\)/);
  });

  test("todayLocalDate is the server's, resolved from the same captured instant", () => {
    assert.match(QUERIES, /const capturedAt = new Date\(\)\.toISOString\(\);/);
    assert.match(QUERIES, /todayLocalDate: calendarLocalDate\(capturedAt\)/);

    /* The request carries no clock, and the route supplies none. */
    for (const clock of ["new Date(", "Date.now(", "toISOString(", "getTime("]) {
      assert.ok(
        !code(ROUTE).includes(clock),
        `the route must not read a clock via ${clock}`
      );
    }
  });

  test("the boundary maths lives in one place", () => {
    assert.match(CONTRACTS, /CRM_CALENDAR_UTC_OFFSET_MINUTES = 330/);

    /* The query composes the helper; it does not restate the offset. */
    assert.ok(
      !QUERIES.includes("330") && !QUERIES.includes("86_400_000"),
      "the query must not restate the offset or a day length"
    );
  });
});

/* ========================================================================== */
/* Scoping                                                                    */
/* ========================================================================== */

describe("scope is decided by the canonical access context, never by the caller", () => {
  test("the canonical narrowing is unchanged", () => {
    assert.match(
      QUERIES,
      /context\.canReadBroad\s*\?\s*options\.ownerId \?\? null\s*:\s*context\.userId/
    );
  });

  test("an assignment-scoped caller is pinned to their own activities", () => {
    /*
     * The requested owner is discarded for a non-broad caller — the else branch
     * returns `context.userId` without consulting `options.ownerId` at all. RLS
     * alone would be WIDER than this: it admits a colleague's activity on a
     * lead the caller can see, which the canonical calendar excludes.
     */
    const narrowing = QUERIES.slice(
      QUERIES.indexOf("const scopeOwnerId"),
      QUERIES.indexOf("const scopeOwnerId") + 200
    );

    const elseBranch = narrowing.slice(narrowing.indexOf(":"));

    assert.ok(
      elseBranch.includes("context.userId"),
      "a non-broad caller must be pinned to themselves"
    );
    assert.ok(
      !elseBranch.includes("options.ownerId"),
      "a non-broad caller's requested owner must be discarded"
    );
  });

  test("a broad caller may request one owner, and team scope when they do not", () => {
    assert.match(QUERIES, /request = request\.eq\("owner_id", scopeOwnerId\)/);
    assert.match(
      QUERIES,
      /isTeamScope: context\.canReadBroad && scopeOwnerId === null/
    );
  });

  test("owner labels stay gated on the same flag", () => {
    assert.match(
      QUERIES,
      /context\.canReadBroad\s*\?\s*fetchCrmAssigneeDirectory\(context, db\)/
    );
    assert.match(
      QUERIES,
      /ownerLabel: context\.canReadBroad/
    );

    /* The route cannot widen a label it never sees. */
    assert.ok(
      !code(ROUTE).includes("ownerLabel"),
      "the route must not touch owner labels"
    );
  });

  test("no super-admin shortcut exists anywhere in the route", () => {
    const body = code(ROUTE);

    for (const shortcut of [
      "superAdmin",
      "super_admin",
      "isSuperAdmin",
      "SUPER_ADMIN",
      "role",
    ]) {
      assert.ok(
        !body.includes(shortcut),
        `the route must not infer scope from ${shortcut}`
      );
    }
  });

  test("the route passes the requested owner as data, never as a decision", () => {
    const body = code(ROUTE);

    /* `ownerId` is only ever parsed, validated and handed on. */
    assert.match(body, /\{ view, anchorDate, ownerId \}/);
    assert.ok(
      !body.includes("scopeOwnerId"),
      "the route must not resolve a scope"
    );
  });
});

/* ========================================================================== */
/* Boundedness                                                                */
/* ========================================================================== */

describe("the read is bounded and says so when it is truncated", () => {
  test("the canonical ceiling is 400", () => {
    assert.equal(CRM_CALENDAR_EVENT_LIMIT, 400);
  });

  test("the query asks for exactly one row past the ceiling", () => {
    assert.match(QUERIES, /\.limit\(CRM_CALENDAR_EVENT_LIMIT \+ 1\)/);
  });

  test("the extra row is a probe, never a returned event", () => {
    assert.match(
      QUERIES,
      /const truncated = rows\.length > CRM_CALENDAR_EVENT_LIMIT;/
    );
    assert.match(
      QUERIES,
      /const visibleRows = truncated \? rows\.slice\(0, CRM_CALENDAR_EVENT_LIMIT\) : rows;/
    );
    assert.match(QUERIES, /visibleRows\.map\(/);
  });

  test("truncation is decided on the row count, not on a guess", () => {
    const ceiling = CRM_CALENDAR_EVENT_LIMIT;

    for (const [fetched, truncated, returned] of [
      [0, false, 0],
      [1, false, 1],
      [ceiling, false, ceiling],
      [ceiling + 1, true, ceiling],
    ] as const) {
      assert.equal(fetched > ceiling, truncated);
      assert.equal(Math.min(fetched, ceiling), returned);
    }
  });

  test("the ordering is canonical and total, so the head is deterministic", () => {
    assert.match(QUERIES, /\.order\("due_at", \{ ascending: true \}\)/);
    assert.match(QUERIES, /\.order\("id", \{ ascending: true \}\)/);
  });

  test("nothing unbounded is read", () => {
    /* One bounded select, plus the directory RPC that returns no lead rows. */
    assert.equal(
      (QUERIES.match(/\.from\(/g) ?? []).length,
      1,
      "the calendar must issue exactly one table read"
    );

    assert.ok(
      !QUERIES.includes('select("*")'),
      "the calendar must not select every column"
    );

    /* And the route adds no read of its own. */
    assert.ok(
      !code(ROUTE).includes(".from("),
      "the route must not query directly"
    );
  });
});

/* ========================================================================== */
/* The browser workspace is untouched                                          */
/* ========================================================================== */

describe("the existing web calendar is unchanged", () => {
  test("the page still calls the query with two arguments", () => {
    assert.match(
      PAGE,
      /fetchCrmCalendarSnapshot\(context, \{ view, anchorDate, ownerId: ownerFilter \}\)/
    );

    /* Passing nothing keeps the cookie-scoped client, exactly as before. */
    assert.match(
      read("src", "features", "crm", "server", "crm-db.ts"),
      /db \?\? \(await createClient\(\)\)/
    );
  });

  test("the page keeps its own access gate and owner filter", () => {
    assert.match(PAGE, /requireCrmReadAccess\("\/admin\/crm\/calendar"\)/);
    assert.match(PAGE, /canFilterOwner=\{context\.canReadBroad\}/);
    assert.match(PAGE, /canReschedule=\{context\.canManageLeadFollowUps\}/);
  });

  test("the calendar model itself did not change", () => {
    /* Same physical source, same open-only filter, same select list. */
    assert.match(QUERIES, /\.from\("lead_follow_ups"\)/);
    assert.match(
      QUERIES,
      /leads!lead_follow_ups_lead_id_fkey\(submitted_name, status\)/
    );

    for (const field of [
      "activityId",
      "leadId",
      "leadDisplayLabel",
      "leadStatus",
      "ownerId",
      "ownerLabel",
      "activityType",
      "title",
      "priority",
      "dueAt",
      "durationMinutes",
      "isPrimaryNextAction",
    ]) {
      assert.ok(
        QUERIES.includes(`${field}:`),
        `the event contract must still carry ${field}`
      );
    }
  });

  test("no second calendar implementation was created", () => {
    /* The route imports the canonical query; it does not restate it. */
    assert.match(
      ROUTE,
      /from "@\/features\/crm\/server\/crm-calendar-queries\.ts"/
    );

    assert.ok(
      !code(ROUTE).includes("lead_follow_ups"),
      "the route must not name the physical table"
    );
  });

  test("no migration accompanies this endpoint", () => {
    assert.ok(
      !QUERIES.includes("CREATE FUNCTION") && !ROUTE.includes("CREATE FUNCTION"),
      "M7A is a read contract, not a schema change"
    );
  });
});
