import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  CRM_LEAD_SALES_BUCKETS,
  countSalesBuckets,
  emptySalesBucketCounts,
  isActiveSalesBucket,
  leadSalesBucketRank,
  parseLeadSalesBucketParam,
  resolveLeadSalesBucket,
  type CrmLeadSalesBucket,
} from "../contracts/lead-sales-bucket.ts";
import {
  CRM_LEAD_SCORE_BAND_MIN,
  resolveScoreBand,
  type CrmLeadScoreBand,
} from "../contracts/lead-score-contracts.ts";
import {
  IST_OFFSET_MINUTES,
  LEAD_MONTH_ALL_COHORT,
  canAdvanceLeadMonth,
  currentLeadMonthCohort,
  istMonthStartUtcMs,
  parseLeadMonthParam,
  shiftLeadMonthCohort,
} from "../contracts/lead-month-cohort.ts";
import {
  buildLeadListHref,
  hasLeadListActiveFilters,
  parseLeadListQuery,
  type LeadListQuery,
} from "../contracts/lead-list-query.ts";
import {
  compareSegmentedLeads,
  sortSegmentedLeads,
  type CrmSortableLead,
} from "../contracts/lead-segmentation-order.ts";
import {
  CRM_LEAD_ID_CHUNK_SIZE,
  chunkLeadIds,
} from "../contracts/lead-batch-chunking.ts";
import type { LeadStageCode } from "../contracts/lead-stages.ts";

const root = process.cwd();
const read = (rel: string) =>
  readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

const QUERIES = "src/features/crm/server/crm-lead-queries.ts";
const BATCH = "src/features/crm/server/crm-lead-score-batch.ts";
const PIPELINE = "src/features/crm/server/crm-pipeline-queries.ts";
const TABLE = "src/features/crm/components/leads/LeadListTable.tsx";
const CARDS = "src/features/crm/components/leads/LeadListCards.tsx";
const STRIP = "src/features/crm/components/leads/LeadSalesBucketStrip.tsx";
const HEADER = "src/features/crm/components/leads/LeadCommandHeader.tsx";
const PAGE = "src/app/admin/crm/leads/page.tsx";
const SCORE = "src/features/crm/contracts/lead-score-contracts.ts";

/* ========================================================================== */
/* 1. Bucket resolution                                                        */
/* ========================================================================== */

