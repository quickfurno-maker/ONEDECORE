import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  REPORT_AGING_BUCKET_DEFS,
  REPORT_CUSTOM_MAX_DAYS,
  REPORT_DATE_PRESETS,
  REPORT_TIMEZONE,
} from "../contracts/reporting-contracts.ts";
import { resolveReportDateRange } from "../contracts/reporting-date-range.ts";
import {
  mapManagementAnalyticsPayload,
  resolveTargetPeriodFromRangeStart,
} from "../contracts/management-analytics-contracts.ts";
import { isUuid } from "../contracts/assignment-contracts.ts";

/**
 * Owner mobile CRM Insights.
 *
 * The mobile phase stopped before building this, for two reasons that are worth
 * restating because every assertion below defends one of them:
 *
 *   the window   `get_crm_management_analytics` takes explicit bounds, and
 *                producing them means reimplementing IST month ends, the
 *                last-month rollover, the 30-day back-count and the 366-day
 *                cap. An off-by-one changes cohort membership, so SLA
 *                compliance, funnel conversion and velocity medians all move —
 *                and every one of them still looks like a plausible number.
 *   the engine   trends, source mix, workload, follow-up performance, lost
 *                reasons and the aging bands have no RPC. They are aggregated
 *                in server TypeScript, and `crm.reporting.read` is enforced
 *                only there, so a direct client read would rebuild the
 *                analytics engine AND skip the permission.
 *
 * So this route owns neither. It names a period, hands the canonical functions
 * their filters, and returns their models verbatim — with the one thing it does
 * add being honesty about which of the three sources answered.
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

function flat(source: string): string {
  return source.replace(/\s+/g, " ");
}

const ROUTE = read(
  "src", "app", "api", "mobile", "crm", "insights", "route.ts"
);

const ANALYTICS = read(
  "src", "features", "crm", "server", "crm-management-analytics-queries.ts"
);

const REPORTING = read(
  "src", "features", "crm", "server", "crm-reporting-queries.ts"
);

const COMMERCIAL = read(
  "src", "features", "crm", "server", "crm-lead-commercial-queries.ts"
);

const MOBILE_AUTH = read(
  "src", "features", "crm", "server", "crm-mobile-auth.ts"
);

const RANGE = read(
  "src", "features", "crm", "contracts", "reporting-date-range.ts"
);

/* ========================================================================== */
/* Auth and input                                                             */
/* ========================================================================== */

