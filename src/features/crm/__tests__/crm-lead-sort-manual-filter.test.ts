import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  LEAD_LIST_SORTS,
  hasLeadListActiveFilters,
  parseLeadListQuery,
  type LeadListQuery,
} from "../contracts/lead-list-query.ts";
import { LEAD_MONTH_ALL } from "../contracts/lead-month-cohort.ts";

/**
 * Smart Leads: an explicit sort, and a manual-only filter.
 *
 * TWO SURFACES ASK DIFFERENT QUESTIONS OF ONE COHORT. `/admin/crm/leads` is an
 * inbox — "what just came in" — and CRM-M9.5A deliberately made it received
 * order after the sales-priority comparator kept burying fresh enquiries under
 * week-old HOT ones. The Owner app's Smart Leads asks "who do I call next".
 *
 * So the sort is a PARAMETER with a null default, and null means exactly what
 * the page does today. Every existing caller sends nothing and is unaffected;
 * the phone opts into `priority` explicitly. Neither surface had to lose its
 * answer for the other to get one.
 *
 * NOTHING HERE INVENTS A RANKING. `priority` is `sortSegmentedLeads` and
 * `newest` is the received-order comparator — both reused, neither restated. A
 * second ranking written in the query layer would be a second intelligence
 * engine, and it would drift the first time a weight moved.
 */

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");

function read(...segments: readonly string[]): string {
  return readFileSync(join(ROOT, ...segments), "utf8").replace(/\r\n/g, "\n");
}

function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

function flat(source: string): string {
  return source.replace(/\s+/g, " ");
}

const QUERIES = read(
  "src", "features", "crm", "server", "crm-lead-queries.ts"
);

const CONTRACT = read(
  "src", "features", "crm", "contracts", "lead-list-query.ts"
);

const MOBILE_ROUTE = read(
  "src", "app", "api", "mobile", "crm", "leads", "route.ts"
);

/* ====================================================================== */
/* The vocabulary                                                         */
/* ====================================================================== */

describe("the sort is a closed vocabulary with a null default", () => {
  test("exactly five sorts exist", () => {
    assert.deepEqual(
      [...LEAD_LIST_SORTS],
      ["priority", "newest", "oldest", "next_action", "score"]
    );
  });

  test("no sort parameter means received order", () => {
    /*
     * The whole compatibility story. Every caller that exists today sends
     * nothing, parses to null, and keeps the behaviour it has.
     */
    assert.equal(parseLeadListQuery({}).sort, null);
  });

  test("each sort parses, and a bad one falls back rather than refusing", () => {
    for (const sort of LEAD_LIST_SORTS) {
      assert.equal(parseLeadListQuery({ sort }).sort, sort);
    }

    /*
     * A stale client must not be able to empty the owner's list. An
     * unrecognised sort degrades to received order instead of throwing.
     */
    for (const bad of ["urgency", "PRIORITY", "", "score;drop"]) {
      assert.equal(parseLeadListQuery({ sort: bad }).sort, null);
    }
  });

  test("manualOnly needs the exact string", () => {
    assert.equal(parseLeadListQuery({}).manualOnly, false);

    assert.equal(
      parseLeadListQuery({ manualOnly: "true" }).manualOnly,
      true
    );

    /* A typo narrows nothing rather than silently hiding leads. */
    for (const bad of ["TRUE", "1", "yes", "", "false"]) {
      assert.equal(
        parseLeadListQuery({ manualOnly: bad }).manualOnly,
        false
      );
    }
  });
});

/* ====================================================================== */
/* Filter vs order                                                        */
/* ====================================================================== */

describe("ordering a list is not filtering it", () => {
  function query(
    overrides: Partial<LeadListQuery> = {}
  ): LeadListQuery {
    return {
      q: null,
      status: null,
      sourceId: null,
      assignment: null,
      assigneeId: null,
      followUpDue: null,
      bucket: null,
      manualOnly: false,
      sort: null,
      month: LEAD_MONTH_ALL,
      page: 1,
      pageSize: 25,
      ...overrides,
    } as LeadListQuery;
  }

  test("manualOnly counts as an active filter", () => {
    assert.equal(
      hasLeadListActiveFilters(query({ manualOnly: true })),
      true
    );
  });

  test("a sort does not", () => {
    /*
     * A sorted view still shows every matching lead. Counting it as a filter
     * would light up "clear filters" over a cohort nothing was removed from.
     */
    for (const sort of LEAD_LIST_SORTS) {
      assert.equal(
        hasLeadListActiveFilters(query({ sort })),
        false,
        sort
      );
    }
  });

  test("an empty query is still unfiltered", () => {
    assert.equal(hasLeadListActiveFilters(query()), false);
  });
});

/* ====================================================================== */
/* The read model                                                         */
/* ====================================================================== */

