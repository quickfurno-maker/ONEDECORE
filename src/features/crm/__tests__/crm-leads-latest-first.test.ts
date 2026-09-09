/**
 * THE LEADS WORKSPACE IS AN INBOX. NEWEST RECEIVED FIRST.
 *
 * THE PROBLEM
 *
 * `/admin/crm/leads` inherited the sales-priority comparator that ranks by
 * bucket, score and urgency. That is the right answer for a work queue and the
 * wrong one for an inbox: a fresh enquiry could sit below week-old HOT leads,
 * so the owner opened the page after a lead arrived and could not see it. To
 * someone who has just been told their intake is fixed, a missing new lead
 * looks exactly like a lost one.
 *
 * THE DECISION THIS SUITE PINS
 *
 *   /admin/crm/leads     chronological inbox   createdAt DESC, id DESC
 *   /admin/crm/pipeline  priority workspace    unchanged
 *   Dashboard Recent     small direct read     unchanged
 *
 * The central test is `priority must not override received time`: it builds a
 * cohort where the two orders DISAGREE — an old HOT, SLA-breached, score-95
 * lead against a new COLD, score-0 one — and asserts the inbox puts the new
 * lead first while the priority comparator still puts the old one first. That
 * disagreement is the whole point; if both orders ever agree on that fixture,
 * the test has stopped proving anything.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  compareLeadsByReceivedNewestFirst,
  sortLeadsByReceivedNewestFirst,
} from "../contracts/lead-received-order.ts";
import { compareSegmentedLeads } from "../contracts/lead-segmentation-order.ts";
import type { CrmLeadSalesBucket } from "../contracts/lead-sales-bucket.ts";
import { trimCohortRows } from "../contracts/lead-cohort-limits.ts";

const root = process.cwd();
const read = (rel: string) =>
  readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

const QUERIES = "src/features/crm/server/crm-lead-queries.ts";

/** A lead as the workspace sees it, with only the fields these orders read. */
interface TestLead {
  readonly id: string;
  readonly createdAt: string;
  readonly salesBucket: CrmLeadSalesBucket;
  readonly priorityScore: number;
  readonly primaryNextActionDueAt: string | null;
  readonly slaBreached: boolean;
  readonly newUncontacted: boolean;
  /*
   * Required by `CrmSortableLead` so the same fixture can be handed to the
   * priority comparator. Receipt order must never read it — test G asserts
   * that the ordering module does not mention it at all.
   */
  readonly stageEnteredAt: string;
  readonly updatedAt?: string;
  readonly status?: string;
}

function lead(over: Partial<TestLead> & Pick<TestLead, "id" | "createdAt">): TestLead {
  return {
    salesBucket: "COLD",
    priorityScore: 0,
    primaryNextActionDueAt: null,
    slaBreached: false,
    newUncontacted: false,
    // Defaults to receipt time; overridden where a test needs them to differ.
    stageEnteredAt: over.createdAt,
    ...over,
  };
}

const ids = (leads: readonly TestLead[]) => leads.map((l) => l.id);

describe("A. newest received first", () => {
  test("a newer lead comes before an older one", () => {
    const older = lead({ id: "a", createdAt: "2026-09-01T10:00:00.000Z" });
    const newer = lead({ id: "b", createdAt: "2026-09-09T10:00:00.000Z" });
    assert.deepEqual(ids(sortLeadsByReceivedNewestFirst([older, newer])), ["b", "a"]);
    assert.deepEqual(ids(sortLeadsByReceivedNewestFirst([newer, older])), ["b", "a"]);
  });

  test("a whole cohort lands in strict receipt order", () => {
    const cohort = [
      lead({ id: "c", createdAt: "2026-09-05T00:00:00.000Z" }),
      lead({ id: "a", createdAt: "2026-09-09T00:00:00.000Z" }),
      lead({ id: "d", createdAt: "2026-08-30T00:00:00.000Z" }),
      lead({ id: "b", createdAt: "2026-09-07T00:00:00.000Z" }),
    ];
    assert.deepEqual(ids(sortLeadsByReceivedNewestFirst(cohort)), ["a", "b", "c", "d"]);
  });

  test("sorting never mutates the caller's array", () => {
    const cohort = [
      lead({ id: "old", createdAt: "2026-09-01T00:00:00.000Z" }),
      lead({ id: "new", createdAt: "2026-09-09T00:00:00.000Z" }),
    ];
    const before = ids(cohort);
    sortLeadsByReceivedNewestFirst(cohort);
    assert.deepEqual(ids(cohort), before);
  });
});