describe("the endpoint is authenticated, permissioned and read-only", () => {
  test("it reuses the CRM-M1 bearer auth unchanged", () => {
    assert.match(ROUTE, /resolveCrmMobileAuth\(request\)/);
    assert.match(ROUTE, /crmMobileAuthError\(auth\.kind\)/);
  });

  test("a missing or invalid bearer answers 401 before anything runs", () => {
    const body = code(ROUTE);

    const authAt = body.indexOf("resolveCrmMobileAuth");
    const guardAt = body.indexOf('auth.kind !== "granted"');
    const readAt = body.indexOf("Promise.allSettled");

    assert.ok(authAt >= 0, "must resolve auth");
    assert.ok(guardAt > authAt, "must guard before reading");
    assert.ok(readAt > guardAt, "must read only after the guard");

    assert.match(MOBILE_AUTH, /if \(!token\) \{/);
    assert.match(MOBILE_AUTH, /if \(error \|\| !data\.user\) \{/);
    assert.match(MOBILE_AUTH, /unauthenticated: 401/);
  });

  test("an inactive or denied caller answers 403 through the shared envelope", () => {
    assert.match(MOBILE_AUTH, /forbidden: 403/);

    assert.ok(
      !code(ROUTE).includes("inactive") &&
        !code(ROUTE).includes("denied"),
      "the route must not re-map auth outcomes"
    );
  });

  test("a caller without crm.reporting.read is refused BEFORE any source runs", () => {
    const body = code(ROUTE);

    const gateAt = body.indexOf("auth.context.canReadCrmReporting");
    const readAt = body.indexOf("Promise.allSettled");

    assert.ok(gateAt > 0, "the route must gate on reporting access");
    assert.ok(
      readAt > gateAt,
      "the gate must precede every source read"
    );

    assert.match(
      flat(body),
      /if \(!auth\.context\.canReadCrmReporting\) \{ return crmMobileError\( "forbidden"/
    );
  });

  test("a refusal can never be reported as three unavailable sources", () => {
    const body = code(ROUTE);

    /*
     * Without the route gate, `Promise.allSettled` would swallow the three
     * per-source permission errors and answer 200 with everything
     * "unavailable" — an outage, not a permission answer. Worse, the forecast
     * has no reporting gate of its own and would have succeeded.
     */
    const gateAt = body.indexOf("canReadCrmReporting");
    const settledAt = body.indexOf("settled(");

    assert.ok(gateAt < settledAt);
  });

  test("the underlying queries keep their own assertions too", () => {
    assert.match(ANALYTICS, /assertReportingPermission\(context\)/);
    assert.match(REPORTING, /assertReportingPermission\(context\)/);
  });

  test("every source runs as the caller", () => {
    const body = flat(code(ROUTE));

    assert.match(
      body,
      /fetchCrmManagementAnalyticsSnapshot\(auth\.context, filters, auth\.db\)/
    );
    assert.match(
      body,
      /fetchCrmPipelineValueSummaryStrict\(scopeOwnerId, auth\.db\)/
    );
    assert.match(
      body,
      /fetchCrmReportingSnapshotForContext\(auth\.context, filters, auth\.db\)/
    );
  });

  test("no browser-only auth path is required", () => {
    const body = code(ROUTE);

    for (const browserOnly of [
      "getCrmAccessContext",
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
      ["analytics", ANALYTICS],
      ["reporting", REPORTING],
      ["commercial", COMMERCIAL],
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

  test("the bearer token is never handled, logged or put in a URL", () => {
    const body = code(ROUTE);

    assert.ok(!body.includes("token"), "the route must not handle the token");

    assert.ok(
      !/console\.(log|info|warn)/.test(body),
      "no incidental logging"
    );

    /* The only log is a fixed route category plus a source label. */
    assert.match(
      flat(body),
      /console\.error\(`\[mobile\/crm\/insights\] \$\{label\}`, result\.reason\)/
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
      ["analytics", code(ANALYTICS)],
      ["reporting", code(REPORTING)],
    ] as const) {
      for (const write of [".insert(", ".update(", ".upsert(", ".delete("]) {
        assert.ok(
          !source.includes(write),
          `${name} must not ${write}`
        );
      }
    }
  });

  test("no internal error text ever reaches the client", () => {
    const body = code(ROUTE);

    assert.ok(!body.includes("error.message"));
    assert.ok(!body.includes("result.reason.message"));
    assert.ok(!body.includes(".stack"));
  });
});

/* ========================================================================== */
/* The period                                                                 */
/* ========================================================================== */

describe("the client names a period; the server resolves the boundaries", () => {
  test("an absent preset takes the canonical default", () => {
    assert.deepEqual(
      [...REPORT_DATE_PRESETS],
      ["this_month", "last_month", "last_30_days", "custom"]
    );

    assert.match(
      code(ROUTE),
      /rawPreset \?\? "this_month"/
    );
  });

  test("a preset the canonical vocabulary does not admit is refused", () => {
    assert.match(
      flat(code(ROUTE)),
      /rawPreset !== null && !\(REPORT_DATE_PRESETS as readonly string\[\]\)\.includes\(rawPreset\)/
    );

    assert.match(code(ROUTE), /crmMobileError\(\s*"invalid_request"/);
  });

  test("the range comes only from the canonical resolver", () => {
    assert.match(
      flat(code(ROUTE)),
      /resolveReportDateRange\(\{ preset, customStart: rawStart, customEnd: rawEnd, \}\)/
    );

    /* And the route restates no boundary of its own. */
    for (const banned of [
      "Asia/Kolkata",
      "+05:30",
      "daysInMonth",
      "istDayStartIso",
      "86_400_000",
      "86400000",
      "Date.UTC",
      "Intl.DateTimeFormat",
      "p_start",
      "p_end",
      "p_target_month",
      "targetMonth",
    ]) {
      assert.ok(
        !code(ROUTE).includes(banned),
        `the route must not restate ${banned}`
      );
    }
  });

  test("this_month is a whole IST month", () => {
    const { range } = resolveReportDateRange({
      preset: "this_month",
      now: new Date("2026-09-15T06:00:00.000Z"),
    });

    assert.equal(range?.startIso, "2026-09-01T00:00:00+05:30");
    assert.equal(range?.endIso, "2026-09-30T23:59:59.999+05:30");
  });

  test("last_month rolls the year over correctly", () => {
    const { range } = resolveReportDateRange({
      preset: "last_month",
      now: new Date("2027-01-10T06:00:00.000Z"),
    });

    assert.equal(range?.startIso, "2026-12-01T00:00:00+05:30");
    assert.equal(range?.endIso, "2026-12-31T23:59:59.999+05:30");
  });

  test("last_30_days is the inclusive 30-day window ending today", () => {
    const { range } = resolveReportDateRange({
      preset: "last_30_days",
      now: new Date("2026-09-15T06:00:00.000Z"),
    });

    assert.equal(range?.startIso, "2026-08-17T00:00:00+05:30");
    assert.equal(range?.endIso, "2026-09-15T23:59:59.999+05:30");
  });

  test("a custom range is resolved, not trusted", () => {
    const { range } = resolveReportDateRange({
      preset: "custom",
      customStart: "2026-04-01",
      customEnd: "2026-04-30",
    });

    assert.equal(range?.startIso, "2026-04-01T00:00:00+05:30");
    assert.equal(range?.endIso, "2026-04-30T23:59:59.999+05:30");
  });

  test("a malformed custom date is an error, not a silent fallback", () => {
    const bad = resolveReportDateRange({
      preset: "custom",
      customStart: "01-04-2026",
      customEnd: "2026-04-30",
    });

    assert.equal(bad.range, undefined);
    assert.match(bad.error ?? "", /YYYY-MM-DD/);

    /* And the route turns that into 400 rather than proceeding. */
    assert.match(
      flat(code(ROUTE)),
      /if \(!resolved\.range\) \{ return crmMobileError\( "invalid_request", resolved\.error/
    );
  });

  test("a reversed or over-long custom range is refused", () => {
    assert.equal(REPORT_CUSTOM_MAX_DAYS, 366);

    const reversed = resolveReportDateRange({
      preset: "custom",
      customStart: "2026-05-01",
      customEnd: "2026-04-01",
    });

    assert.match(reversed.error ?? "", /on or before/);

    const tooLong = resolveReportDateRange({
      preset: "custom",
      customStart: "2025-01-01",
      customEnd: "2026-12-31",
    });

    assert.match(tooLong.error ?? "", /366/);
  });

  test("the report timezone is stated once, in the contracts", () => {
    assert.equal(REPORT_TIMEZONE, "Asia/Kolkata");
    assert.match(RANGE, /REPORT_TIMEZONE/);
  });

  test("the target month is derived only by the canonical helper", () => {
    assert.deepEqual(
      resolveTargetPeriodFromRangeStart("2026-09-01T00:00:00+05:30"),
      { period: "2026-09", targetMonth: "2026-09-01" }
    );

    assert.match(
      ANALYTICS,
      /resolveTargetPeriodFromRangeStart\(\s*filters\.dateRange\.startIso\s*\)/
    );

    assert.ok(
      !code(ROUTE).includes("resolveTargetPeriodFromRangeStart"),
      "the route must not derive the target month itself"
    );
  });
});

/* ========================================================================== */
/* Owner and source                                                           */
/* ========================================================================== */

describe("owner and source are validated, then resolved once", () => {
  test("team and an empty owner both mean no owner", () => {
    assert.match(
      flat(code(ROUTE)),
      /ownerRaw === "" \|\| ownerRaw === "team" \? null : ownerRaw/
    );
  });

  test("a malformed owner or source is refused, not dropped", () => {
    /*
     * Dropping an owner would silently WIDEN the request to the whole team, and
     * dropping a source to every source. Refusing can never return more than
     * was asked for.
     */
    const body = flat(code(ROUTE));

    assert.match(
      body,
      /requestedOwnerId !== null && !isUuid\(requestedOwnerId\)/
    );
    assert.match(body, /sourceId !== null && !isUuid\(sourceId\)/);

    assert.equal(isUuid("3f1a5c7e-9b2d-4e11-8a76-0c4d2b8e5f31"), true);
    assert.equal(isUuid("not-a-uuid"), false);
    assert.equal(isUuid(""), false);
  });

  test("scope is resolved ONCE by the canonical resolver", () => {
    assert.match(
      flat(code(ROUTE)),
      /const scopeOwnerId = resolveAnalyticsScopeOwnerId\( auth\.context, requestedOwnerId \)/
    );

    assert.match(
      ANALYTICS,
      /if \(!context\.canReadBroad\) \{\s*return context\.userId;\s*\}/
    );
  });

  test("the SAME resolved owner reaches all three sources", () => {
    const body = flat(code(ROUTE));

    /* Both filter-driven sources read `assigneeId`, and the forecast is
       given `scopeOwnerId` directly. */
    assert.match(body, /assigneeId: scopeOwnerId,/);
    assert.match(
      body,
      /fetchCrmPipelineValueSummaryStrict\(scopeOwnerId, auth\.db\)/
    );

    assert.ok(
      !body.includes("assigneeId: requestedOwnerId"),
      "the raw request must never become a filter"
    );
  });

  test("pinning first is what closes the reporting snapshot's own gap", () => {
    /*
     * `applyLeadFilters` applies a supplied `assigneeId` verbatim and only pins
     * a non-broad caller when none was given. Passing the raw request through
     * would therefore let a non-broad caller scope the snapshot to a colleague.
     * RLS still bounds the rows, but the scope semantics would differ from the
     * analytics RPC, which refuses a foreign owner outright.
     */
    assert.match(
      flat(REPORTING),
      /if \(filters\.assigneeId\) \{ builder = builder\.eq\("assigned_to", filters\.assigneeId\); \} else if \(!context\.canReadBroad\)/
    );
  });

  test("no super-admin shortcut exists", () => {
    const body = code(ROUTE);

    for (const shortcut of [
      "superAdmin",
      "super_admin",
      "isSuperAdmin",
      "SUPER_ADMIN",
      "canReadBroad",
    ]) {
      assert.ok(
        !body.includes(shortcut),
        `the route must not infer scope from ${shortcut}`
      );
    }
  });

  test("the resolved scope is reported, not the request", () => {
    const body = flat(code(ROUTE));

    assert.match(body, /scopeOwnerId, isTeamScope: scopeOwnerId === null,/);
  });
});

/* ========================================================================== */
/* Management analytics                                                       */
/* ========================================================================== */

describe("management analytics stays in the RPC", () => {
  test("the canonical RPC is the only source", () => {
    assert.match(ANALYTICS, /supabase\.rpc\("get_crm_management_analytics"/);

    assert.ok(
      !code(ROUTE).includes("get_crm_management_analytics"),
      "the route must not name the RPC"
    );
  });

  test("its window arguments come only from the canonical range", () => {
    assert.match(ANALYTICS, /p_start: filters\.dateRange\.startIso/);
    assert.match(ANALYTICS, /p_end: filters\.dateRange\.endIso/);
    assert.match(ANALYTICS, /p_target_month: targetMonth/);
    assert.match(ANALYTICS, /p_owner_id: scopeOwnerId/);
    assert.match(ANALYTICS, /p_source_id: filters\.sourceId/);
  });

  test("the payload is mapped by the canonical mapper", () => {
    assert.match(ANALYTICS, /mapManagementAnalyticsPayload\(data\)/);

    assert.ok(
      !code(ROUTE).includes("mapManagementAnalyticsPayload"),
      "the route must not map the payload"
    );
  });

  test("it can now run for a bearer caller without changing the browser bundle", () => {
    assert.ok(
      ANALYTICS.includes("db?: CrmDb"),
      "the analytics read must take an OPTIONAL client"
    );

    assert.match(ANALYTICS, /resolveCrmDb\(db\)/);

    assert.ok(
      !ANALYTICS.includes("await createClient()"),
      "the analytics read must not create its own client"
    );

    /* The browser bundle still composes analytics + forecast, unchanged. */
    assert.match(
      flat(ANALYTICS),
      /const \[snapshot, forecast\] = await Promise\.all\(\[ fetchCrmManagementAnalyticsSnapshot\(context, filters\), fetchCrmPipelineValueSummary\(scopeOwnerId\), \]\)/
    );
  });

  test("the route performs no analytics arithmetic at all", () => {
    const body = code(ROUTE);

    for (const formula of [
      "BasisPoints",
      "basisPoints",
      "median",
      "Median",
      "conversion",
      "attainment",
      "10000",
      "/ 100",
      "Math.round",
    ]) {
      assert.ok(
        !body.includes(formula),
        `the route must not compute ${formula}`
      );
    }
  });
});

/* ========================================================================== */
/* Forecast                                                                   */
/* ========================================================================== */

describe("the forecast reports zero only when it means zero", () => {
  test("the canonical RPC is the only source", () => {
    assert.match(
      COMMERCIAL,
      /supabase\.rpc\("get_crm_pipeline_value_summary"/
    );

    assert.ok(
      !code(ROUTE).includes("get_crm_pipeline_value_summary"),
      "the route must not name the RPC"
    );
  });

  test("there is exactly one RPC call site and one mapper", () => {
    assert.equal(
      (
        COMMERCIAL.match(/rpc\("get_crm_pipeline_value_summary"/g) ?? []
      ).length,
      1
    );

    assert.equal(
      (
        COMMERCIAL.match(/export function mapPipelineValueSummaryPayload/g) ??
        []
      ).length,
      1
    );
  });

  test("the strict reader throws instead of answering all zeros", () => {
    /*
     * EMPTY_PIPELINE_VALUE_SUMMARY is all zeros, and once serialised a failed
     * read looks exactly like an empty pipeline. On a surface reporting money
     * to an owner those are different facts.
     */
    const strict = COMMERCIAL.slice(
      COMMERCIAL.indexOf("fetchCrmPipelineValueSummaryStrict")
    );

    assert.match(strict, /throw crmErrorFromPostgresMessage\(error\.message/);
    assert.match(strict, /if \(!mapped\)/);

    assert.ok(
      !strict.includes("EMPTY_PIPELINE_VALUE_SUMMARY"),
      "the strict reader must never answer EMPTY"
    );
  });

  test("the browser reader keeps its tolerant behaviour exactly", () => {
    const tolerant = COMMERCIAL.slice(
      COMMERCIAL.indexOf("export async function fetchCrmPipelineValueSummary("),
      COMMERCIAL.indexOf("fetchCrmPipelineValueSummaryStrict")
    );

    assert.match(tolerant, /if \(error\) \{\s*return EMPTY_PIPELINE_VALUE_SUMMARY;/);
    assert.match(
      tolerant,
      /mapPipelineValueSummaryPayload\(data\) \?\? EMPTY_PIPELINE_VALUE_SUMMARY/
    );
  });

  test("a real zero payload is still a success", () => {
    /*
     * Mapping is shared, so a genuinely zero pipeline maps to zeros and is
     * enveloped as `ok` — only a thrown read becomes `unavailable`.
     */
    assert.match(
      flat(code(ROUTE)),
      /if \(result\.status === "fulfilled"\) \{ return \{ kind: "ok", data: result\.value \}; \}/
    );
  });

  test("no probability or weighted value is declared outside the RPC", () => {
    for (const [name, source] of [
      ["route", code(ROUTE)],
      ["analytics", code(ANALYTICS)],
    ] as const) {
      for (const banned of [
        "probabilityBasisPoints",
        "weightedValuePaise",
        "* 0.",
        "probability",
      ]) {
        assert.ok(
          !source.includes(banned),
          `${name} must not declare ${banned}`
        );
      }
    }
  });

  test("the forecast is current pipeline truth, not a windowed figure", () => {
    /* It receives only an owner: no range, no source filter. */
    assert.match(
      flat(code(ROUTE)),
      /fetchCrmPipelineValueSummaryStrict\(scopeOwnerId, auth\.db\)/
    );

    assert.ok(
      !flat(code(ROUTE)).includes(
        "fetchCrmPipelineValueSummaryStrict(scopeOwnerId, filters"
      ),
      "the forecast must not be handed the report window"
    );
  });
});

/* ========================================================================== */
/* Reporting snapshot                                                         */
/* ========================================================================== */

describe("the reporting aggregations stay in server TypeScript", () => {
  test("all seven still live in the server module", () => {
    for (const builder of [
      "function buildSummary",
      "function buildTrend",
      "function buildSourceMix",
      "function buildAssigneeWorkload",
      "function buildClosedLostReasons",
      "function buildAgingBuckets",
      "function fetchFollowUpMetrics",
    ]) {
      assert.ok(
        REPORTING.includes(builder),
        `${builder} must remain in the reporting module`
      );
    }
  });

  test("the route recomputes none of them", () => {
    const body = code(ROUTE);

    for (const banned of [
      "buildSummary",
      "buildTrend",
      "buildSourceMix",
      "buildAssigneeWorkload",
      "buildClosedLostReasons",
      "buildAgingBuckets",
      "REPORT_AGING_BUCKET_DEFS",
      "statusCounts",
      "minDays",
      "maxDays",
      "sort(",
      "reduce(",
      "new Map(",
    ]) {
      assert.ok(
        !body.includes(banned),
        `the route must not do ${banned}`
      );
    }
  });

  test("the aging bands are defined once, in the contracts", () => {
    assert.equal(REPORT_AGING_BUCKET_DEFS.length, 5);
    assert.equal(REPORT_AGING_BUCKET_DEFS[0].label, "0–7 days");
    assert.equal(REPORT_AGING_BUCKET_DEFS[4].maxDays, null);
  });

  test("it runs for a bearer caller, with the client threaded into BOTH reads", () => {
    assert.match(
      REPORTING,
      /export async function fetchCrmReportingSnapshotForContext\(/
    );

    assert.ok(
      REPORTING.includes("db?: CrmDb"),
      "the reporting read must take an OPTIONAL client"
    );

    assert.match(REPORTING, /resolveCrmDb\(db\)/);

    /* The follow-up read must run as the same caller, not a cookie client. */
    assert.match(REPORTING, /fetchFollowUpMetrics\(filters, context, db\)/);

    assert.ok(
      !REPORTING.includes("await createClient()"),
      "the reporting reads must not create their own client"
    );
  });

  test("the browser entry point is preserved and delegates", () => {
    const wrapper = REPORTING.slice(
      REPORTING.indexOf("export async function fetchCrmReportingSnapshot(")
    );

    assert.match(wrapper, /getCrmAccessContext\(\)/);
    assert.match(wrapper, /CRM_REPORTING_AUTH_REQUIRED/);
    assert.match(
      wrapper,
      /return fetchCrmReportingSnapshotForContext\(context, filters\);/
    );
  });

  test("no raw lead or follow-up row is exposed to the client", () => {
    const body = code(ROUTE);

    for (const raw of [
      '"leads"',
      '"lead_follow_ups"',
      ".from(",
      "LeadRow",
      "FollowUpRow",
    ]) {
      assert.ok(
        !body.includes(raw),
        `the route must not touch ${raw}`
      );
    }

    /* And the cohort select was not widened. */
    assert.match(
      REPORTING,
      /"id, status, assigned_to, primary_source_id, created_at, closed_lost_reason_id/
    );
  });
});

/* ========================================================================== */
/* Partial failure                                                            */
/* ========================================================================== */

describe("three sources fail independently and say so", () => {
  test("they are read with allSettled, not all-or-nothing", () => {
    assert.match(code(ROUTE), /Promise\.allSettled\(\[/);

    assert.ok(
      !code(ROUTE).includes("Promise.all(["),
      "one source failing must not reject the others"
    );
  });

  test("the envelope is explicit about which source answered", () => {
    assert.match(
      flat(code(ROUTE)),
      /type SourceResult<T> = \| \{ readonly kind: "ok"; readonly data: T \} \| \{ readonly kind: "unavailable" \}/
    );

    const body = flat(code(ROUTE));

    assert.match(body, /const management = settled\(managementSettled, "management"\)/);
    assert.match(body, /const forecast = settled\(forecastSettled, "forecast"\)/);
    assert.match(body, /const reporting = settled\(reportingSettled, "reporting"\)/);
  });

  test("a failed source is never serialised as empty or zero success", () => {
    const helper = flat(code(ROUTE)).slice(
      flat(code(ROUTE)).indexOf("function settled")
    );

    const body = helper.slice(0, helper.indexOf("export async function GET"));

    assert.match(body, /return \{ kind: "unavailable" \}/);

    for (const falseSuccess of [
      "EMPTY_",
      "data: {}",
      "data: []",
      "data: null",
      "?? 0",
    ]) {
      assert.ok(
        !body.includes(falseSuccess),
        `a failure must not become ${falseSuccess}`
      );
    }
  });

  test("each source is enveloped, so any subset can succeed", () => {
    const body = flat(code(ROUTE));

    /* All three appear in the response, each carrying its own kind. */
    assert.match(body, /management: management\.kind === "ok"/);
    assert.match(body, /forecast, reporting,/);
  });

  test("all three failing is an outage, not a page of empty sections", () => {
    assert.match(
      flat(code(ROUTE)),
      /if \( management\.kind === "unavailable" && forecast\.kind === "unavailable" && reporting\.kind === "unavailable" \) \{ return crmMobileError\( "unavailable"/
    );
  });

  test("the response order and shape are deterministic", () => {
    const body = flat(code(ROUTE));

    assert.match(
      body,
      /const \[managementSettled, forecastSettled, reportingSettled\] = await Promise\.allSettled/
    );
  });

  test("the target period is unknown when its source is", () => {
    /*
     * The period belongs to the analytics payload. Deriving one from the range
     * when that source failed would be the route owning a rule.
     */
    assert.match(
      flat(code(ROUTE)),
      /targetPeriod: management\.kind === "ok" \? management\.data\.targetPeriod : null,/
    );
  });
});

/* ========================================================================== */
/* Canonical null honesty                                                     */
/* ========================================================================== */

describe("unknown is never rendered as zero", () => {
  test("compliance is null when nothing has been decided", () => {
    const snapshot = mapManagementAnalyticsPayload({
      capturedAt: "2026-09-05T09:00:00.000Z",
      scopeOwnerId: null,
      isTeamScope: true,
      canReadCommercialTruth: false,
      sla: {
        cohortLeadCount: 12,
        eligibleCount: 12,
        metCount: 0,
        breachedCount: 0,
        pendingCount: 12,
        outOfPolicyCount: 0,
        decidedCount: 0,
        complianceBasisPoints: null,
      },
    });

    /* Not 0%, which would read as total non-compliance. */
    assert.equal(snapshot.sla.complianceBasisPoints, null);
    assert.equal(snapshot.sla.decidedCount, 0);
    assert.equal(snapshot.sla.cohortLeadCount, 12);
  });

  test("commercial achievement is null when the caller cannot read it", () => {
    const snapshot = mapManagementAnalyticsPayload({
      capturedAt: "2026-09-05T09:00:00.000Z",
      canReadCommercialTruth: false,
      targets: {
        period: "2026-09",
        targetMonth: "2026-09-01",
        canReadCommercialTruth: false,
        periodAchievedPaise: null,
        periodAcceptedCount: null,
        rows: [],
      },
    });

    /* A SUM over rows the caller cannot see would look like a truthful ₹0. */
    assert.equal(snapshot.targets.periodAchievedPaise, null);
    assert.equal(snapshot.targets.periodAcceptedCount, null);
    assert.equal(snapshot.canReadCommercialTruth, false);
  });

  test("a missing velocity median stays null, not zero days", () => {
    const snapshot = mapManagementAnalyticsPayload({
      capturedAt: "2026-09-05T09:00:00.000Z",
      velocity: {
        firstContactSampleSize: 0,
        medianFirstContactSeconds: null,
        activeLeadCount: 0,
        medianActiveLeadAgeSeconds: null,
        medianCurrentStageAgeSeconds: null,
        stageTransitions: [],
      },
    });

    assert.equal(snapshot.velocity.medianFirstContactSeconds, null);
    assert.equal(snapshot.velocity.medianActiveLeadAgeSeconds, null);
  });

  test("the route never coerces a null away in what it returns", () => {
    /*
     * Scoped to the response. `?? ""` appears earlier, normalising an ABSENT
     * query parameter before validation, which is a different thing entirely
     * from turning an unknown measurement into a number.
     */
    const body = code(ROUTE);

    const response = body.slice(body.indexOf("NextResponse.json("));

    for (const banned of ["?? 0", '?? ""', "|| 0", "Number(", "?? {}", "?? []"]) {
      assert.ok(
        !response.includes(banned),
        `the response must not coerce with ${banned}`
      );
    }

    /* The one nullable it does set is set to null, not to a substitute. */
    assert.match(response, /: null,/);
  });

  test("commercial truth is read from the snapshot, never invented", () => {
    assert.ok(
      !code(ROUTE).includes("canReadCommercialTruth"),
      "the route must not publish a commercial-permission value of its own"
    );

    /* It already travels inside the analytics snapshot. */
    assert.match(ANALYTICS, /mapManagementAnalyticsPayload/);
  });

  test("an empty reporting array is legitimate data, not a failure", () => {
    /*
     * `buildTrend` over no leads returns `[]`, which is a true answer. Only a
     * thrown read becomes `unavailable`, so the two can never be confused.
     */
    assert.match(REPORTING, /return \[\.\.\.buckets\.entries\(\)\]/);

    assert.match(
      flat(code(ROUTE)),
      /if \(result\.status === "fulfilled"\) \{ return \{ kind: "ok", data: result\.value \}; \}/
    );
  });
});

/* ========================================================================== */
/* No migration, no analytics change                                          */
/* ========================================================================== */

describe("nothing canonical was redefined", () => {
  test("no migration accompanies this endpoint", () => {
    for (const [name, source] of [
      ["route", ROUTE],
      ["analytics", ANALYTICS],
      ["reporting", REPORTING],
      ["commercial", COMMERCIAL],
    ] as const) {
      assert.ok(
        !source.includes("CREATE FUNCTION") &&
          !source.includes("create or replace function"),
        `${name} is a read contract, not a schema change`
      );
    }
  });

  test("the 366-day cap and the timezone are untouched", () => {
    assert.equal(REPORT_CUSTOM_MAX_DAYS, 366);
    assert.equal(REPORT_TIMEZONE, "Asia/Kolkata");
  });

  test("the existing mobile endpoints are unchanged in shape", () => {
    for (const segment of [
      "leads",
      "pipeline",
      "dashboard-summary",
      "calendar",
    ]) {
      const source = read(
        "src", "app", "api", "mobile", "crm", segment, "route.ts"
      );

      assert.match(source, /resolveCrmMobileAuth/);
      assert.match(source, /export async function GET/);
    }
  });
});