describe("both new controls act on the whole cohort", () => {
  test("manualOnly filters before the page is cut", () => {
    const body = flat(code(QUERIES));

    assert.match(
      body,
      /const filtered = query\.manualOnly \? bucketed\.filter\(\(item\) => item\.manualSalesTemperature !== null\) : bucketed;/
    );

    /* Filter, then order, then slice — in that order. */
    const plain = code(QUERIES);
    const filterAt = plain.indexOf("const filtered = query.manualOnly");
    const orderAt = plain.indexOf("const ordered = orderLeadCohort(");
    const sliceAt = plain.indexOf("ordered.slice(");

    assert.ok(filterAt > 0 && orderAt > filterAt && sliceAt > orderAt);
  });

  test("manual means a person classified it, not a bucket value", () => {
    /*
     * A lead can reach HOT either by someone's judgement or by the score
     * engine. `manualSalesTemperature` is the only field that says which.
     */
    const body = code(QUERIES);

    assert.ok(body.includes("item.manualSalesTemperature !== null"));
    assert.ok(!body.includes('manualSalesTemperature === "hot"'));
  });

  test("the sort is applied by one function, from the caller's parameter", () => {
    assert.match(
      flat(code(QUERIES)),
      /const ordered = orderLeadCohort\(filtered, query\.sort, now\);/
    );
  });
});

/* ====================================================================== */
/* Ranking is reused, never restated                                      */
/* ====================================================================== */

describe("no second ranking was written", () => {
  test("priority is the canonical segmented comparator", () => {
    assert.match(
      code(QUERIES),
      /case "priority":\s*return sortSegmentedLeads\(leads, now\);/
    );

    assert.match(
      QUERIES,
      /import \{\s*sortSegmentedLeads,/
    );
  });

  test("newest is the canonical received comparator", () => {
    assert.match(
      code(QUERIES),
      /case "newest":\s*default:\s*return sortLeadsByReceivedNewestFirst\(leads\);/
    );
  });

  test("oldest is the exact inverse of newest, tie-break included", () => {
    /*
     * Negating the same comparator rather than writing a second one keeps the
     * two mirror images: no row can be dropped or repeated across pages
     * because the ascending order disagreed about a tie.
     */
    assert.match(
      flat(code(QUERIES)),
      /return \[\.\.\.leads\]\.sort\( \(left, right\) => -compareLeadsByReceivedNewestFirst\(left, right\) \);/
    );
  });

  test("the query layer carries no score, bucket or urgency policy of its own", () => {
    const ordering = code(QUERIES).slice(
      code(QUERIES).indexOf("function orderLeadCohort"),
      code(QUERIES).indexOf("ONE lead's canonical intelligence")
    );

    for (const invented of [
      "slaBreached",
      "newUncontacted",
      "deriveLeadScore",
      "resolveEffectiveSalesBucket",
      "HOT",
      "WARM",
      "weight",
    ]) {
      assert.ok(
        !ordering.includes(invented),
        `ordering must not reason about ${invented}`
      );
    }
  });
});

/* ====================================================================== */
/* Total orders                                                           */
/* ====================================================================== */

describe("every sort is a total order", () => {
  test("score and next_action both end in a stable id tie-break", () => {
    const ordering = code(QUERIES).slice(
      code(QUERIES).indexOf("function orderLeadCohort")
    );

    assert.equal(
      (ordering.match(/left\.id\.localeCompare\(right\.id\)/g) ?? []).length,
      2
    );
  });

  test("a lead with nothing scheduled sorts last under next_action", () => {
    /*
     * Sorting by "when is the next action" and leading with the ones that have
     * none would bury every action the owner opened the sort to find.
     */
    assert.match(
      flat(code(QUERIES)),
      /if \(leftDue === null \|\| rightDue === null\) \{ if \(leftDue !== rightDue\) \{ return leftDue === null \? 1 : -1; \} \}/
    );
  });

  test("score sorts high to low", () => {
    assert.match(
      flat(code(QUERIES)),
      /return right\.priorityScore - left\.priorityScore;/
    );
  });
});

/* ====================================================================== */
/* Compatibility                                                          */
/* ====================================================================== */

describe("the existing surfaces are untouched", () => {
  test("the mobile route still uses the shared parser and read model", () => {
    /*
     * The handler stays thin. It gained no knowledge of sorting — the phone
     * asks by parameter and the canonical read model answers.
     */
    assert.match(code(MOBILE_ROUTE), /parseLeadListQuery\(searchParams\)/);
    assert.match(
      code(MOBILE_ROUTE),
      /queryLeadListPage\(auth\.context, query, auth\.db\)/
    );

    for (const forbidden of ["sort", "manualOnly", "localeCompare"]) {
      assert.ok(
        !code(MOBILE_ROUTE).includes(forbidden),
        `the route must not handle ${forbidden} itself`
      );
    }
  });

  test("the web inbox keeps received order by sending no sort", () => {
    const page = read(
      "src", "app", "admin", "crm", "leads", "page.tsx"
    );

    /* It never asks for one, so it parses to null and behaves as before. */
    assert.ok(!code(page).includes("sort="));
  });

  test("received order is still the documented default", () => {
    assert.match(CONTRACT, /OMITTING THIS KEEPS TODAY'S BEHAVIOUR/);
    assert.match(QUERIES, /NULL IS RECEIVED ORDER/);
  });
});