describe("B. priority must not override received time", () => {
  /*
   * THE CENTRAL TEST. The two orders are made to disagree deliberately.
   */
  const oldHot = lead({
    id: "old-hot",
    createdAt: "2026-09-01T09:00:00.000Z",
    salesBucket: "HOT",
    priorityScore: 95,
    slaBreached: true,
    newUncontacted: true,
    primaryNextActionDueAt: "2026-09-01T10:00:00.000Z",
  });
  const newCold = lead({
    id: "new-cold",
    createdAt: "2026-09-09T09:00:00.000Z",
    salesBucket: "COLD",
    priorityScore: 0,
  });

  test("the inbox puts the NEW low-priority lead first", () => {
    assert.deepEqual(ids(sortLeadsByReceivedNewestFirst([oldHot, newCold])), [
      "new-cold",
      "old-hot",
    ]);
  });

  test("the priority comparator still puts the OLD hot lead first", () => {
    // Proof of separation: the pipeline's answer is unchanged and opposite.
    assert.ok(
      compareSegmentedLeads(oldHot, newCold, Date.parse("2026-09-09T12:00:00.000Z")) < 0,
      "sales priority must still rank the HOT, breached, high-score lead first"
    );
  });

  test("the two orders genuinely disagree on this fixture", () => {
    /*
     * A guard on the guard. If a future change made priority order agree with
     * receipt order here, the test above would pass while proving nothing.
     */
    const byReceipt = ids(sortLeadsByReceivedNewestFirst([oldHot, newCold]));
    const byPriority = [oldHot, newCold]
      .slice()
      .sort((l, r) => compareSegmentedLeads(l, r, Date.now()))
      .map((l) => l.id);
    assert.notDeepEqual(byReceipt, byPriority);
  });

  test("score alone never reorders the inbox", () => {
    const cohort = [
      lead({ id: "low-new", createdAt: "2026-09-09T00:00:00.000Z", priorityScore: 1 }),
      lead({ id: "high-old", createdAt: "2026-09-02T00:00:00.000Z", priorityScore: 99 }),
    ];
    assert.deepEqual(ids(sortLeadsByReceivedNewestFirst(cohort)), ["low-new", "high-old"]);
  });
});

describe("C. urgency must not override received time", () => {
  test("an SLA-breached, due-now old lead still sits below a new one", () => {
    const urgentOld = lead({
      id: "urgent-old",
      createdAt: "2026-09-03T00:00:00.000Z",
      slaBreached: true,
      newUncontacted: true,
      primaryNextActionDueAt: "2026-09-03T01:00:00.000Z",
      salesBucket: "HOT",
      priorityScore: 80,
    });
    const calmNew = lead({ id: "calm-new", createdAt: "2026-09-09T00:00:00.000Z" });
    assert.deepEqual(ids(sortLeadsByReceivedNewestFirst([urgentOld, calmNew])), [
      "calm-new",
      "urgent-old",
    ]);
  });
});

describe("D. filters narrow, they do not re-sort", () => {
  const cohort = [
    lead({ id: "hot-old", createdAt: "2026-09-02T00:00:00.000Z", salesBucket: "HOT" }),
    lead({ id: "cold-newest", createdAt: "2026-09-09T00:00:00.000Z", salesBucket: "COLD" }),
    lead({ id: "hot-new", createdAt: "2026-09-08T00:00:00.000Z", salesBucket: "HOT" }),
    lead({ id: "hot-mid", createdAt: "2026-09-05T00:00:00.000Z", salesBucket: "HOT" }),
  ];

  test("a bucket filter selects, then receipt order applies", () => {
    // Exactly what the query path does: filter the cohort, then order it.
    const filtered = cohort.filter((l) => l.salesBucket === "HOT");
    assert.deepEqual(ids(sortLeadsByReceivedNewestFirst(filtered)), [
      "hot-new",
      "hot-mid",
      "hot-old",
    ]);
  });

  test("a status filter behaves the same way", () => {
    const withStatus = cohort.map((l, i) => ({ ...l, status: i % 2 === 0 ? "new" : "contacted" }));
    const filtered = withStatus.filter((l) => l.status === "new");
    const ordered = sortLeadsByReceivedNewestFirst(filtered);
    for (let i = 1; i < ordered.length; i += 1) {
      assert.ok(
        Date.parse(ordered[i - 1]!.createdAt) >= Date.parse(ordered[i]!.createdAt),
        "a filtered list must still be newest-first"
      );
    }
  });
});

