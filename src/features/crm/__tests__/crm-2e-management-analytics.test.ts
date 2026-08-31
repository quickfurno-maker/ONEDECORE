/**
 * CRM 2E — Management analytics certification.
 *
 * Covers first-response SLA compliance, sales velocity, conversion, forecast
 * reuse and target achievement: the exact denominators, the unknown-stays-
 * unknown rule, role isolation, and the boundaries CRM 2E must not cross.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  BASIS_POINTS_SCALE,
  CRM_CONVERSION_FUNNEL_STAGES,
  CRM_CONVERSION_STAGE_LABELS,
  CRM_FORECAST_STAGE_ORDER,
  CRM_VELOCITY_STAGE_PAIRS,
  EMPTY_MANAGEMENT_ANALYTICS,
  forecastStageRank,
  formatBasisPointsPercent,
  formatDurationFromSeconds,
  mapManagementAnalyticsPayload,
  medianOf,
  pickHeadlineTargetRow,
  rateBasisPoints,
  resolveTargetPeriodFromRangeStart,
  type CrmTargetAttainmentRow,
} from "../contracts/management-analytics-contracts.ts";
import {
  CRM_STAGE_PROBABILITY_BASIS_POINTS,
  computeWeightedValuePaise,
  formatCompactInrFromPaise,
  formatDealValue,
  isParkedStage,
} from "../contracts/deal-value-contracts.ts";
import { LEAD_STAGE_CODES } from "../contracts/lead-stages.ts";
import { resolveReportDateRange } from "../contracts/reporting-date-range.ts";

const root = process.cwd();
const readSrc = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Strips comments so an assertion tests CODE, never explanatory prose. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*--.*$/gm, "");
}

const MIGRATION =
  "supabase/migrations/20260901140000_crm_management_analytics_read_model.sql";
const PGTAP = "supabase/tests/database/38_crm_management_analytics_read_model_test.sql";
const CONTRACTS = "src/features/crm/contracts/management-analytics-contracts.ts";
const QUERIES = "src/features/crm/server/crm-management-analytics-queries.ts";
const PANEL = "src/features/crm/components/reports/CrmManagementAnalyticsPanel.tsx";
const REPORTS_PANEL = "src/features/crm/components/reports/CrmReportsPanel.tsx";
const REPORTS_PAGE = "src/app/admin/crm/reports/page.tsx";
const DESIGN_DOC = "docs/product/crm-2e-management-analytics-design.md";
const CRM_2D_MIGRATION =
  "supabase/migrations/20260831140000_crm_lead_commercial_read_models.sql";

const migrationSql = stripComments(readSrc(MIGRATION));

/* ========================================================================== */
/* 1. Rates: explicit denominators, no division by zero                        */
/* ========================================================================== */

describe("CRM 2E rate arithmetic", () => {
  test("basis points scale is 10000", () => {
    assert.equal(BASIS_POINTS_SCALE, 10_000);
  });

  test("rate is exact integer basis points", () => {
    assert.equal(rateBasisPoints(1, 2), 5_000);
    assert.equal(rateBasisPoints(7, 9), 7_778);
    assert.equal(rateBasisPoints(3, 3), 10_000);
    assert.equal(rateBasisPoints(0, 5), 0);
  });

  test("zero, negative and non-finite denominators are unknown, never zero", () => {
    assert.equal(rateBasisPoints(4, 0), null);
    assert.equal(rateBasisPoints(4, -1), null);
    assert.equal(rateBasisPoints(4, Number.NaN), null);
    assert.equal(rateBasisPoints(Number.POSITIVE_INFINITY, 4), null);
  });

  test("unknown rate renders as an explicit dash, never 0%", () => {
    assert.equal(formatBasisPointsPercent(null), "—");
    assert.equal(formatBasisPointsPercent(null, "No data"), "No data");
    assert.notEqual(formatBasisPointsPercent(null), "0%");
    assert.equal(formatBasisPointsPercent(0), "0%");
    assert.equal(formatBasisPointsPercent(5_000), "50%");
    assert.equal(formatBasisPointsPercent(7_778), "77.8%");
  });
});

/* ========================================================================== */
/* 2. Velocity: median definition and edge cases                               */
/* ========================================================================== */