describe("the sales bucket is deterministic", () => {
  const ACTIVE: LeadStageCode = "qualified";

  test("an active HOT score is HOT", () => {
    assert.equal(resolveLeadSalesBucket(ACTIVE, "HOT"), "HOT");
  });

  test("an active WARM score is WARM", () => {
    assert.equal(resolveLeadSalesBucket(ACTIVE, "WARM"), "WARM");
  });

  test("an active NURTURE score presents as COLD", () => {
    // The owner asked for a HOT/WARM/COLD language. NURTURE stays in the score
    // engine; only the user-facing bucket collapses it.
    assert.equal(resolveLeadSalesBucket(ACTIVE, "NURTURE"), "COLD");
  });

  test("an active COLD score is COLD", () => {
    assert.equal(resolveLeadSalesBucket(ACTIVE, "COLD"), "COLD");
  });

  test("closed_lost is LOST whatever the derived band says", () => {
    for (const band of ["HOT", "WARM", "NURTURE", "COLD"] as CrmLeadScoreBand[]) {
      assert.equal(resolveLeadSalesBucket("closed_lost", band), "LOST");
    }
  });

  test("closed_won is WON whatever the derived band says", () => {
    for (const band of ["HOT", "WARM", "NURTURE", "COLD"] as CrmLeadScoreBand[]) {
      assert.equal(resolveLeadSalesBucket("closed_won", band), "WON");
    }
  });

  test("on_hold is ON_HOLD whatever the derived band says", () => {
    for (const band of ["HOT", "WARM", "NURTURE", "COLD"] as CrmLeadScoreBand[]) {
      assert.equal(resolveLeadSalesBucket("on_hold", band), "ON_HOLD");
    }
  });

  test("LOST is never a temperature — it cannot be reached by scoring alone", () => {
    const activeStages: LeadStageCode[] = [
      "new",
      "assigned",
      "contacted",
      "qualified",
      "consultation_scheduled",
      "proposal_sent",
      "negotiation",
    ];
    for (const status of activeStages) {
      for (const band of ["HOT", "WARM", "NURTURE", "COLD"] as CrmLeadScoreBand[]) {
        const bucket = resolveLeadSalesBucket(status, band);
        assert.ok(
          isActiveSalesBucket(bucket),
          `${status}/${band} must stay in an active bucket, got ${bucket}`
        );
      }
    }
  });

  test("the score thresholds are untouched", () => {
    assert.equal(CRM_LEAD_SCORE_BAND_MIN.HOT, 70);
    assert.equal(CRM_LEAD_SCORE_BAND_MIN.WARM, 45);
    assert.equal(CRM_LEAD_SCORE_BAND_MIN.NURTURE, 20);
    assert.equal(CRM_LEAD_SCORE_BAND_MIN.COLD, 0);
    assert.equal(resolveScoreBand(70), "HOT");
    assert.equal(resolveScoreBand(69), "WARM");
    assert.equal(resolveScoreBand(44), "NURTURE");
    assert.equal(resolveScoreBand(19), "COLD");
  });

  test("NURTURE is collapsed ONLY at the presentation layer", () => {
    // The score engine must still know all four bands.
    const scoreSource = read(SCORE);
    assert.match(scoreSource, /"HOT", "WARM", "NURTURE", "COLD"/);
    assert.match(scoreSource, /NURTURE: 20/);
    // And no threshold was moved into the bucket layer.
    const bucketSource = read("src/features/crm/contracts/lead-sales-bucket.ts");
    assert.doesNotMatch(bucketSource, /\b70\b/);
    assert.doesNotMatch(bucketSource, /\b45\b/);
    assert.doesNotMatch(bucketSource, /priorityScore\s*>=/);
  });

  test("a brand-new unworked lead lands in COLD", () => {
    // Matches current managed production: every lead is stage `new`, so the
    // workspace shows them as COLD without any seeded data.
    assert.equal(resolveLeadSalesBucket("new", resolveScoreBand(0)), "COLD");
  });

  test("the URL token round-trips and rejects nonsense", () => {
    for (const bucket of CRM_LEAD_SALES_BUCKETS) {
      const param = bucket.toLowerCase();
      assert.equal(parseLeadSalesBucketParam(param), bucket);
    }
    assert.equal(parseLeadSalesBucketParam("HOT"), "HOT");
    assert.equal(parseLeadSalesBucketParam("lukewarm"), null);
    assert.equal(parseLeadSalesBucketParam(""), null);
    assert.equal(parseLeadSalesBucketParam(undefined), null);
  });
});

/* ========================================================================== */
/* 2. Month cohort                                                             */
/* ========================================================================== */

