import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

/**
 * Canonical per-lead mobile intelligence.
 *
 * WHY THIS ENDPOINT EXISTS. The Owner app's Lead Command Center opens from
 * Today, from Smart Leads, from the classic list and from cold deep links. The
 * facts it most needs — the effective sales bucket and its provenance, the
 * system score and band, the risk flags, the site-visit milestone — are derived
 * in server TypeScript over batched signals, so they are not columns. The two
 * existing mobile endpoints that carry them are LIST surfaces with no lead-id
 * filter, which left a directly-opened lead unable to obtain them at all.
 *
 * The app's honest response was to display nothing rather than estimate. This
 * route closes that gap, and what these tests guard is that closing it did not
 * cost the things the gap was protecting:
 *
 *   - no second intelligence engine (the derivation is SHARED, not copied)
 *   - no cohort scan to answer a question about one lead
 *   - no existence oracle for leads outside the caller's RLS scope
 *   - no service-role path
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

const DETAIL_ROUTE = read(
  "src", "app", "api", "mobile", "crm", "leads", "[leadId]", "route.ts"
);

const DETAIL_DETAIL_ROUTE = read(
  "src", "app", "api", "mobile", "crm", "leads", "[leadId]", "detail", "route.ts"
);

const LEADS_ROUTE = read(
  "src", "app", "api", "mobile", "crm", "leads", "route.ts"
);

const LEAD_QUERIES = read(
  "src", "features", "crm", "server", "crm-lead-queries.ts"
);

const MOBILE_AUTH = read(
  "src", "features", "crm", "server", "crm-mobile-auth.ts"
);

/**
 * The single-lead read, isolated from the rest of the module so an assertion
 * about IT is not accidentally satisfied by the cohort read above it.
 */
function intelligenceBody(): string {
  const body = code(LEAD_QUERIES);
  const start = body.indexOf(
    "export async function queryLeadIntelligence("
  );

  assert.ok(start >= 0, "queryLeadIntelligence must exist");

  return body.slice(start);
}

/** The extracted enrichment, likewise isolated. */
function enrichBody(): string {
  const body = code(LEAD_QUERIES);
  const start = body.indexOf("export function enrichLeadRow(");

  assert.ok(start >= 0, "enrichLeadRow must exist");

  return body.slice(
    start,
    body.indexOf("export async function queryLeadListPage(")
  );
}

