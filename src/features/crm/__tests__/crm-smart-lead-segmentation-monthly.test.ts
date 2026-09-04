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
  CRM_SCORE_ENGAGEMENT_MAX,
  CRM_SCORE_MATURITY_POINTS,
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
import {
  CRM_LEAD_COHORT_CHUNK_SIZE,
  CRM_LEAD_COHORT_MAX_ROWS,
  cohortScanVerdict,
  trimCohortRows,
} from "../contracts/lead-cohort-limits.ts";
import {
  formatLeadQuotationState,
  resolveSiteVisitState,
} from "../contracts/lead-milestones.ts";
import { CRM_COMMERCIAL_STATES } from "../contracts/deal-value-contracts.ts";
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
const FILTERS = "src/features/crm/components/leads/LeadListFilters.tsx";
const MILESTONES = "src/features/crm/contracts/lead-milestones.ts";
const REPOSITORY = "src/features/crm/server/crm-lead-repository.ts";
const DASHBOARD = "src/features/admin-ops/server/dashboard-snapshot.ts";

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

  test("a stage-new lead cannot reach WARM even at maximum engagement", () => {
    // Maturity(new) = 0 and engagement is capped at 40 < WARM's 45. This is why
    // every current production lead reads COLD, and it holds however much
    // activity those leads accumulate while they stay at stage `new`.
    assert.equal(CRM_SCORE_MATURITY_POINTS.new, 0);
    assert.ok(
      CRM_SCORE_MATURITY_POINTS.new + CRM_SCORE_ENGAGEMENT_MAX <
        CRM_LEAD_SCORE_BAND_MIN.WARM
    );
    const ceiling = CRM_SCORE_MATURITY_POINTS.new + CRM_SCORE_ENGAGEMENT_MAX;
    assert.equal(resolveLeadSalesBucket("new", resolveScoreBand(ceiling)), "COLD");
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
  primaryNextActionDueAt: null,
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
        lead({ id: "calm", salesBucket: "HOT", priorityScore: 80, primaryNextActionDueAt: "2026-09-20T06:00:00.000Z" }),
        lead({ id: "breach", salesBucket: "HOT", priorityScore: 80, slaBreached: true }),
        lead({ id: "overdue", salesBucket: "HOT", priorityScore: 80, primaryNextActionDueAt: "2026-09-01T06:00:00.000Z" }),
      ],
      NOW
    );
    // sla_breach (0) -> no_next_action (1) -> overdue (2) -> ... -> upcoming (5)
    assert.deepEqual(sorted.map((entry) => entry.id), ["breach", "overdue", "calm"]);
  });

  test("on equal score and urgency, the earlier next action wins", () => {
    const sorted = sortSegmentedLeads(
      [
        lead({ id: "later", salesBucket: "WARM", priorityScore: 50, primaryNextActionDueAt: "2026-09-25T06:00:00.000Z" }),
        lead({ id: "sooner", salesBucket: "WARM", priorityScore: 50, primaryNextActionDueAt: "2026-09-20T06:00:00.000Z" }),
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

  test("stage-new leads read as COLD regardless of recorded activity", () => {
    // Managed production currently holds 4 August + 2 September leads, all at
    // stage `new`. They resolve COLD because maturity for `new` is 0 and the
    // engagement ceiling is 40, which cannot reach the WARM threshold of 45 —
    // that is a property of the score weights, NOT an assumption that the leads
    // have no activity (they do: follow-ups and quotation events exist).
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
    // The limits now live in the pure contract both scan paths share.
    assert.equal(CRM_LEAD_COHORT_CHUNK_SIZE, 500);
    assert.equal(CRM_LEAD_COHORT_MAX_ROWS, 5_000);
    assert.match(src, /cohortScanVerdict/);
    assert.match(src, /cohortTruncated/);
    // Reported, never silent.
    assert.match(read(PAGE), /crm-cohort-truncated/);
  });

  test("signals are batched by lead id, never per lead", () => {
    const src = read(QUERIES);
    assert.match(src, /fetchLeadScoreBatch\(leadIds\)/);
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
    assert.match(src, /readCohortRows\(context, query, prepared\)/);
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
/* 9. Adversarial corrections                                                  */
/* ========================================================================== */

describe("the filter form carries the workspace, not just its own fields", () => {
  const NOW = Date.parse("2026-09-04T06:00:00.000Z");

  test("the GET form submits the selected month as a hidden field", () => {
    // A GET form submits ONLY its own fields. Without this, August + HOT plus a
    // source change silently became current-month + ALL.
    const src = read(FILTERS);
    assert.match(src, /<input type="hidden" name="month" value=\{query\.month\.param\} \/>/);
  });

  test("the GET form submits the selected bucket as a hidden field", () => {
    const src = read(FILTERS);
    assert.match(src, /name="bucket"/);
    assert.match(src, /leadSalesBucketParam\(query\.bucket\)/);
    // Absent rather than empty when no bucket is selected, so ALL stays ALL.
    assert.match(src, /\{query\.bucket \? \(/);
  });

  test("the form is a GET to the leads route and omits page, so Apply resets to 1", () => {
    const src = read(FILTERS);
    assert.match(src, /action="\/admin\/crm\/leads"/);
    assert.match(src, /method="get"/);
    assert.doesNotMatch(src, /name="page"/);
    // pageSize is preserved when the reader changed it.
    assert.match(src, /name="pageSize"/);
  });

  test("every secondary control the form submits is a real query field", () => {
    const src = read(FILTERS);
    for (const field of [
      "q",
      "status",
      "sourceId",
      "assignment",
      "assigneeId",
      "followUpDue",
      "month",
      "bucket",
    ]) {
      assert.match(src, new RegExp(`name="${field}"`), `form missing ${field}`);
    }
  });

  test("Clear wipes the secondary filters but keeps month and bucket", () => {
    const query = parseLeadListQuery(
      {
        q: "rahul",
        status: "qualified",
        sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        assignment: "assigned",
        assigneeId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        followUpDue: "today",
        bucket: "hot",
        month: "2026-08",
        page: "5",
      },
      NOW
    );

    const href = buildLeadListHref(query, "secondary", { page: 1 });
    for (const gone of ["q=", "status=", "sourceId=", "assignment=", "assigneeId=", "followUpDue="]) {
      assert.equal(href.includes(gone), false, `Clear must drop ${gone}`);
    }
    assert.match(href, /month=2026-08/);
    assert.match(href, /bucket=hot/);
    assert.doesNotMatch(href, /page=/, "Clear must reset to page 1");
  });

  test("the Clear control uses that href, not a bare route", () => {
    const src = read(FILTERS);
    assert.match(src, /buildLeadListHref\(query, "secondary", \{ page: 1 \}\)/);
    // The old bare link silently dropped the cohort.
    assert.doesNotMatch(src, /href="\/admin\/crm\/leads"\s*\n\s*className="crm-btn crm-btn-ghost/);
  });
});

describe("only the canonical primary next action drives urgency", () => {
  const NOW = Date.parse("2026-09-10T06:00:00.000Z");

  test("a lead with no primary action ranks as no_next_action", () => {
    const withPrimary = lead({
      id: "has-primary",
      salesBucket: "HOT",
      priorityScore: 80,
      primaryNextActionDueAt: "2026-09-20T06:00:00.000Z",
    });
    const withoutPrimary = lead({
      id: "no-primary",
      salesBucket: "HOT",
      priorityScore: 80,
      primaryNextActionDueAt: null,
    });

    // no_next_action (rank 1) beats upcoming (rank 5): it needs attention.
    const sorted = sortSegmentedLeads([withPrimary, withoutPrimary], NOW);
    assert.deepEqual(sorted.map((entry) => entry.id), ["no-primary", "has-primary"]);
  });

  test("a NON-primary open follow-up cannot satisfy the primary-action rank", () => {
    // The read model no longer has any way to express "some other open
    // follow-up" on a sortable lead: the only due field is the primary one.
    const sortable: CrmSortableLead = lead({ primaryNextActionDueAt: null });
    assert.equal(
      Object.prototype.hasOwnProperty.call(sortable, "nextFollowUpDue"),
      false,
      "a generic follow-up must not exist on the ordering contract"
    );
    const src = read("src/features/crm/contracts/lead-segmentation-order.ts");
    assert.doesNotMatch(src, /nextFollowUpDue/);
    assert.match(src, /primaryNextActionDueAt: left\.primaryNextActionDueAt/);
  });

  test("the read model sources the due date from the primary-action batch", () => {
    const src = read(QUERIES);
    assert.match(src, /primaryNextActionDueAt: primary\?\.dueAt \?\? null/);
    assert.match(src, /primaryNextActionTitle: primary\?\.title \?\? null/);
    // The generic "any open follow-up" helper is gone from the cohort path.
    assert.doesNotMatch(src, /fetchNextOpenFollowUpDueByLeadIds/);
  });

  test("the primary-action query filters on is_primary_next_action", () => {
    const src = read(BATCH);
    const block = src.slice(src.indexOf("fetchPrimaryNextActions"));
    assert.match(block.slice(0, 900), /\.eq\("is_primary_next_action", true\)/);
    assert.match(block.slice(0, 900), /\.eq\("status", "open"\)/);
  });

  test("an earlier primary due date still wins on equal score and urgency", () => {
    const sorted = sortSegmentedLeads(
      [
        lead({ id: "later", salesBucket: "WARM", priorityScore: 50, primaryNextActionDueAt: "2026-09-25T06:00:00.000Z" }),
        lead({ id: "sooner", salesBucket: "WARM", priorityScore: 50, primaryNextActionDueAt: "2026-09-20T06:00:00.000Z" }),
      ],
      NOW
    );
    assert.deepEqual(sorted.map((entry) => entry.id), ["sooner", "later"]);
  });
});

describe("no unbounded reads and no repeated prerequisite work", () => {
  test("no query sends a full-cohort lead_id list", () => {
    for (const rel of [QUERIES, BATCH]) {
      const src = read(rel);
      assert.doesNotMatch(
        src,
        /\.in\("lead_id", \[\.\.\.leadIds\]\)/,
        `${rel} sends an unbounded lead_id list`
      );
    }
    // Every batched lead_id read goes through a chunk.
    const batchSrc = read(BATCH);
    const inCalls = batchSrc.match(/\.in\("lead_id", \[[^\]]*\]\)/g) ?? [];
    assert.ok(inCalls.length >= 5);
    for (const call of inCalls) {
      assert.match(call, /\[\.\.\.chunk\]/, `unchunked: ${call}`);
    }
  });

  test("the id-restricted cohort scan walks chunks, not one giant IN", () => {
    const src = read(QUERIES);
    assert.match(src, /for \(const idChunk of chunkLeadIds\(prepared\.matchedIds\)\)/);
  });

  test("filter prerequisites are resolved ONCE per request", () => {
    const src = read(QUERIES);
    // The constraint applier is now pure — no awaits inside it at all.
    const applier = src.slice(
      src.indexOf("function constrainLeadListRequest("),
      src.indexOf("/* ---")
    );
    assert.doesNotMatch(applier, /await /, "the per-chunk applier must be pure");
    assert.doesNotMatch(applier, /fetchLeadIdsForTextSearch/);
    assert.doesNotMatch(applier, /fetchLeadIdsForFollowUpDueFilter/);

    // And the expensive lookups live in the once-per-request preparer.
    const preparer = src.slice(
      src.indexOf("export async function prepareLeadListFilters("),
      src.indexOf("function constrainLeadListRequest(")
    );
    assert.match(preparer, /fetchLeadIdsForTextSearch/);
    assert.match(preparer, /fetchLeadIdsForFollowUpDueFilter/);

    // Called once, before the scan.
    assert.match(src, /const prepared = await prepareLeadListFilters\(query\)/);
    const scan = src.slice(src.indexOf("async function readCohortRows("));
    assert.doesNotMatch(
      scan.slice(0, scan.indexOf("export async function queryLeadListPage")),
      /await prepareLeadListFilters/
    );
  });

  test("two id filters are intersected in memory, not both sent", () => {
    const src = read(QUERIES);
    assert.match(src, /function intersectIds\(/);
    assert.match(src, /const rightSet = new Set\(right\)/);
  });

  test("the batching claim is described truthfully", () => {
    // "A fixed number of requests independent of cohort size" was wrong: the
    // request count grows with the number of chunks.
    for (const rel of [QUERIES, BATCH]) {
      const src = read(rel);
      assert.doesNotMatch(src, /independent of cohort size/);
      assert.doesNotMatch(src, /Fixed number of batched round trips/);
    }
    assert.match(read(BATCH), /bounded, not\n \* constant/);
  });
});

describe("site visit and quotation are separate milestone facts", () => {
  test("site visit is derived from canonical site_visit activities only", () => {
    const src = read(BATCH);
    const block = src.slice(src.indexOf("fetchSiteVisitSignals"));
    assert.match(block.slice(0, 1200), /\.eq\("activity_type", "site_visit"\)/);
    // NEVER inferred from the pipeline stage.
    assert.doesNotMatch(block.slice(0, 1200), /consultation_scheduled/);
  });

  test("site visit uses only the canonical open/completed/cancelled vocabulary", () => {
    const src = read(MILESTONES);
    assert.match(src, /open, completed, cancelled/);
    assert.equal(resolveSiteVisitState({ completed: 0, open: 0, cancelled: 0 }), "none");
    assert.equal(resolveSiteVisitState({ completed: 0, open: 1, cancelled: 0 }), "scheduled");
    assert.equal(resolveSiteVisitState({ completed: 1, open: 0, cancelled: 0 }), "completed");
    assert.equal(resolveSiteVisitState({ completed: 0, open: 0, cancelled: 1 }), "cancelled");
    // A completed visit outranks a later cancelled one; an upcoming visit
    // outranks an abandoned one.
    assert.equal(resolveSiteVisitState({ completed: 1, open: 0, cancelled: 3 }), "completed");
    assert.equal(resolveSiteVisitState({ completed: 0, open: 1, cancelled: 2 }), "scheduled");
  });

  test("quotation reuses the canonical commercial state — no second model", () => {
    const src = read(MILESTONES);
    assert.match(src, /from "\.\/deal-value-contracts\.ts"/);
    assert.match(src, /CRM_LEAD_QUOTATION_STATE_LABELS = CRM_COMMERCIAL_STATE_LABELS/);
    for (const state of CRM_COMMERCIAL_STATES) {
      assert.equal(
        typeof formatLeadQuotationState(state),
        "string",
        `${state} must have a canonical label`
      );
    }
    assert.equal(formatLeadQuotationState("unknown"), "None");
    assert.equal(formatLeadQuotationState("issued"), "Issued to client");

    // The read model takes it straight from the deal-value batch.
    assert.match(read(QUERIES), /quotationState: deal\?\.state \?\? "unknown"/);
  });

  test("milestones are independent of the bucket", () => {
    // The owner lock: the same two milestones can sit under any bucket.
    const bucketSrc = read("src/features/crm/contracts/lead-sales-bucket.ts");
    assert.doesNotMatch(bucketSrc, /siteVisit/i);
    assert.doesNotMatch(bucketSrc, /quotation/i);
    assert.doesNotMatch(bucketSrc, /site_visit/);

    // resolveLeadSalesBucket takes ONLY status and band, so no milestone can
    // reach it.
    assert.equal(resolveLeadSalesBucket.length, 2);
    assert.equal(resolveLeadSalesBucket("negotiation", "HOT"), "HOT");
    assert.equal(resolveLeadSalesBucket("closed_lost", "HOT"), "LOST");
  });

  test("milestones are independent of the stage", () => {
    // Strip comments first: the module deliberately NAMES the stage it must not
    // use, to record why. Only executable code is checked here.
    const code = read(MILESTONES)
      .split("\n")
      .filter((line) => {
        const trimmed = line.trimStart();
        return !(
          trimmed.startsWith("*") ||
          trimmed.startsWith("/*") ||
          trimmed.startsWith("//")
        );
      })
      .join("\n");

    for (const stage of ["consultation_scheduled", "proposal_sent", "negotiation"]) {
      assert.doesNotMatch(code, new RegExp(stage), `milestone code reads ${stage}`);
    }
    // The resolver takes activity counts only — no stage can reach it.
    assert.equal(resolveSiteVisitState.length, 1);
  });
});

describe("the workspace shows bucket, stage and both milestones", () => {
  test("the desktop table carries all five facts", () => {
    const src = read(TABLE);
    for (const header of ["Bucket", "Stage", "Site visit", "Quotation", "Received"]) {
      assert.match(src, new RegExp(`>\\s*${header}\\s*<`), `table missing ${header}`);
    }
    assert.match(src, /CRM_SITE_VISIT_STATE_LABELS\[item\.siteVisitState\]/);
    assert.match(src, /formatLeadQuotationState\(item\.quotationState\)/);
    assert.match(src, /<LeadSalesBucketBadge/);
    assert.match(src, /<LeadStatusBadge status=\{item\.status\} \/>/);
  });

  test("the desktop label says Received, not Created", () => {
    const src = read(TABLE);
    assert.doesNotMatch(src, />\s*Created\s*</);
    assert.match(src, /data-testid="crm-lead-received"[\s\S]{0,120}item\.createdAt/);
  });

  test("the mobile card carries the same core facts", () => {
    const src = read(CARDS);
    assert.match(src, /<LeadSalesBucketBadge bucket=\{item\.salesBucket\} \/>/);
    assert.match(src, /<LeadStatusBadge status=\{item\.status\} \/>/);
    assert.match(src, /Site visit: \{CRM_SITE_VISIT_STATE_LABELS\[item\.siteVisitState\]\}/);
    assert.match(src, /Quotation: \{formatLeadQuotationState\(item\.quotationState\)\}/);
    assert.match(src, /Priority \{item\.priorityScore\}/);
  });

  test("the mobile received date comes from createdAt, never updatedAt", () => {
    const src = read(CARDS);
    assert.match(src, /Received \{formatTimestamp\(item\.createdAt\)\}/);
    // updatedAt contradicted a received-month workspace: a lead edited today
    // read as if it had arrived today.
    assert.doesNotMatch(src, /item\.updatedAt/);
  });

  test("the next-action column shows the primary action", () => {
    assert.match(read(TABLE), />\s*Next action\s*</);
    assert.match(read(TABLE), /item\.primaryNextActionDueAt/);
    assert.match(read(CARDS), /item\.primaryNextActionDueAt/);
    for (const rel of [TABLE, CARDS]) {
      assert.doesNotMatch(read(rel), /nextFollowUpDue/);
    }
  });
});

describe("partial counts are never presented as exact", () => {
  test("the read model reports exactness alongside the counts", () => {
    const src = read(QUERIES);
    assert.match(src, /readonly countsExact: boolean;/);
    assert.match(src, /const countsExact = !cohort\.truncated;/);
    // The empty page is genuinely exact: zero really is zero.
    assert.match(src, /countsExact: true,/);
  });

  test("the strip withholds the numbers when the cohort was truncated", () => {
    const src = read(STRIP);
    assert.match(src, /\{countsExact \? count : "—"\}/);
    assert.match(src, /data-counts-exact=\{countsExact \? "true" : "false"\}/);
    assert.match(src, /Counts unavailable/);
    // The tabs stay navigable — only the numbers are withheld.
    assert.match(src, /href=\{buildLeadListHref\(query, undefined, \{ bucket, page: 1 \}\)\}/);
  });

  test("the page hands the exactness flag through and explains it", () => {
    const src = read(PAGE);
    assert.match(src, /countsExact=\{page\.countsExact\}/);
    assert.match(src, /exact bucket counts are unavailable/);
  });
});

/* ========================================================================== */
/* 10. Final adversarial corrections                                           */
/* ========================================================================== */

describe("dashboard Recent Leads is genuinely recent", () => {
  test("the dashboard no longer reads the segmented conversion queue", () => {
    const src = read(DASHBOARD);
    // That read model ranks HOT -> WARM -> COLD, so a panel titled "Recent
    // Leads" built on it showed the hottest leads, and the activity feed
    // labelled a months-old HOT lead "Lead created".
    assert.doesNotMatch(src, /getLeadListPageForCurrentUser/);
    assert.match(src, /getRecentLeadsForCurrentUser/);
  });

  test("the dedicated read orders by created_at DESC with a stable id tie-break", () => {
    const src = read(QUERIES);
    const block = src.slice(
      src.indexOf("export async function queryRecentLeads("),
      src.indexOf("How many candidate rows one cohort scan will read")
    );
    assert.match(block, /\.order\("created_at", \{ ascending: false \}\)/);
    assert.match(block, /\.order\("id", \{ ascending: false \}\)/);
    assert.match(block, /\.limit\(limit\)/);
    // No bucket, no score, no milestone fan-out for a "what came in last" panel.
    assert.doesNotMatch(block, /deriveLeadScore/);
    assert.doesNotMatch(block, /fetchLeadScoreBatch/);
    assert.doesNotMatch(block, /resolveLeadSalesBucket/);
    assert.doesNotMatch(block, /fetchSiteVisitSignals/);
  });

  test("the panel limit is 8", () => {
    const src = read(QUERIES);
    assert.match(src, /CRM_RECENT_LEADS_LIMIT = 8/);
    assert.match(read(DASHBOARD), /RECENT_LEADS_LIMIT = 8/);
    assert.match(read(DASHBOARD), /getRecentLeadsForCurrentUser\(RECENT_LEADS_LIMIT\)/);
  });

  test("it runs under caller RLS with no service-role path", () => {
    const src = read(QUERIES);
    const block = src.slice(src.indexOf("export async function queryRecentLeads("));
    assert.match(block.slice(0, 1500), /await createClient\(\)/);
    assert.doesNotMatch(src, /service_role|createServiceRoleClient/);
    // Authentication is still required before any read.
    assert.match(read(REPOSITORY), /getRecentLeadsForCurrentUser[\s\S]{0,400}AUTH_REQUIRED/);
  });

  test("the activity feed is built from that recent source", () => {
    const src = read(DASHBOARD);
    const recentAt = src.indexOf("const recentLeads: OpsRecentLead[]");
    const activityAt = src.indexOf('title: "Lead created"');
    assert.ok(recentAt > 0 && activityAt > recentAt);
    assert.match(src, /const activity: OpsActivityItem\[\] = recentLeads\.map/);
  });

  test("the smart Leads workspace ordering is untouched", () => {
    const src = read(QUERIES);
    // The queue still scores the whole cohort, resolves buckets, then slices.
    assert.match(src, /const bucketCounts = countSalesBuckets\(scored\.map/);
    assert.match(src, /sortSegmentedLeads\(filtered, now\)/);
    assert.match(src, /ordered\.slice\(from, from \+ query\.pageSize\)/);
    assert.match(src, /fetchLeadScoreBatch\(leadIds\)/);
  });
});

describe("the cohort ceiling applies to every scan path", () => {
  const OPTS = {
    expectFullChunkOf: CRM_LEAD_COHORT_CHUNK_SIZE,
    maxRows: CRM_LEAD_COHORT_MAX_ROWS,
  } as const;

  test("exactly the ceiling is COMPLETE, not truncated", () => {
    // A full final chunk that lands exactly on the ceiling keeps scanning; the
    // next empty chunk proves the source is exhausted.
    assert.equal(cohortScanVerdict(5000, 500, OPTS), "continue");
    assert.equal(cohortScanVerdict(5000, 0, OPTS), "complete");
    // `>=` used to mark an exactly-full cohort partial and suppress correct counts.
    assert.notEqual(cohortScanVerdict(5000, 500, OPTS), "truncated");
  });

  test("one row past the ceiling is TRUNCATED", () => {
    assert.equal(cohortScanVerdict(5001, 500, OPTS), "truncated");
    // Even when the chunk was short — the case that previously slipped through,
    // because completeness was judged before overflow.
    assert.equal(cohortScanVerdict(5001, 1, OPTS), "truncated");
    assert.equal(cohortScanVerdict(9999, 3, OPTS), "truncated");
  });

  test("the id-chunked path has no short-chunk escape but the same ceiling", () => {
    const idOpts = { expectFullChunkOf: null, maxRows: CRM_LEAD_COHORT_MAX_ROWS } as const;
    // A short id chunk proves nothing about how many rows remain.
    assert.equal(cohortScanVerdict(200, 7, idOpts), "continue");
    assert.equal(cohortScanVerdict(5000, 200, idOpts), "continue");
    assert.equal(cohortScanVerdict(5001, 1, idOpts), "truncated");
  });

  test("both scan paths call the shared rule", () => {
    const src = read(QUERIES);
    const scan = src.slice(
      src.indexOf("async function readCohortRows("),
      src.indexOf("function emptySegmentationPage(")
    );
    const calls = scan.match(/cohortScanVerdict\(/g) ?? [];
    assert.equal(calls.length, 2, "the filtered and unfiltered scans must both check");
    assert.match(scan, /expectFullChunkOf: null/);
    assert.match(scan, /expectFullChunkOf: CRM_LEAD_COHORT_CHUNK_SIZE/);
    // The filtered path used to return truncated:false unconditionally.
    assert.doesNotMatch(scan, /\/\/ Bounded by the matched id set/);
  });

  test("overflow trims to the ceiling and never returns the surplus row", () => {
    const rows = Array.from({ length: 5001 }, (_, index) => index);
    assert.equal(trimCohortRows(rows, CRM_LEAD_COHORT_MAX_ROWS).length, 5000);
    // Exactly at the ceiling nothing is trimmed.
    assert.equal(trimCohortRows(rows.slice(0, 5000), CRM_LEAD_COHORT_MAX_ROWS).length, 5000);
    assert.equal(trimCohortRows([1, 2, 3], CRM_LEAD_COHORT_MAX_ROWS).length, 3);
  });

  test("truncation still suppresses the counts", () => {
    const src = read(QUERIES);
    assert.match(src, /const countsExact = !cohort\.truncated;/);
    assert.match(read(STRIP), /\{countsExact \? count : "—"\}/);
  });
});

describe("no exported path can emit a giant id filter", () => {
  test("the unused count helper is gone from both modules", () => {
    // It fed the FULL prepared id set into one `.in("id", ...)`. It had no
    // production caller, so it was removed rather than left as a loaded gun.
    assert.doesNotMatch(read(QUERIES), /countLeadListForQuery/);
    assert.doesNotMatch(read(REPOSITORY), /countLeadListForQuery/);
    assert.doesNotMatch(read(REPOSITORY), /countLeadListForCurrentUser/);
  });

  test("the only full-set id filter left is the chunked scan", () => {
    const src = read(QUERIES);
    const matches = src.match(/\.in\("id", \[\.\.\.[a-zA-Z.]+\]\)/g) ?? [];
    // One call site, and it receives a chunk because the scan passes idChunk.
    assert.deepEqual(matches, ['.in("id", [...prepared.matchedIds])']);
    assert.match(src, /\{ matchedIds: idChunk \}/);
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