describe("the received-month cohort is IST-correct", () => {
  test("Asia/Kolkata is a fixed +05:30", () => {
    assert.equal(IST_OFFSET_MINUTES, 330);
  });

  test("a September 2026 boundary starts at 18:30 UTC on 31 August", () => {
    const cohort = parseLeadMonthParam("2026-09");
    assert.equal(cohort.startIso, "2026-08-31T18:30:00.000Z");
    assert.equal(cohort.endIso, "2026-09-30T18:30:00.000Z");
    assert.equal(cohort.label, "September 2026");
    assert.equal(cohort.isAllTime, false);
  });

  test("a lead at 00:00 IST on the 1st belongs to the new month, not the old", () => {
    const september = parseLeadMonthParam("2026-09");
    const august = parseLeadMonthParam("2026-08");
    const boundary = Date.parse("2026-08-31T18:30:00.000Z");
    // Half-open [start, end): the boundary instant is September's, not August's.
    assert.equal(Date.parse(september.startIso!), boundary);
    assert.equal(Date.parse(august.endIso!), boundary);
    assert.ok(Date.parse(august.endIso!) === Date.parse(september.startIso!));
  });

  test("an instant just before the boundary is still the previous month", () => {
    const august = parseLeadMonthParam("2026-08");
    const justBefore = Date.parse("2026-08-31T18:29:59.999Z");
    assert.ok(justBefore >= Date.parse(august.startIso!));
    assert.ok(justBefore < Date.parse(august.endIso!));
  });

  test("December rolls into the next January", () => {
    const december = parseLeadMonthParam("2026-12");
    assert.equal(december.endIso, "2026-12-31T18:30:00.000Z");
    const next = shiftLeadMonthCohort(december, 1);
    assert.equal(next?.param, "2027-01");
    assert.equal(next?.label, "January 2027");
  });

  test("January rolls back into the previous December", () => {
    const january = parseLeadMonthParam("2027-01");
    const previous = shiftLeadMonthCohort(january, -1);
    assert.equal(previous?.param, "2026-12");
    assert.equal(previous?.label, "December 2026");
  });

  test("istMonthStartUtcMs normalizes an overflowing month", () => {
    assert.equal(
      istMonthStartUtcMs(2026, 13),
      istMonthStartUtcMs(2027, 1),
      "month 13 must equal January of the next year"
    );
    assert.equal(
      istMonthStartUtcMs(2026, 0),
      istMonthStartUtcMs(2025, 12),
      "month 0 must equal December of the previous year"
    );
  });

  test("`all` is honoured explicitly", () => {
    const cohort = parseLeadMonthParam("all");
    assert.equal(cohort.isAllTime, true);
    assert.equal(cohort.startIso, null);
    assert.equal(cohort.endIso, null);
    assert.equal(cohort.param, LEAD_MONTH_ALL_COHORT.param);
  });

  test("invalid input falls back to the current IST month, never to all-time", () => {
    // 05:00 UTC on 1 Sep is already 10:30 IST on 1 Sep.
    const now = Date.parse("2026-09-01T05:00:00.000Z");
    for (const bad of [
      undefined,
      null,
      "",
      "   ",
      "2026-13",
      "2026-00",
      "26-09",
      "2026-9",
      "September",
      "1999-09",
      "3200-01",
      "2026-09-04",
      "../../etc",
    ]) {
      const cohort = parseLeadMonthParam(bad, now);
      assert.equal(cohort.isAllTime, false, `${String(bad)} must not widen to all-time`);
      assert.equal(cohort.param, "2026-09", `${String(bad)} must fall back to the current month`);
    }
  });

  test("the current month is read in IST, not UTC", () => {
    // 20:00 UTC on 31 August is already 01:30 IST on 1 September.
    const lateAugustUtc = Date.parse("2026-08-31T20:00:00.000Z");
    assert.equal(currentLeadMonthCohort(lateAugustUtc).param, "2026-09");
    // And 18:00 UTC on 31 August is still 23:30 IST on 31 August.
    const stillAugust = Date.parse("2026-08-31T18:00:00.000Z");
    assert.equal(currentLeadMonthCohort(stillAugust).param, "2026-08");
  });

  test("forward navigation stops at a month that has not started", () => {
    const now = Date.parse("2026-09-10T05:00:00.000Z");
    assert.equal(canAdvanceLeadMonth(parseLeadMonthParam("2026-08"), now), true);
    assert.equal(canAdvanceLeadMonth(parseLeadMonthParam("2026-09"), now), false);
    assert.equal(canAdvanceLeadMonth(LEAD_MONTH_ALL_COHORT, now), false);
  });

  test("the cohort is filtered on created_at, never updated_at", () => {
    const src = read(QUERIES);
    assert.match(src, /\.gte\("created_at", query\.month\.startIso\)/);
    assert.match(src, /\.lt\("created_at", query\.month\.endIso\)/);
    assert.doesNotMatch(src, /gte\("updated_at"/);
    assert.doesNotMatch(src, /lt\("updated_at"/);
    // The old recency sort is gone: it answered "recently touched", not
    // "who should sales call next".
    assert.doesNotMatch(src, /order\("updated_at"/);
  });
});

/* ========================================================================== */
/* 3. Query contract                                                           */
/* ========================================================================== */

describe("the list query carries bucket and month without disturbing the rest", () => {
  const NOW = Date.parse("2026-09-04T06:00:00.000Z");

  test("every pre-existing filter still parses", () => {
    const query = parseLeadListQuery(
      {
        q: "  rahul   sharma ",
        status: "qualified",
        sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        assignment: "assigned",
        assigneeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        followUpDue: "overdue",
        page: "3",
        pageSize: "10",
      },
      NOW
    );
    assert.equal(query.q, "rahul sharma");
    assert.equal(query.status, "qualified");
    assert.equal(query.sourceId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    assert.equal(query.assignment, "assigned");
    assert.equal(query.assigneeId, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    assert.equal(query.followUpDue, "overdue");
    assert.equal(query.page, 3);
    assert.equal(query.pageSize, 10);
  });

  test("bucket and month parse, and default sensibly", () => {
    const explicit = parseLeadListQuery({ bucket: "hot", month: "2026-08" }, NOW);
    assert.equal(explicit.bucket, "HOT");
    assert.equal(explicit.month.param, "2026-08");

    const defaulted = parseLeadListQuery({}, NOW);
    assert.equal(defaulted.bucket, null);
    assert.equal(defaulted.month.param, "2026-09");
  });

  test("status and bucket coexist — neither mutates the other", () => {
    const query = parseLeadListQuery(
      { status: "negotiation", bucket: "cold" },
      NOW
    );
    assert.equal(query.status, "negotiation");
    assert.equal(query.bucket, "COLD");

    // Clearing one leaves the other intact.
    const clearedStatus = buildLeadListHref(query, "status");
    assert.doesNotMatch(clearedStatus, /status=/);
    assert.match(clearedStatus, /bucket=cold/);

    const clearedBucket = buildLeadListHref(query, "bucket");
    assert.doesNotMatch(clearedBucket, /bucket=/);
    assert.match(clearedBucket, /status=negotiation/);
  });

  test("month and bucket survive clearing any other filter", () => {
    const query = parseLeadListQuery(
      {
        q: "rahul",
        status: "qualified",
        sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        assignment: "assigned",
        assigneeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        followUpDue: "today",
        bucket: "warm",
        month: "2026-08",
      },
      NOW
    );

    for (const clear of [
      "q",
      "status",
      "sourceId",
      "assignment",
      "assigneeId",
      "followUpDue",
    ] as const) {
      const href = buildLeadListHref(query, clear);
      assert.match(href, /month=2026-08/, `month lost when clearing ${clear}`);
      assert.match(href, /bucket=warm/, `bucket lost when clearing ${clear}`);
    }
  });

  test("month and bucket survive pagination links", () => {
    const query = parseLeadListQuery(
      { bucket: "hot", month: "2026-08", pageSize: "10" },
      NOW
    );
    const href = buildLeadListHref(query, undefined, { page: 4 });
    assert.match(href, /page=4/);
    assert.match(href, /month=2026-08/);
    assert.match(href, /bucket=hot/);
    assert.match(href, /pageSize=10/);
  });

  test("selecting a bucket or month resets to page 1", () => {
    const src = read(STRIP);
    assert.match(src, /buildLeadListHref\(query, undefined, \{ bucket, page: 1 \}\)/);
    const monthSrc = read(
      "src/features/crm/components/leads/LeadMonthSelector.tsx"
    );
    assert.match(monthSrc, /\{ month, page: 1 \}/);
  });

  test("all-time stays in the URL; the default month stays implicit", () => {
    const allTime = parseLeadListQuery({ month: "all" }, NOW);
    assert.match(buildLeadListHref(allTime), /month=all/);

    const current = parseLeadListQuery({}, NOW);
    const href = buildLeadListHref(current);
    assert.match(href, /month=2026-09/);
  });

  test("bucket counts as an active filter; the always-present month does not", () => {
    const bare = parseLeadListQuery({}, NOW);
    assert.equal(hasLeadListActiveFilters(bare), false);

    const bucketed = parseLeadListQuery({ bucket: "hot" }, NOW);
    assert.equal(hasLeadListActiveFilters(bucketed), true);

    // A month is ALWAYS set, so treating it as an active filter would leave the
    // "clear filters" affordance permanently armed.
    const monthOnly = parseLeadListQuery({ month: "2026-08" }, NOW);
    assert.equal(hasLeadListActiveFilters(monthOnly), false);
  });
});

/* ========================================================================== */
/* 4. Ordering                                                                 */
/* ========================================================================== */

const BASE: CrmSortableLead = {
  id: "00000000-0000-4000-8000-000000000000",
  salesBucket: "COLD",
  priorityScore: 0,
  nextFollowUpDue: null,
  slaBreached: false,
  newUncontacted: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  stageEnteredAt: "2026-09-01T00:00:00.000Z",
};

const lead = (over: Partial<CrmSortableLead>): CrmSortableLead => ({
  ...BASE,
  ...over,
});

describe("segmented ordering answers 'who do I call next'", () => {
  const NOW = Date.parse("2026-09-10T06:00:00.000Z");

  test("HOT outranks WARM outranks COLD", () => {
    const sorted = sortSegmentedLeads(
      [
        lead({ id: "c", salesBucket: "COLD", priorityScore: 99 }),
        lead({ id: "w", salesBucket: "WARM", priorityScore: 50 }),
        lead({ id: "h", salesBucket: "HOT", priorityScore: 70 }),
      ],
      NOW
    );
    assert.deepEqual(sorted.map((entry) => entry.id), ["h", "w", "c"]);
  });

  test("a higher score wins inside a bucket", () => {
    const sorted = sortSegmentedLeads(
      [
        lead({ id: "low", salesBucket: "HOT", priorityScore: 71 }),
        lead({ id: "high", salesBucket: "HOT", priorityScore: 95 }),
      ],
      NOW
    );
    assert.deepEqual(sorted.map((entry) => entry.id), ["high", "low"]);
  });

  test("on an equal score, urgency breaks the tie", () => {
    const sorted = sortSegmentedLeads(
      [
        lead({ id: "calm", salesBucket: "HOT", priorityScore: 80, nextFollowUpDue: "2026-09-20T06:00:00.000Z" }),
        lead({ id: "breach", salesBucket: "HOT", priorityScore: 80, slaBreached: true }),
        lead({ id: "overdue", salesBucket: "HOT", priorityScore: 80, nextFollowUpDue: "2026-09-01T06:00:00.000Z" }),
      ],
      NOW
    );
    // sla_breach (0) -> no_next_action (1) -> overdue (2) -> ... -> upcoming (5)
    assert.deepEqual(sorted.map((entry) => entry.id), ["breach", "overdue", "calm"]);
  });

  test("on equal score and urgency, the earlier next action wins", () => {
    const sorted = sortSegmentedLeads(
      [
        lead({ id: "later", salesBucket: "WARM", priorityScore: 50, nextFollowUpDue: "2026-09-25T06:00:00.000Z" }),
        lead({ id: "sooner", salesBucket: "WARM", priorityScore: 50, nextFollowUpDue: "2026-09-20T06:00:00.000Z" }),
      ],
      NOW
    );
    assert.deepEqual(sorted.map((entry) => entry.id), ["sooner", "later"]);
  });

  test("still tied, the older received lead wins", () => {
    const sorted = sortSegmentedLeads(
      [
        lead({ id: "newer", salesBucket: "COLD", createdAt: "2026-09-05T00:00:00.000Z" }),
        lead({ id: "older", salesBucket: "COLD", createdAt: "2026-09-01T00:00:00.000Z" }),
      ],
      NOW
    );
    assert.deepEqual(sorted.map((entry) => entry.id), ["older", "newer"]);
  });

  test("fully tied rows fall back to a stable id order", () => {
    const a = lead({ id: "aaaa" });
    const b = lead({ id: "bbbb" });
    assert.ok(compareSegmentedLeads(a, b, NOW) < 0);
    assert.ok(compareSegmentedLeads(b, a, NOW) > 0);
    assert.equal(compareSegmentedLeads(a, a, NOW), 0);

    // Order is independent of input order — pagination must be reproducible.
    const forward = sortSegmentedLeads([a, b], NOW).map((entry) => entry.id);
    const backward = sortSegmentedLeads([b, a], NOW).map((entry) => entry.id);
    assert.deepEqual(forward, backward);
  });

  test("active work outranks terminal and parked work in the mixed view", () => {
    const sorted = sortSegmentedLeads(
      [
        lead({ id: "lost", salesBucket: "LOST", priorityScore: 100 }),
        lead({ id: "won", salesBucket: "WON", priorityScore: 100 }),
        lead({ id: "hold", salesBucket: "ON_HOLD", priorityScore: 100 }),
        lead({ id: "cold", salesBucket: "COLD", priorityScore: 1 }),
      ],
      NOW
    );
    assert.equal(sorted[0]!.id, "cold", "LOST must never head a conversion queue");
    assert.deepEqual(sorted.map((entry) => entry.id), ["cold", "hold", "won", "lost"]);
  });

  test("LOST, WON and ON_HOLD order by newest closure first", () => {
    for (const bucket of ["LOST", "WON", "ON_HOLD"] as CrmLeadSalesBucket[]) {
      const sorted = sortSegmentedLeads(
        [
          lead({ id: "old", salesBucket: bucket, stageEnteredAt: "2026-09-01T00:00:00.000Z" }),
          lead({ id: "new", salesBucket: bucket, stageEnteredAt: "2026-09-09T00:00:00.000Z" }),
        ],
        NOW
      );
      assert.deepEqual(
        sorted.map((entry) => entry.id),
        ["new", "old"],
        `${bucket} must lead with the most recent transition`
      );
    }
  });

  test("a terminal row with no stage-entry event still orders safely", () => {
    const sorted = sortSegmentedLeads(
      [
        lead({ id: "missing", salesBucket: "LOST", stageEnteredAt: "not-a-date", createdAt: "2026-09-02T00:00:00.000Z" }),
        lead({ id: "known", salesBucket: "LOST", stageEnteredAt: "2026-09-08T00:00:00.000Z" }),
      ],
      NOW
    );
    // Falls back to createdAt rather than throwing or landing arbitrarily.
    assert.deepEqual(sorted.map((entry) => entry.id), ["known", "missing"]);
  });

  test("bucket rank keeps the active queues grouped", () => {
    assert.ok(leadSalesBucketRank("HOT") < leadSalesBucketRank("WARM"));
    assert.ok(leadSalesBucketRank("WARM") < leadSalesBucketRank("COLD"));
    assert.ok(leadSalesBucketRank("COLD") < leadSalesBucketRank("LOST"));
  });

  test("the urgency ladder is REUSED from the pipeline, not restated", () => {
    const src = read("src/features/crm/contracts/lead-segmentation-order.ts");
    assert.match(src, /from "\.\/pipeline-contracts\.ts"/);
    assert.match(src, /resolvePipelineUrgency/);
    // No second copy of the ladder.
    assert.doesNotMatch(src, /sla_breach/);
    assert.doesNotMatch(src, /URGENCY_RANK/);
  });
});

/* ========================================================================== */
/* 5. Counting                                                                 */
/* ========================================================================== */

describe("bucket counts are exact and cohort-wide", () => {
  test("counts tally every bucket plus a total", () => {
    const counts = countSalesBuckets([
      "HOT",
      "HOT",
      "WARM",
      "COLD",
      "COLD",
      "COLD",
      "LOST",
      "WON",
      "ON_HOLD",
    ]);
    assert.equal(counts.HOT, 2);
    assert.equal(counts.WARM, 1);
    assert.equal(counts.COLD, 3);
    assert.equal(counts.LOST, 1);
    assert.equal(counts.WON, 1);
    assert.equal(counts.ON_HOLD, 1);
    assert.equal(counts.TOTAL, 9);
  });

  test("an empty cohort counts zero everywhere", () => {
    const counts = emptySalesBucketCounts();
    for (const bucket of CRM_LEAD_SALES_BUCKETS) {
      assert.equal(counts[bucket], 0);
    }
    assert.equal(counts.TOTAL, 0);
  });

  test("the current production shape reads as all-COLD without seeded data", () => {
    // 4 August + 2 September leads, every one at stage `new` with no activity.
    const september = countSalesBuckets(
      Array.from({ length: 2 }, () =>
        resolveLeadSalesBucket("new", resolveScoreBand(0))
      )
    );
    assert.equal(september.TOTAL, 2);
    assert.equal(september.COLD, 2);
    assert.equal(september.HOT, 0);
    assert.equal(september.WARM, 0);
    assert.equal(september.LOST, 0);
    assert.equal(september.WON, 0);
    assert.equal(september.ON_HOLD, 0);

    const august = countSalesBuckets(
      Array.from({ length: 4 }, () =>
        resolveLeadSalesBucket("new", resolveScoreBand(0))
      )
    );
    assert.equal(august.TOTAL, 4);
    assert.equal(august.COLD, 4);

    const allTime = countSalesBuckets([
      ...Array.from({ length: 6 }, () =>
        resolveLeadSalesBucket("new", resolveScoreBand(0))
      ),
    ]);
    assert.equal(allTime.TOTAL, 6);
    assert.equal(allTime.COLD, 6);
  });

  test("counts are computed over the cohort, BEFORE the bucket filter and the slice", () => {
    const src = read(QUERIES);
    const countsAt = src.indexOf("const bucketCounts = countSalesBuckets");
    const filterAt = src.indexOf("? scored.filter");
    const sliceAt = src.indexOf("ordered.slice(from,");
    assert.ok(countsAt > 0 && filterAt > 0 && sliceAt > 0);
    assert.ok(countsAt < filterAt, "counts must precede the bucket filter");
    assert.ok(filterAt < sliceAt, "the bucket filter must precede the page slice");
    // Counts are taken from the scored cohort, never from the page.
    assert.match(src, /countSalesBuckets\(scored\.map\(\(item\) => item\.salesBucket\)\)/);
    assert.doesNotMatch(src, /countSalesBuckets\(items/);
  });
});

/* ========================================================================== */
/* 6. Read path                                                                */
/* ========================================================================== */

describe("the read path resolves buckets before paginating, without N+1", () => {
  test("the cohort is read in bounded chunks, and truncation is reported", () => {
    const src = read(QUERIES);
    assert.match(src, /CRM_LEAD_COHORT_CHUNK_SIZE = 500/);
    assert.match(src, /CRM_LEAD_COHORT_MAX_ROWS = 5_000/);
    assert.match(src, /cohortTruncated/);
    // Reported, never silent.
    assert.match(read(PAGE), /crm-cohort-truncated/);
  });

  test("signals are batched by lead id, never per lead", () => {
    const src = read(QUERIES);
    assert.match(src, /fetchLeadScoreBatch\(leadIds\)/);
    // One batch call for the whole cohort, inside a Promise.all with the
    // follow-up lookup — not a call per row.
    assert.doesNotMatch(src, /scored\.map\([\s\S]{0,400}await /);
    assert.doesNotMatch(src, /for \(const row of cohort\.rows\)[\s\S]{0,200}await /);
  });

  test("every batched read chunks its .in(...) list", () => {
    const src = read(BATCH);
    const inCalls = src.match(/\.in\("lead_id", \[\.\.\.\w+\]\)/g) ?? [];
    assert.ok(inCalls.length >= 4, "expected several batched lead_id reads");
    for (const call of inCalls) {
      assert.match(call, /\[\.\.\.chunk\]/, `unchunked .in(): ${call}`);
    }
    assert.match(src, /chunkLeadIds/);
    assert.equal(CRM_LEAD_ID_CHUNK_SIZE, 200);
  });

  test("chunkLeadIds splits exactly and loses nothing", () => {
    assert.deepEqual(chunkLeadIds([], 3), []);
    assert.deepEqual(chunkLeadIds(["a", "b"], 3), [["a", "b"]]);
    const six = ["a", "b", "c", "d", "e", "f"];
    assert.deepEqual(chunkLeadIds(six, 2), [["a", "b"], ["c", "d"], ["e", "f"]]);
    const seven = [...six, "g"];
    const chunks = chunkLeadIds(seven, 3);
    assert.equal(chunks.length, 3);
    assert.deepEqual(chunks.flat(), seven);
  });

  test("the list and the pipeline share ONE signal assembly and ONE score engine", () => {
    const listSrc = read(QUERIES);
    const pipelineSrc = read(PIPELINE);
    for (const src of [listSrc, pipelineSrc]) {
      assert.match(src, /from "\.\/crm-lead-score-batch\.ts"/);
      assert.match(src, /deriveLeadScore/);
    }
    // The pipeline no longer keeps private copies of the fetchers.
    assert.doesNotMatch(pipelineSrc, /async function fetchEngagementSignals/);
    assert.doesNotMatch(pipelineSrc, /async function fetchSlaSignals/);
    assert.doesNotMatch(pipelineSrc, /async function fetchSalesTouchSignals/);
    // And there is no second scoring formula anywhere in SQL.
    assert.doesNotMatch(listSrc, /priorityScore\s*=\s*\d/);
  });

  test("both surfaces feed deriveLeadScore the same signal shape", () => {
    const listSrc = read(QUERIES);
    const pipelineSrc = read(PIPELINE);
    for (const key of [
      "hasFirstContactAttempt",
      "hasMeaningfulOutcome",
      "hasConsultationOrSiteVisit",
      "commercialState",
      "lastMeaningfulActivityAt",
      "latestMeaningfulSalesTouchAt",
      "hasOpenPrimaryNextAction",
      "primaryNextActionDueAt",
      "slaDueAt",
    ]) {
      assert.match(listSrc, new RegExp(key), `list missing ${key}`);
      assert.match(pipelineSrc, new RegExp(key), `pipeline missing ${key}`);
    }
  });

  test("the read model runs under caller RLS with no service-role shortcut", () => {
    for (const rel of [QUERIES, BATCH]) {
      const src = read(rel);
      assert.match(src, /createClient/);
      assert.doesNotMatch(src, /service_role|SERVICE_ROLE|createServiceRoleClient/);
    }
  });

  test("scoped visibility is unchanged — broad-only filters stay gated", () => {
    const src = read(QUERIES);
    assert.match(src, /if \(context\.canReadBroad\) \{/);
    // Counts are derived from the same RLS-scoped rows the user can read, so a
    // scoped user can never be shown totals for leads they cannot see.
    assert.match(src, /readCohortRows\(context, query\)/);
  });
});

/* ========================================================================== */
/* 7. UI                                                                       */
/* ========================================================================== */

describe("the workspace shows bucket and stage as separate facts", () => {
  test("the desktop table has its own Bucket column beside Stage", () => {
    const src = read(TABLE);
    assert.match(src, /LeadSalesBucketBadge/);
    assert.match(src, />\s*Bucket\s*</);
    assert.match(src, />\s*Stage\s*</);
    // Stage survives: the bucket does not replace it.
    assert.match(src, /<LeadStatusBadge status=\{item\.status\} \/>/);
    assert.ok(
      src.indexOf("Bucket") < src.indexOf("Stage"),
      "bucket is the primary organiser and comes first"
    );
  });

  test("the mobile card carries the bucket and keeps the stage", () => {
    const src = read(CARDS);
    assert.match(src, /<LeadSalesBucketBadge bucket=\{item\.salesBucket\} \/>/);
    assert.match(src, /<LeadStatusBadge status=\{item\.status\} \/>/);
  });

  test("the strip is the primary organiser and sits above the filters", () => {
    const src = read(PAGE);
    const stripAt = src.indexOf("<LeadSalesBucketStrip");
    const monthAt = src.indexOf("<LeadMonthSelector");
    const filtersAt = src.indexOf("<LeadListFilters");
    assert.ok(monthAt > 0 && stripAt > 0 && filtersAt > 0);
    assert.ok(monthAt < stripAt, "month scopes the strip, so it comes first");
    assert.ok(stripAt < filtersAt, "segmentation outranks the secondary filters");
  });

  test("the strip renders all seven tabs with counts", () => {
    const src = read(STRIP);
    assert.match(src, /crm-bucket-tab-all/);
    for (const bucket of CRM_LEAD_SALES_BUCKETS) {
      assert.match(
        src,
        new RegExp(`crm-bucket-tab-\\$\\{bucket.toLowerCase\\(\\)\\}|${bucket}`),
        `strip missing ${bucket}`
      );
    }
    assert.match(src, /counts\.TOTAL/);
    assert.match(src, /counts\[bucket\]/);
  });

  test("buckets are never colour-only", () => {
    const badge = read("src/features/crm/components/leads/LeadSalesBucketBadge.tsx");
    assert.match(badge, /CRM_LEAD_SALES_BUCKET_LABELS\[bucket\]/);
  });

  test("the month copy says RECEIVED and separates cohort from outcome", () => {
    const selector = read(
      "src/features/crm/components/leads/LeadMonthSelector.tsx"
    );
    assert.match(selector, /LEAD_MONTH_SEMANTICS_NOTE/);
    const contract = read("src/features/crm/contracts/lead-month-cohort.ts");
    assert.match(contract, /when they were received/);
    assert.match(contract, /not by when they were won or lost/);
    assert.match(read(STRIP), /leadMonthCohortHeading/);
    // Never mislabelled as an outcome count.
    assert.doesNotMatch(selector, /lost this month|won this month/i);
  });

  test("the lead detail derives the bucket from the score it already holds", () => {
    const src = read(HEADER);
    assert.match(src, /resolveLeadSalesBucket\(status, score\.band\)/);
    // No second derivation, no second score computation on this surface.
    assert.doesNotMatch(src, /deriveLeadScore/);
  });

  test("no manual temperature override was introduced", () => {
    for (const rel of [
      QUERIES,
      TABLE,
      CARDS,
      STRIP,
      HEADER,
      "src/features/crm/contracts/lead-sales-bucket.ts",
      "src/features/crm/contracts/lead-dtos.ts",
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, /manualBucket|bucketOverride|manual_temperature/i);
    }
  });
});

/* ========================================================================== */
/* 8. DTO safety                                                               */
/* ========================================================================== */

describe("the list DTO stays narrow", () => {
  test("no sensitive scoring input leaks into the list row", () => {
    const src = read("src/features/crm/contracts/lead-dtos.ts");
    for (const forbidden of [
      "submittedEmail",
      "budgetComfortCode",
      "estimateSnapshot",
      "attribution",
      "roomCodes",
      "contactId",
      "message",
    ]) {
      assert.equal(
        src.includes(`readonly ${forbidden}:`),
        false,
        `list DTO must not expose ${forbidden}`
      );
    }
  });

  test("the bucket never reads a protected attribute", () => {
    const src = read("src/features/crm/contracts/lead-sales-bucket.ts");
    for (const field of [
      "locality",
      "email",
      "phone",
      "name",
      "budget",
      "message",
    ]) {
      assert.doesNotMatch(
        src,
        new RegExp(`\\b${field}\\b\\s*[:.]`),
        `bucket resolution must not read ${field}`
      );
    }
  });
});