describe("the endpoint is narrow and authenticated", () => {
  test("it reuses the CRM-M1 bearer auth unchanged", () => {
    assert.match(DETAIL_ROUTE, /resolveCrmMobileAuth/);
    assert.match(DETAIL_ROUTE, /crmMobileAuthError/);

    /* It supplies the caller; it does not assemble its own access context. */
    assert.ok(
      !code(DETAIL_ROUTE).includes("canReadBroad:"),
      "the route must not build its own CrmAccessContext"
    );
  });

  test("an unauthenticated or unentitled caller never reaches a query", () => {
    const body = code(DETAIL_ROUTE);

    const authAt = body.indexOf("resolveCrmMobileAuth");
    const guardAt = body.indexOf('auth.kind !== "granted"');
    const queryAt = body.indexOf("await queryLeadIntelligence(");

    assert.ok(authAt >= 0, "must resolve auth");
    assert.ok(guardAt > authAt, "must guard before querying");
    assert.ok(queryAt > guardAt, "must query only after the guard");
  });

  test("a malformed lead id is refused before any query", () => {
    const body = code(DETAIL_ROUTE);

    const validateAt = body.indexOf("isCrmLeadIdShape(leadId)");
    const queryAt = body.indexOf("await queryLeadIntelligence(");

    assert.ok(validateAt >= 0, "must validate the id shape");
    assert.ok(
      queryAt > validateAt,
      "a junk id must never reach a query"
    );

    assert.match(body, /invalid_request/);
  });

  /**
   * ONE guard, shared by every per-lead mobile route. Two copies of a regex
   * like this drift, and the looser copy becomes the way in.
   */
  test("the id guard lives in one place and rejects what it should", () => {
    assert.match(
      code(MOBILE_AUTH),
      /export function isCrmLeadIdShape\(/
    );

    for (const [name, source] of [
      ["intelligence route", DETAIL_ROUTE],
      ["detail route", DETAIL_DETAIL_ROUTE],
    ] as const) {
      assert.ok(
        code(source).includes("isCrmLeadIdShape(leadId)"),
        `${name} must use the shared id guard`
      );
      assert.ok(
        !/\[0-9a-f\]\{8\}/.test(code(source)),
        `${name} must not carry its own uuid regex`
      );
    }
  });

  test("it exposes GET only", () => {
    assert.match(DETAIL_ROUTE, /export async function GET/);

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.ok(
        !new RegExp(`export async function ${method}\\b`).test(
          DETAIL_ROUTE
        ),
        `must not expose ${method}`
      );
    }
  });

  test("no service-role or admin path exists", () => {
    for (const [name, source] of [
      ["detail route", DETAIL_ROUTE],
      ["lead queries", LEAD_QUERIES],
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
});

describe("no existence oracle", () => {
  /**
   * `auth.db` is the CALLER's client, so RLS decides visibility. A lead the
   * caller cannot see yields no row, exactly as a lead that does not exist
   * does — and both must answer identically, or the endpoint becomes a way to
   * enumerate which leads are real.
   */
  test("a hidden lead and a missing lead answer the same 404", () => {
    const body = code(DETAIL_ROUTE);

    assert.match(body, /if \(!lead\)/);
    assert.match(body, /not_found/);

    /* One message for both cases; nothing distinguishes them. */
    const notFoundCount =
      body.split("not_found").length - 1;

    assert.equal(
      notFoundCount,
      1,
      "there must be exactly one not-found answer"
    );
  });

  test("the read returns null rather than throwing on an unseen lead", () => {
    const body = intelligenceBody();

    assert.match(body, /if \(!data\) \{\s*return null;/);
  });

  test("the query runs as the caller, never a privileged probe", () => {
    /* The route hands the bearer client straight through. */
    assert.match(DETAIL_ROUTE, /auth\.db/);

    const body = intelligenceBody();

    assert.match(body, /resolveCrmDb\(db\)/);

    assert.ok(
      !body.includes("await createClient()"),
      "the single-lead read must not bypass the resolver"
    );
  });

  test("404 is part of the shared envelope", () => {
    assert.match(MOBILE_AUTH, /not_found:\s*404/);
  });
});

describe("the read is bounded to one lead", () => {
  test("it selects a single row by primary key", () => {
    const body = intelligenceBody();

    assert.match(body, /\.eq\("id", leadId\)/);
    assert.match(body, /\.maybeSingle\(\)/);
  });

  /**
   * The whole point of the route. Answering a question about ONE lead by
   * reading a month of them would have been correct and unusable.
   */
  test("it never scans a cohort or calls a list surface", () => {
    const body = intelligenceBody();

    for (const forbidden of [
      "queryLeadListPage",
      "readCohortRows",
      "prepareLeadListFilters",
      "parseLeadListQuery",
      "parseLeadMonthParam",
      "CRM_LEAD_COHORT_MAX_ROWS",
      "CRM_LEAD_COHORT_CHUNK_SIZE",
      ".range(",
      "pageSize",
      "fetch(",
    ]) {
      assert.ok(
        !body.includes(forbidden),
        `the single-lead read must not use ${forbidden}`
      );
    }

    /* And the route calls the single-lead read, not the cohort one. */
    assert.ok(
      !code(DETAIL_ROUTE).includes("queryLeadListPage"),
      "the route must not reach the cohort read"
    );
  });

  test("the score batch is given exactly one id", () => {
    const body = intelligenceBody();

    /*
     * The SAME batch helper the cohort read uses, handed a one-element list.
     * That is what makes this bounded without a second signal implementation.
     */
    assert.match(body, /fetchLeadScoreBatch\(\[row\.id\], db\)/);
  });

  test("there is no per-signal loop", () => {
    const body = intelligenceBody();

    for (const forbidden of ["for (", "while (", ".map(", "Promise.all"]) {
      assert.ok(
        !body.includes(forbidden),
        `the single-lead read must not contain ${forbidden}`
      );
    }
  });
});

describe("parity is structural, not reviewed", () => {
  /**
   * The strongest guarantee available here: the cohort read and the single-lead
   * read call the SAME function. A lead cannot score one way in a list and
   * another way when opened, because only one function can answer.
   */
  test("both reads enrich through one shared function", () => {
    const body = code(LEAD_QUERIES);

    assert.match(body, /export function enrichLeadRow\(/);

    /* queryLeadListPage maps its cohort through it. */
    assert.match(
      body,
      /cohort\.rows\.map\(\(row\) =>\s*enrichLeadRow\(row, batch, assigneeLabels, now\)\s*\)/
    );

    /* And the single-lead read returns it directly. */
    assert.match(
      intelligenceBody(),
      /return enrichLeadRow\(row, batch, assigneeLabels, now\)/
    );
  });

  test("the shared enrichment uses the canonical derivations", () => {
    const body = enrichBody();

    /* Score, band and risk flags all come out of one pure helper. */
    assert.match(body, /deriveLeadScore\(/);
    assert.match(body, /priorityScore: score\.priorityScore/);
    assert.match(body, /scoreBand: score\.band/);
    assert.match(body, /riskFlags: score\.riskFlags/);

    /* The bucket and its provenance come out of the one canonical resolver. */
    assert.match(body, /resolveEffectiveSalesBucket\(/);
    assert.match(body, /salesBucket: effective\.bucket/);
    assert.match(body, /salesBucketSource: effective\.source/);
  });

  test("neither the route nor the single-lead read re-derives anything", () => {
    for (const [name, body] of [
      ["detail route", code(DETAIL_ROUTE)],
      ["single-lead read", intelligenceBody()],
    ] as const) {
      for (const forbidden of [
        "deriveLeadScore",
        "resolveScoreBand",
        "resolveEffectiveSalesBucket",
        "resolveSiteVisitState",
        "sortSegmentedLeads",
        "countSalesBuckets",
        "NURTURE",
      ]) {
        assert.ok(
          !body.includes(forbidden),
          `${name} must not perform ${forbidden}`
        );
      }
    }
  });

  test("no weight, threshold or probability table is copied", () => {
    for (const [name, body] of [
      ["detail route", code(DETAIL_ROUTE)],
      ["single-lead read", intelligenceBody()],
    ] as const) {
      for (const forbidden of [
        "CRM_SCORE_MATURITY_POINTS",
        "CRM_SCORE_ENGAGEMENT_POINTS",
        "CRM_LEAD_SCORE_BAND_MIN",
        "crm_stage_probability_bp",
        "probabilityBasisPoints",
      ]) {
        assert.ok(
          !body.includes(forbidden),
          `${name} must not copy ${forbidden}`
        );
      }
    }
  });
});

describe("the four facts stay separate", () => {
  test("stage, temperature, bucket and score are distinct fields", () => {
    const body = enrichBody();

    /*
     * The stored human judgement is carried through UNCHANGED, beside the
     * derived bucket rather than folded into it. A lead parked by its lifecycle
     * keeps the temperature its owner chose, and both are visible.
     */
    assert.match(body, /parseManualSalesTemperature\(/);
    assert.match(body, /manualSalesTemperature,/);

    /* The bucket is derived; the temperature is stored. Both are returned. */
    assert.match(body, /salesBucket: effective\.bucket/);

    /* Stage comes from the row, untouched by either. */
    assert.match(body, /const status = row\.status as LeadStageCode/);
  });

  test("the effective bucket is resolved from all three inputs", () => {
    const body = enrichBody();

    /* lifecycle status > manual temperature > score band, in ONE call. */
    assert.match(
      body,
      /resolveEffectiveSalesBucket\(\s*status,\s*score\.band,\s*manualSalesTemperature\s*\)/
    );
  });

  test("milestones are evidence, never inferred from a stage", () => {
    const body = enrichBody();

    /* Site visit comes from the batched activity evidence. */
    assert.match(body, /siteVisitState: batch\.siteVisits\[row\.id\]/);

    /* Quotation comes from the canonical commercial state. */
    assert.match(body, /quotationState: deal\?\.state \?\? "unknown"/);

    for (const forbidden of [
      'status === "consultation_scheduled"',
      'status === "proposal_sent"',
      'row.status === "consultation_scheduled"',
      'row.status === "proposal_sent"',
    ]) {
      assert.ok(
        !body.includes(forbidden),
        `a milestone must not be inferred from ${forbidden}`
      );
    }
  });
});

describe("direct-open safety", () => {
  /**
   * The requirement that motivated the whole route: a bearer token and a lead
   * id must be enough. Anything else would mean a lead opened from a
   * notification renders less than one opened from Smart Leads.
   */
  test("the request needs only a bearer caller and a lead id", () => {
    const body = code(DETAIL_ROUTE);

    /* The id comes from the path; nothing is read from the query string. */
    assert.match(body, /await params/);

    for (const forbidden of [
      "searchParams",
      "month",
      "bucket",
      "page",
      "assigneeId",
      "followUpDue",
    ]) {
      assert.ok(
        !body.includes(forbidden),
        `the route must not require ${forbidden}`
      );
    }
  });

  test("the read takes only a context, an id and an optional client", () => {
    assert.match(
      code(LEAD_QUERIES),
      /export async function queryLeadIntelligence\(\s*context: CrmAccessContext,\s*leadId: string,\s*db\?: CrmDb\s*\)/
    );
  });
});

describe("the CRM-M1 endpoints are untouched", () => {
  test("the leads list still runs the cohort read", () => {
    assert.match(LEADS_ROUTE, /parseLeadListQuery/);
    assert.match(LEADS_ROUTE, /queryLeadListPage/);
  });

  test("the cohort read still returns the full segmentation result", () => {
    const body = code(LEAD_QUERIES);

    for (const field of [
      "bucketCounts",
      "countsExact",
      "filteredTotal",
      "cohortTruncated",
    ]) {
      assert.ok(
        body.includes(field),
        `queryLeadListPage must still return ${field}`
      );
    }
  });

  test("the new read is additive: its client stays optional", () => {
    assert.ok(
      !/queryLeadIntelligence\([\s\S]{0,160}?db:\s*CrmDb[,)]/.test(
        LEAD_QUERIES
      ),
      "the single-lead read must not require a client"
    );
  });
});