describe("CRM 2E velocity medians", () => {
  test("odd sample takes the middle value", () => {
    assert.equal(medianOf([30, 10, 20]), 20);
  });

  test("even sample averages the two middle values", () => {
    assert.equal(medianOf([10, 20, 30, 40]), 25);
    assert.equal(medianOf([1, 2]), 1.5);
  });

  test("single sample is that value", () => {
    assert.equal(medianOf([42]), 42);
  });

  test("empty sample is unknown, not zero", () => {
    assert.equal(medianOf([]), null);
    assert.notEqual(medianOf([]), 0);
  });

  test("non-finite entries are discarded, not coerced", () => {
    assert.equal(medianOf([Number.NaN, 10, 20, 30]), 20);
    assert.equal(medianOf([Number.NaN]), null);
  });

  test("a genuine zero duration stays zero", () => {
    assert.equal(medianOf([0, 0, 0]), 0);
  });

  test("duration formatting keeps unknown distinct from zero", () => {
    assert.equal(formatDurationFromSeconds(null), "—");
    assert.equal(formatDurationFromSeconds(null, "No data"), "No data");
    assert.equal(formatDurationFromSeconds(0), "0s");
    assert.equal(formatDurationFromSeconds(90), "1m");
    assert.equal(formatDurationFromSeconds(3_600), "1h");
    assert.equal(formatDurationFromSeconds(5_400), "1h 30m");
    assert.equal(formatDurationFromSeconds(86_400), "1d");
    assert.equal(formatDurationFromSeconds(90_000), "1d 1h");
    assert.equal(formatDurationFromSeconds(-1), "—");
  });

  test("measured pairs are contiguous along the funnel ladder", () => {
    const ladder = [...CRM_CONVERSION_FUNNEL_STAGES];
    for (const [index, pair] of CRM_VELOCITY_STAGE_PAIRS.entries()) {
      assert.equal(pair.fromStage, ladder[index]);
      assert.equal(pair.toStage, ladder[index + 1]);
    }
    assert.equal(CRM_VELOCITY_STAGE_PAIRS.length, ladder.length - 1);
  });

  test("SQL uses percentile_cont(0.5), matching medianOf", () => {
    const occurrences = migrationSql.match(/percentile_cont\(0\.5\)/g) ?? [];
    // first contact + active age + current stage age + stage transitions
    assert.ok(occurrences.length >= 4, "every median uses percentile_cont(0.5)");
    assert.doesNotMatch(migrationSql, /percentile_disc/);
    assert.doesNotMatch(migrationSql, /\bavg\s*\(/i);
  });

  test("stage-to-stage samples require both instants and are monotonic", () => {
    assert.match(
      migrationSql,
      /t_contacted is not null and t_qualified is not null and t_qualified >= t_contacted/
    );
    assert.match(
      migrationSql,
      /t_negotiation is not null and t_won is not null and t_won >= t_negotiation/
    );
  });

  test("current-snapshot velocity excludes terminal and parked leads", () => {
    assert.match(
      migrationSql,
      /open_leads as \(\s*select l\.id, l\.created_at\s*from public\.leads l\s*where l\.status not in \('closed_won', 'closed_lost', 'on_hold'\)/
    );
  });
});

/* ========================================================================== */
/* 3. SLA: denominator + non-retroactive activation + attempt semantics        */
/* ========================================================================== */

describe("CRM 2E first-response SLA", () => {
  test("eligibility is the receipt-time due snapshot, nothing else", () => {
    assert.match(
      migrationSql,
      /count\(\*\) filter \(where sla_due_at is not null\)::integer as eligible_count/
    );
  });

  test("met requires a qualifying attempt at or before the due instant", () => {
    assert.match(
      migrationSql,
      /first_contact_attempt_at is not null\s*and first_contact_attempt_at <= sla_due_at/
    );
  });

  test("breach covers a late attempt and an overdue silence", () => {
    assert.match(
      migrationSql,
      /\(first_contact_attempt_at is not null and first_contact_attempt_at > sla_due_at\)/
    );
    assert.match(
      migrationSql,
      /\(first_contact_attempt_at is null and v_now > sla_due_at\)/
    );
  });

  test("pending is eligible, unattempted and still inside the window", () => {
    assert.match(
      migrationSql,
      /sla_due_at is not null\s*and first_contact_attempt_at is null\s*and v_now <= sla_due_at/
    );
  });

  test("leads with no due snapshot are counted out of policy, not as breaches", () => {
    assert.match(
      migrationSql,
      /count\(\*\) filter \(where sla_due_at is null\)::integer as out_of_policy_count/
    );
  });

  test("compliance divides by decided and is null when nothing is decided", () => {
    assert.match(
      migrationSql,
      /when \(s\.met_count \+ s\.breached_count\) = 0 then null/
    );
    assert.match(
      migrationSql,
      /round\(\(s\.met_count::numeric \* 10000\) \/ \(s\.met_count \+ s\.breached_count\)\)/
    );
  });

  test("compliance ratio computes exactly on the documented denominator", () => {
    // 7 met, 3 breached, 5 pending -> 70%, unchanged by the pending leads.
    assert.equal(rateBasisPoints(7, 7 + 3), 7_000);
    assert.equal(formatBasisPointsPercent(rateBasisPoints(7, 7 + 3)), "70%");
    // Nothing decided yet is unknown, not 0% and not 100%.
    assert.equal(rateBasisPoints(0, 0), null);
  });

  test("activation is inherited from stored data, never re-derived here", () => {
    // Re-deriving effective_from in the aggregate would let a later activation
    // retroactively rescope a historical cohort.
    assert.doesNotMatch(migrationSql, /effective_from/);
    assert.doesNotMatch(migrationSql, /crm_sla_policies/);
    assert.doesNotMatch(migrationSql, /activated_at/);
  });

  test("breached_at is never read (CRM 2A-2 ships no breach daemon)", () => {
    assert.doesNotMatch(migrationSql, /breached_at/);
  });

  test("SLA never reads a connection outcome, only the attempt column", () => {
    assert.match(migrationSql, /first_contact_attempt_at/);
    assert.doesNotMatch(migrationSql, /connected/i);
    assert.doesNotMatch(migrationSql, /closes_contact_attempt/);
  });

  test("panel documents the attempt semantics and the denominator", () => {
    const panel = readSrc(PANEL);
    assert.match(panel, /qualifying first contact attempt, not a connection/);
    assert.match(panel, /met ÷ \(met \+ breached\)/);
    assert.match(panel, /Outside policy/);
    assert.match(panel, /non-retroactive/);
  });
});

/* ========================================================================== */
/* 4. Conversion: numerator/denominator, terminal + on-hold handling           */
/* ========================================================================== */

describe("CRM 2E conversion funnel", () => {
  test("ladder is the canonical stage reach, closed_lost excluded", () => {
    assert.deepEqual(
      [...CRM_CONVERSION_FUNNEL_STAGES],
      [
        "received",
        "contacted",
        "qualified",
        "consultation_scheduled",
        "proposal_sent",
        "negotiation",
        "closed_won",
      ]
    );
    assert.ok(!(CRM_CONVERSION_FUNNEL_STAGES as readonly string[]).includes("closed_lost"));
    assert.ok(!(CRM_CONVERSION_FUNNEL_STAGES as readonly string[]).includes("on_hold"));
  });

  test("every funnel stage except received is a canonical lead stage", () => {
    for (const stage of CRM_CONVERSION_FUNNEL_STAGES) {
      if (stage === "received") {
        continue;
      }
      assert.ok(
        (LEAD_STAGE_CODES as readonly string[]).includes(stage),
        `${stage} is a canonical lead stage`
      );
    }
  });

  test("every funnel stage has a label", () => {
    for (const stage of CRM_CONVERSION_FUNNEL_STAGES) {
      assert.equal(typeof CRM_CONVERSION_STAGE_LABELS[stage], "string");
      assert.ok(CRM_CONVERSION_STAGE_LABELS[stage].length > 0);
    }
  });

  test("stage reach reads BOTH lead_events payload spellings", () => {
    // transition_lead_status_impl writes {to}; accepted_quotation_close_won_impl
    // writes {to_status}. Reading one spelling would drop accepted-quotation
    // Closed-Won out of the funnel entirely.
    assert.match(
      migrationSql,
      /coalesce\(e\.event_data ->> 'to', e\.event_data ->> 'to_status'\) as to_status/
    );
  });

  test("first entry uses MIN so a hold and resume cannot reset a stage", () => {
    const mins = migrationSql.match(/min\(ev\.occurred_at\) filter/g) ?? [];
    assert.ok(mins.length >= 7, "each measured stage takes its FIRST entry");
    assert.doesNotMatch(migrationSql, /max\(ev\.occurred_at\) filter/);
  });

  test("a lead standing in a stage counts as having reached it", () => {
    assert.match(
      migrationSql,
      /t_contacted is not null or current_status = 'contacted'/
    );
    assert.match(
      migrationSql,
      /t_won is not null or current_status = 'closed_won'/
    );
  });

  test("closed_lost and on_hold are reported outside the ladder", () => {
    assert.match(migrationSql, /'closedLostCount', r\.lost_count/);
    assert.match(migrationSql, /'onHoldCurrentCount', r\.on_hold_current_count/);
    assert.match(
      migrationSql,
      /count\(\*\) filter \(where current_status = 'on_hold'\)::integer as on_hold_current_count/
    );
  });

  test("every step and overall rate names its own denominator", () => {
    assert.match(migrationSql, /'previousStage', 'consultation_scheduled'/);
    assert.match(
      migrationSql,
      /when r\.consultation_count = 0 then null\s*else round\(\(r\.proposal_count::numeric \* 10000\) \/ r\.consultation_count\)/
    );
    assert.match(
      migrationSql,
      /when r\.received_count = 0 then null\s*else round\(\(r\.won_count::numeric \* 10000\) \/ r\.received_count\)/
    );
  });

  test("won rate divides closed_won reach by received", () => {
    assert.match(
      migrationSql,
      /'wonRateBasisPoints', case\s*when r\.received_count = 0 then null\s*else round\(\(r\.won_count::numeric \* 10000\) \/ r\.received_count\)/
    );
  });

  test("worked funnel example holds exactly", () => {
    const received = 200;
    const contacted = 150;
    const qualified = 90;
    const consultation = 60;
    const proposal = 40;
    const negotiation = 25;
    const won = 12;

    assert.equal(rateBasisPoints(contacted, received), 7_500);
    assert.equal(rateBasisPoints(qualified, contacted), 6_000);
    assert.equal(rateBasisPoints(consultation, qualified), 6_667);
    assert.equal(rateBasisPoints(proposal, consultation), 6_667);
    assert.equal(rateBasisPoints(negotiation, proposal), 6_250);
    assert.equal(rateBasisPoints(won, negotiation), 4_800);
    assert.equal(rateBasisPoints(won, received), 600);
    assert.equal(formatBasisPointsPercent(rateBasisPoints(won, received)), "6%");
  });

  test("an empty cohort yields unknown rates, not 0%", () => {
    assert.equal(rateBasisPoints(0, 0), null);
    assert.equal(formatBasisPointsPercent(rateBasisPoints(0, 0), "No data"), "No data");
  });

  test("the status filter is not applied to cohort analytics", () => {
    // Filtering a funnel by current status would destroy its denominators.
    const queries = stripComments(readSrc(QUERIES));
    assert.doesNotMatch(queries, /p_status/);
    assert.doesNotMatch(queries, /filters\.status/);
    assert.doesNotMatch(migrationSql, /p_status\b/);
    assert.match(readSrc(DESIGN_DOC), /status filter is deliberately \*\*not\*\* applied/);
  });
});

/* ========================================================================== */
/* 5. Forecast: CRM 2D reuse, parked/terminal exclusion, unknown ≠ zero        */
/* ========================================================================== */

describe("CRM 2E forecast reuse", () => {
  test("CRM 2D locked probabilities are unchanged", () => {
    assert.deepEqual(CRM_STAGE_PROBABILITY_BASIS_POINTS, {
      new: 500,
      assigned: 1_000,
      contacted: 2_000,
      qualified: 3_500,
      consultation_scheduled: 5_000,
      proposal_sent: 6_500,
      negotiation: 8_000,
      closed_won: 10_000,
      closed_lost: 0,
      on_hold: 0,
    });
    assert.ok(isParkedStage("on_hold"));
    assert.ok(!isParkedStage("negotiation"));
  });

  test("CRM 2D migration still carries the identical probability table", () => {
    const crm2d = stripComments(readSrc(CRM_2D_MIGRATION));
    for (const [stage, bp] of Object.entries(CRM_STAGE_PROBABILITY_BASIS_POINTS)) {
      assert.match(
        crm2d,
        new RegExp(`when '${stage}' then ${bp}\\b`),
        `${stage} probability unchanged in CRM 2D`
      );
    }
  });

  test("CRM 2E does not redeclare probabilities or reimplement the forecast", () => {
    assert.doesNotMatch(migrationSql, /crm_stage_probability_bp/);
    assert.doesNotMatch(migrationSql, /weighted/i);
    assert.doesNotMatch(migrationSql, /quotation_versions/);
    const contracts = stripComments(readSrc(CONTRACTS));
    assert.doesNotMatch(contracts, /6500|8000|3500/);
  });

  test("the forecast comes from the CRM 2D aggregate", () => {
    const queries = readSrc(QUERIES);
    assert.match(queries, /fetchCrmPipelineValueSummary/);
    assert.match(queries, /get_crm_management_analytics/);
  });

  test("forecast stage order excludes terminal and parked stages", () => {
    for (const stage of CRM_FORECAST_STAGE_ORDER) {
      assert.ok(!["closed_won", "closed_lost", "on_hold"].includes(stage));
    }
    assert.equal(forecastStageRank("new"), 0);
    assert.equal(forecastStageRank("negotiation"), CRM_FORECAST_STAGE_ORDER.length - 1);
    assert.equal(forecastStageRank("on_hold"), CRM_FORECAST_STAGE_ORDER.length);
  });

  test("unknown deal value stays unknown and never becomes zero", () => {
    assert.equal(computeWeightedValuePaise(null, "negotiation"), null);
    assert.equal(formatDealValue(null), "Value unknown");
    assert.notEqual(formatDealValue(null), "₹0");
  });

  test("weighted paise arithmetic is exact per lead", () => {
    assert.equal(computeWeightedValuePaise(8_400_000_00, "proposal_sent"), 5_460_000_00);
    assert.equal(computeWeightedValuePaise(1_00, "qualified"), 35);
    assert.equal(computeWeightedValuePaise(3, "qualified"), 1);
    assert.equal(computeWeightedValuePaise(1_000_000, "on_hold"), 0);
  });

  test("panel states parked and unknown handling explicitly", () => {
    const panel = readSrc(PANEL);
    assert.match(panel, /On hold is parked and excluded from active totals/);
    assert.match(panel, /never counted as ₹0/);
    assert.match(panel, /Unknown value/);
    assert.match(panel, /current snapshot, not historical revenue/);
  });

  test("a money aggregate over nothing valued renders unknown, not ₹0", () => {
    // The RPC coalesces an empty SUM to 0 so the payload stays integer-typed.
    // Rendering that 0 as ₹0 would claim a measurement that was never made.
    const panel = readSrc(PANEL);
    assert.match(panel, /function knownAggregatePaise\(/);
    assert.match(panel, /return valuedLeadCount > 0 \? paise : null;/);
    // Every money aggregate on the forecast surface goes through the guard.
    assert.match(
      panel,
      /knownAggregatePaise\(stage\.valuedLeadCount, stage\.dealValuePaise\)/
    );
    assert.match(
      panel,
      /knownAggregatePaise\([\s\S]{0,80}stage\.weightedValuePaise/
    );
    assert.match(
      panel,
      /knownAggregatePaise\([\s\S]{0,120}forecast\.parkedDealValuePaise/
    );
    // `null` is what formatCompactInrFromPaise renders as an explicit unknown.
    assert.equal(formatCompactInrFromPaise(null), "Value unknown");
    assert.equal(formatCompactInrFromPaise(0), "₹0");
  });
});

/* ========================================================================== */
/* 6. Target achievement: accepted commercial truth, exact paise, no zero lie  */
/* ========================================================================== */

describe("CRM 2E target achievement", () => {
  test("achievement reads accepted-quotation truth and the existing credit rule", () => {
    assert.match(migrationSql, /public\.quotation_acceptances/);
    assert.match(migrationSql, /credited_sales_executive_id/);
    assert.match(migrationSql, /taxable_base_paise/);
    assert.match(migrationSql, /sales_achievement_month = v_target_period/);
  });

  test("no second sales-credit rule is invented", () => {
    // Nothing derives credit from assignment, score, priority or lead value.
    assert.doesNotMatch(migrationSql, /estimate_snapshot/);
    assert.doesNotMatch(migrationSql, /grand_total_paise/);
    assert.doesNotMatch(migrationSql, /priority/i);
    assert.doesNotMatch(migrationSql, /score/i);
  });

  test("achievement month is the stored Asia/Kolkata month", () => {
    assert.match(migrationSql, /to_char\(v_target_month, 'YYYY-MM'\)/);
    assert.match(migrationSql, /at time zone 'Asia\/Kolkata'/);
  });

  test("target period resolves from the IST range start", () => {
    const range = resolveReportDateRange({
      preset: "this_month",
      now: new Date("2026-08-15T12:00:00Z"),
    });
    assert.ok(range.range);
    const resolved = resolveTargetPeriodFromRangeStart(range.range.startIso);
    assert.equal(resolved.period, "2026-08");
    assert.equal(resolved.targetMonth, "2026-08-01");
  });

  test("last_month preset resolves the previous IST month", () => {
    const range = resolveReportDateRange({
      preset: "last_month",
      now: new Date("2026-01-05T02:00:00Z"),
    });
    assert.ok(range.range);
    assert.equal(
      resolveTargetPeriodFromRangeStart(range.range.startIso).period,
      "2025-12"
    );
  });

  test("an IST-boundary instant lands in the IST month, not the UTC one", () => {
    // 2026-08-31T20:00Z is already 2026-09-01 in Asia/Kolkata.
    const range = resolveReportDateRange({
      preset: "this_month",
      now: new Date("2026-08-31T20:00:00Z"),
    });
    assert.ok(range.range);
    assert.equal(
      resolveTargetPeriodFromRangeStart(range.range.startIso).period,
      "2026-09"
    );
  });

  test("attainment is exact integer paise", () => {
    const targetPaise = 5_000_000_00; // ₹50,00,000
    const achievedPaise = 3_750_000_00; // ₹37,50,000
    assert.equal(rateBasisPoints(achievedPaise, targetPaise), 7_500);
    assert.equal(
      formatBasisPointsPercent(rateBasisPoints(achievedPaise, targetPaise)),
      "75%"
    );
    assert.equal(Math.max(targetPaise - achievedPaise, 0), 1_250_000_00);
  });

  test("overachievement is reported past 100% with zero remaining", () => {
    const targetPaise = 1_000_000_00;
    const achievedPaise = 1_400_000_00;
    assert.equal(rateBasisPoints(achievedPaise, targetPaise), 14_000);
    assert.equal(Math.max(targetPaise - achievedPaise, 0), 0);
  });

  test("a zero or missing target yields unknown attainment, never a divide", () => {
    assert.equal(rateBasisPoints(500, 0), null);
    assert.match(
      migrationSql,
      /when revenue_target_paise is null or revenue_target_paise <= 0 then null/
    );
    assert.match(migrationSql, /greatest\(revenue_target_paise - achieved_paise, 0\)/);
  });

  test("without quotations.read, achievement is unknown rather than zero", () => {
    assert.match(migrationSql, /v_can_read_commercial := \(select public\.authorize\('quotations\.read'\)\)/);
    assert.match(
      migrationSql,
      /'achievedPaise', case when v_can_read_commercial then achieved_paise else null end/
    );
    assert.match(
      migrationSql,
      /'periodAchievedPaise', case\s*when not v_can_read_commercial then null/
    );
    const panel = readSrc(PANEL);
    assert.match(panel, /Not visible/);
    assert.match(panel, /Unknown/);
  });

  test("headline target picks personal for a scoped owner, team otherwise", () => {
    const personal: CrmTargetAttainmentRow = {
      targetId: "t-personal",
      targetScope: "executive_personal",
      targetUserId: "user-1",
      targetDisplayName: "Asha",
      status: "open",
      revenueTargetPaise: 1_000_000_00,
      closedWonCountTarget: 4,
      achievedPaise: 500_000_00,
      acceptedCount: 2,
      remainingPaise: 500_000_00,
      attainmentBasisPoints: 5_000,
    };
    const team: CrmTargetAttainmentRow = {
      ...personal,
      targetId: "t-team",
      targetScope: "sales_team",
      targetUserId: null,
      targetDisplayName: "Sales team",
    };

    assert.equal(pickHeadlineTargetRow([team, personal], "user-1")?.targetId, "t-personal");
    assert.equal(pickHeadlineTargetRow([personal, team], null)?.targetId, "t-team");
    assert.equal(pickHeadlineTargetRow([team], "user-1"), null);
    assert.equal(pickHeadlineTargetRow([], null), null);
  });
});

/* ========================================================================== */
/* 7. Authorization: role isolation, no aggregate leakage, no widening         */
/* ========================================================================== */

describe("CRM 2E authorization", () => {
  test("the aggregate is SECURITY INVOKER so RLS stays the scope authority", () => {
    assert.match(migrationSql, /security invoker/);
    assert.doesNotMatch(migrationSql, /security definer/);
  });

  test("it gates on crm.reporting.read and a lead read permission", () => {
    assert.match(migrationSql, /public\.authorize\('crm\.reporting\.read'\)/);
    assert.match(migrationSql, /public\.authorize\('leads\.read_all'\)/);
    assert.match(migrationSql, /public\.authorize\('leads\.read_assigned'\)/);
  });

  test("a caller without broad read cannot query another owner", () => {
    assert.match(
      migrationSql,
      /if p_owner_id is not null and p_owner_id is distinct from v_actor then\s*raise exception 'forbidden: cannot query other owner'/
    );
    assert.match(migrationSql, /v_scope_owner := v_actor;/);
  });

  test("a personal scope can never see a team target row", () => {
    assert.match(
      migrationSql,
      /v_scope_owner is null\s*or \(t\.target_scope = 'executive_personal' and t\.target_user_id = v_scope_owner\)/
    );
  });

  test("the server read pins a non-broad caller to their own id", () => {
    const queries = readSrc(QUERIES);
    assert.match(
      queries,
      /if \(!context\.canReadBroad\) \{\s*return context\.userId;/
    );
    assert.match(queries, /assertReportingPermission/);
    assert.match(queries, /canReadCrmReporting/);
  });

  test("no permission, role grant, RLS policy or table is created or altered", () => {
    assert.doesNotMatch(migrationSql, /create table/i);
    assert.doesNotMatch(migrationSql, /alter table/i);
    assert.doesNotMatch(migrationSql, /create policy/i);
    assert.doesNotMatch(migrationSql, /drop policy/i);
    assert.doesNotMatch(migrationSql, /insert into public\.permissions/i);
    assert.doesNotMatch(migrationSql, /insert into public\.role_permissions/i);
    assert.doesNotMatch(migrationSql, /grant .* on table/i);
    assert.doesNotMatch(migrationSql, /service_role/);
  });

  test("execute is granted to authenticated only", () => {
    assert.match(
      migrationSql,
      /revoke all on function public\.get_crm_management_analytics\(timestamptz, timestamptz, date, uuid, uuid\)\s*from public, anon;/
    );
    assert.match(
      migrationSql,
      /grant execute on function public\.get_crm_management_analytics\(timestamptz, timestamptz, date, uuid, uuid\)\s*to authenticated;/
    );
  });

  test("the page separates Management Analytics from My Performance", () => {
    const page = readSrc(REPORTS_PAGE);
    assert.match(page, /const isManagementView = context\.canReadBroad;/);
    assert.match(page, /"Management Analytics"/);
    assert.match(page, /"My Performance"/);
    assert.match(page, /requireCrmReportingAccess/);
    assert.match(page, /canFilterAssignee=\{context\.canReadBroad\}/);
  });

  test("the personal view says team aggregates are not shown", () => {
    assert.match(readSrc(PANEL), /Team aggregates are not shown/);
  });
});

/* ========================================================================== */
/* 8. Payload mapping: counts default to 0, unknowns default to null           */
/* ========================================================================== */

describe("CRM 2E payload mapping", () => {
  test("an empty payload degrades to unknowns, never to fabricated zeroes", () => {
    const mapped = mapManagementAnalyticsPayload(null);
    assert.equal(mapped.sla.complianceBasisPoints, null);
    assert.equal(mapped.velocity.medianFirstContactSeconds, null);
    assert.equal(mapped.conversion.wonRateBasisPoints, null);
    assert.equal(mapped.targets.periodAchievedPaise, null);
    assert.equal(mapped.canReadCommercialTruth, false);
    assert.deepEqual(mapped.velocity.stageTransitions, []);
    assert.deepEqual(mapped.targets.rows, []);
    assert.equal(EMPTY_MANAGEMENT_ANALYTICS.sla.complianceBasisPoints, null);
  });

  test("a full payload maps every documented field", () => {
    const mapped = mapManagementAnalyticsPayload({
      capturedAt: "2026-08-31T12:00:00.000Z",
      scopeOwnerId: "user-1",
      isTeamScope: false,
      canReadCommercialTruth: true,
      sla: {
        cohortLeadCount: 20,
        eligibleCount: 15,
        metCount: 9,
        breachedCount: 3,
        pendingCount: 3,
        outOfPolicyCount: 5,
        decidedCount: 12,
        complianceBasisPoints: 7_500,
      },
      velocity: {
        firstContactSampleSize: 12,
        medianFirstContactSeconds: 1_800,
        activeLeadCount: 8,
        medianActiveLeadAgeSeconds: 259_200,
        medianCurrentStageAgeSeconds: 86_400,
        stageTransitions: [
          { fromStage: "contacted", toStage: "qualified", sampleSize: 6, medianSeconds: 172_800 },
        ],
      },
      conversion: {
        receivedCount: 20,
        closedLostCount: 4,
        onHoldCurrentCount: 2,
        wonRateBasisPoints: 1_500,
        stages: [
          {
            stage: "received",
            reachedCount: 20,
            previousStage: null,
            previousCount: null,
            stepConversionBasisPoints: null,
            overallConversionBasisPoints: 10_000,
          },
          {
            stage: "contacted",
            reachedCount: 15,
            previousStage: "received",
            previousCount: 20,
            stepConversionBasisPoints: 7_500,
            overallConversionBasisPoints: 7_500,
          },
          { stage: "not_a_stage", reachedCount: 99 },
        ],
      },
      targets: {
        period: "2026-08",
        targetMonth: "2026-08-01",
        canReadCommercialTruth: true,
        periodAchievedPaise: 3_750_000_00,
        periodAcceptedCount: 3,
        rows: [
          {
            targetId: "t-1",
            targetScope: "executive_personal",
            targetUserId: "user-1",
            targetDisplayName: "Asha",
            status: "open",
            revenueTargetPaise: 5_000_000_00,
            closedWonCountTarget: 5,
            achievedPaise: 3_750_000_00,
            acceptedCount: 3,
            remainingPaise: 1_250_000_00,
            attainmentBasisPoints: 7_500,
          },
        ],
      },
    });

    assert.equal(mapped.sla.decidedCount, 12);
    assert.equal(mapped.sla.complianceBasisPoints, 7_500);
    assert.equal(mapped.velocity.stageTransitions.length, 1);
    assert.equal(mapped.velocity.stageTransitions[0]?.medianSeconds, 172_800);
    // The unknown stage is dropped rather than mislabelled.
    assert.equal(mapped.conversion.stages.length, 2);
    assert.equal(mapped.conversion.stages[1]?.stepConversionBasisPoints, 7_500);
    assert.equal(mapped.targets.rows[0]?.attainmentBasisPoints, 7_500);
    assert.equal(mapped.targets.periodAchievedPaise, 3_750_000_00);
    assert.equal(mapped.scopeOwnerId, "user-1");
  });

  test("explicit nulls survive mapping as unknowns", () => {
    const mapped = mapManagementAnalyticsPayload({
      canReadCommercialTruth: false,
      sla: { metCount: 0, breachedCount: 0, complianceBasisPoints: null },
      velocity: { medianFirstContactSeconds: null, stageTransitions: [] },
      conversion: { receivedCount: 0, wonRateBasisPoints: null, stages: [] },
      targets: {
        period: "2026-08",
        rows: [
          {
            targetId: "t-1",
            targetScope: "sales_team",
            targetUserId: null,
            targetDisplayName: "Sales team",
            status: "open",
            revenueTargetPaise: 1_000_000_00,
            closedWonCountTarget: 4,
            achievedPaise: null,
            acceptedCount: null,
            remainingPaise: null,
            attainmentBasisPoints: null,
          },
        ],
      },
    });
    assert.equal(mapped.sla.decidedCount, 0);
    assert.equal(mapped.targets.rows[0]?.achievedPaise, null);
    assert.equal(mapped.targets.rows[0]?.attainmentBasisPoints, null);
    assert.notEqual(mapped.targets.rows[0]?.achievedPaise, 0);
  });
});

/* ========================================================================== */
/* 9. Existing reports remain correct + boundaries honoured                    */
/* ========================================================================== */

describe("CRM 2E boundaries", () => {
  test("existing factual reports keep their metrics and the shared filters", () => {
    const panel = readSrc(REPORTS_PANEL);
    for (const marker of [
      "Lead volume",
      "Pipeline status",
      "Lead trend",
      "Lead sources",
      "Assignment / workload",
      "Follow-up health",
      "Lead aging",
      "Closed-lost reasons",
    ]) {
      assert.match(panel, new RegExp(marker.replace("/", "\\/")));
    }
    assert.match(panel, /snapshot\.summary\.totalLeads/);
    assert.match(panel, /snapshot\.followUps\.overdue/);
    assert.match(panel, /snapshot\.agingBuckets/);
    // The analytics slot sits under the one shared filter form.
    assert.match(panel, /\{analytics\}/);
    assert.match(panel, /name="preset"/);
    assert.match(panel, /name="assignee"/);
  });

  test("the reports footer link meets the mobile touch-target floor", () => {
    // Surfaced by the seven-width browser sweep: an inline link inside a
    // paragraph rendered under 32px tall at 360-430px.
    const panel = readSrc(REPORTS_PANEL);
    assert.match(
      panel,
      /href="\/admin\/crm\/targets"[\s\S]{0,40}className="mt-1 inline-flex min-h-11 items-center/
    );
  });

  test("the reporting query layer is untouched by CRM 2E", () => {
    const reporting = readSrc("src/features/crm/server/crm-reporting-queries.ts");
    assert.match(reporting, /fetchCrmReportingSnapshot/);
    assert.doesNotMatch(reporting, /get_crm_management_analytics/);
    assert.doesNotMatch(reporting, /management-analytics/);
  });

  test("the route stays /admin/crm/reports with no second analytics app", () => {
    const page = readSrc(REPORTS_PAGE);
    assert.match(page, /CrmReportsPanel/);
    assert.match(page, /CrmManagementAnalyticsPanel/);
    assert.doesNotMatch(page, /analytics\/(?!)/);
  });

  test("no charting dependency is added", () => {
    const pkg = JSON.parse(readSrc("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ];
    for (const banned of ["recharts", "chart.js", "d3", "victory", "nivo", "apexcharts", "echarts"]) {
      assert.ok(!names.some((name) => name === banned || name.startsWith(`${banned}/`)),
        `${banned} is not a dependency`);
    }
    const panel = readSrc(PANEL);
    assert.doesNotMatch(panel, /from "(recharts|chart\.js|d3|apexcharts)"/);
  });

  test("no AI/ML/LLM/enrichment surface is introduced", () => {
    for (const file of [MIGRATION, CONTRACTS, QUERIES, PANEL, REPORTS_PAGE]) {
      const source = stripComments(readSrc(file));
      for (const banned of [/\bkriti\b/i, /\bjarvis\b/i, /\bopenai\b/i, /\banthropic\b/i, /\bembedding/i, /\bml_model/i, /\benrich/i]) {
        assert.doesNotMatch(source, banned, `${file} has no AI/ML surface`);
      }
    }
  });

  test("estimate_snapshot is never used as a value source", () => {
    for (const file of [MIGRATION, CONTRACTS, QUERIES, PANEL]) {
      assert.doesNotMatch(readSrc(file), /estimate_snapshot/);
    }
  });

  test("no WhatsApp identity workaround is introduced", () => {
    for (const file of [MIGRATION, CONTRACTS, QUERIES, PANEL, REPORTS_PAGE]) {
      const source = stripComments(readSrc(file));
      assert.doesNotMatch(source, /whatsapp_conversations/i);
      assert.doesNotMatch(source, /whatsapp_messages/i);
      assert.doesNotMatch(source, /wa_id/i);
    }
  });

  test("CRM 2E ships exactly one migration and one pgTAP file", () => {
    assert.ok(readSrc(MIGRATION).length > 0);
    const pgtap = readSrc(PGTAP);
    assert.match(pgtap, /get_crm_management_analytics/);
    assert.match(pgtap, /select plan\(/);
  });

  test("the design doc records the formulas and denominators", () => {
    const doc = readSrc(DESIGN_DOC);
    assert.match(doc, /compliance = met \/ decided/);
    assert.match(doc, /stepConversion/);
    assert.match(doc, /overallConversion/);
    assert.match(doc, /percentile_cont\(0\.5\)/);
    assert.match(doc, /never treated as ₹0/);
    assert.match(doc, /No permission, role grant or RLS policy changes/);
    assert.match(doc, /to_status/);
  });
});