describe("E. ordering happens before pagination", () => {
  const cohort = Array.from({ length: 57 }, (_, i) =>
    lead({
      id: `lead-${String(i).padStart(3, "0")}`,
      // i ascending = older; so the LAST index is the newest lead.
      createdAt: new Date(Date.parse("2026-08-01T00:00:00.000Z") + i * 3_600_000).toISOString(),
      priorityScore: i % 7,
      salesBucket: i % 3 === 0 ? "HOT" : "COLD",
    })
  );
  const ordered = sortLeadsByReceivedNewestFirst(cohort);
  const pageSize = 25;
  const page = (n: number) => ordered.slice((n - 1) * pageSize, (n - 1) * pageSize + pageSize);

  test("page 1 holds the newest rows", () => {
    assert.equal(page(1)[0]!.id, "lead-056", "the newest lead must be first on page 1");
    assert.equal(page(1).length, pageSize);
  });

  test("later pages hold strictly older rows", () => {
    const lastOfPage1 = Date.parse(page(1).at(-1)!.createdAt);
    const firstOfPage2 = Date.parse(page(2)[0]!.createdAt);
    assert.ok(lastOfPage1 >= firstOfPage2);
  });

  test("paging covers every lead exactly once", () => {
    const seen = [...page(1), ...page(2), ...page(3)].map((l) => l.id);
    assert.equal(seen.length, cohort.length, "no lead may be dropped");
    assert.equal(new Set(seen).size, cohort.length, "no lead may be duplicated");
  });
});

describe("F. the tie-break is deterministic", () => {
  const sameInstant = "2026-09-06T05:48:19.871945Z";

  test("identical createdAt falls back to id DESC", () => {
    const cohort = [
      lead({ id: "a", createdAt: sameInstant }),
      lead({ id: "c", createdAt: sameInstant }),
      lead({ id: "b", createdAt: sameInstant }),
    ];
    assert.deepEqual(ids(sortLeadsByReceivedNewestFirst(cohort)), ["c", "b", "a"]);
  });

  test("the result does not depend on input order", () => {
    /*
     * A bulk import writes hundreds of rows sharing created_at to the
     * microsecond. Without a second key, page 2 could repeat a row page 1
     * already showed.
     */
    const build = (order: readonly string[]) =>
      ids(sortLeadsByReceivedNewestFirst(order.map((id) => lead({ id, createdAt: sameInstant }))));
    assert.deepEqual(build(["a", "b", "c"]), build(["c", "a", "b"]));
    assert.deepEqual(build(["b", "c", "a"]), ["c", "b", "a"]);
  });

  test("the comparator is antisymmetric", () => {
    const l = lead({ id: "x", createdAt: sameInstant });
    const r = lead({ id: "y", createdAt: sameInstant });
    assert.ok(compareLeadsByReceivedNewestFirst(l, r) > 0);
    assert.ok(compareLeadsByReceivedNewestFirst(r, l) < 0);
    assert.equal(compareLeadsByReceivedNewestFirst(l, l), 0);
  });
});

describe("G. only receipt time counts", () => {
  test("a recently EDITED old lead does not jump the queue", () => {
    const editedOld = lead({
      id: "edited-old",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-09T23:59:00.000Z",
    });
    const untouchedNew = lead({
      id: "untouched-new",
      createdAt: "2026-09-08T00:00:00.000Z",
      updatedAt: "2026-09-08T00:00:00.000Z",
    });
    assert.deepEqual(ids(sortLeadsByReceivedNewestFirst([editedOld, untouchedNew])), [
      "untouched-new",
      "edited-old",
    ]);
  });

  test("the order module reads nothing but id and createdAt", () => {
    const src = read("src/features/crm/contracts/lead-received-order.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const forbidden of [
      "updatedAt",
      "stageEnteredAt",
      "priorityScore",
      "salesBucket",
      "slaBreached",
      "manualSalesTemperature",
      "primaryNextActionDueAt",
    ]) {
      assert.doesNotMatch(src, new RegExp(forbidden), `${forbidden} must not affect receipt order`);
    }
  });
});

describe("H. terminal and parked leads use the same rule", () => {
  test("a newly received LOST lead is not pushed to the bottom", () => {
    /*
     * The priority comparator deliberately sinks terminal work below active
     * work. An inbox must not: it reports what arrived, not what to do.
     */
    const lostNew = lead({ id: "lost-new", createdAt: "2026-09-09T00:00:00.000Z", salesBucket: "LOST" });
    const hotOld = lead({ id: "hot-old", createdAt: "2026-09-01T00:00:00.000Z", salesBucket: "HOT", priorityScore: 90 });
    assert.deepEqual(ids(sortLeadsByReceivedNewestFirst([hotOld, lostNew])), [
      "lost-new",
      "hot-old",
    ]);
    // And the priority comparator still sinks it, unchanged.
    assert.ok(compareSegmentedLeads(hotOld, lostNew, Date.now()) < 0);
  });
});

describe("I. truncation must never discard the newest leads", () => {
  const CEILING = 10;
  // 30 leads, oldest first, exactly as a DB scan would surface them.
  const oldestFirst = Array.from({ length: 30 }, (_, i) =>
    lead({
      id: `row-${String(i).padStart(2, "0")}`,
      createdAt: new Date(Date.parse("2026-09-01T00:00:00.000Z") + i * 60_000).toISOString(),
    })
  );
  const newestFirst = [...oldestFirst].reverse();

  test("an oldest-first scan would drop the newest lead — the bug", () => {
    const kept = trimCohortRows(oldestFirst, CEILING);
    assert.equal(kept.length, CEILING);
    assert.ok(
      !kept.some((l) => l.id === "row-29"),
      "this is exactly why the scan direction had to change"
    );
  });

  test("a newest-first scan keeps the newest lead", () => {
    const kept = trimCohortRows(newestFirst, CEILING);
    assert.equal(kept.length, CEILING);
    assert.equal(
      sortLeadsByReceivedNewestFirst(kept)[0]!.id,
      "row-29",
      "the newest lead must survive the ceiling"
    );
  });

  test("the cohort scan actually reads newest first", () => {
    const src = read(QUERIES);
    const scan = src.slice(src.indexOf("async function readCohortRows("));
    const base = scan.slice(scan.indexOf("const baseRequest"), scan.indexOf("LeadListFilterBuilder"));
    assert.match(base, /\.order\("created_at", \{ ascending: false \}\)/);
    assert.match(base, /\.order\("id", \{ ascending: false \}\)/);
  });
});

describe("J. the other surfaces are untouched", () => {
  test("the pipeline keeps its own priority ranking", () => {
    const pipeline = read("src/features/crm/server/crm-pipeline-queries.ts");
    assert.match(pipeline, /sortPipelineCards\(cards, now\)/);
    // The pipeline reads its own cohort and must not borrow the inbox order.
    assert.doesNotMatch(pipeline, /sortLeadsByReceivedNewestFirst/);
  });

  test("the priority comparator still exists for it", () => {
    // Deleting it to fix the inbox would have taken the pipeline with it.
    const order = read("src/features/crm/contracts/lead-segmentation-order.ts");
    assert.match(order, /export function compareSegmentedLeads/);
    assert.match(order, /export function sortSegmentedLeads/);
  });

  test("K. dashboard Recent Leads is still its own direct read", () => {
    const src = read(QUERIES);
    const block = src.slice(src.indexOf("export async function queryRecentLeads("));
    const head = block.slice(0, 1200);
    assert.match(head, /\.order\("created_at", \{ ascending: false \}\)/);
    assert.match(head, /\.order\("id", \{ ascending: false \}\)/);
    assert.match(head, /\.limit\(limit\)/);
    // No score fan-out on the dashboard panel.
    assert.doesNotMatch(head, /fetchLeadScoreBatch/);
  });
});
