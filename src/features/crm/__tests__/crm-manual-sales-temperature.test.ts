import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  CRM_LEAD_SALES_BUCKETS,
  countSalesBuckets,
  resolveEffectiveSalesBucket,
  resolveLeadSalesBucket,
} from "../contracts/lead-sales-bucket.ts";
import {
  CRM_LEAD_SCORE_BAND_MIN,
  CRM_SCORE_ENGAGEMENT_POINTS,
  CRM_SCORE_MATURITY_POINTS,
  resolveScoreBand,
  type CrmLeadScoreBand,
} from "../contracts/lead-score-contracts.ts";
import {
  CRM_MANUAL_SALES_TEMPERATURES,
  isLifecycleControlledBucket,
  manualSalesTemperatureValue,
  parseManualSalesTemperature,
} from "../contracts/lead-sales-temperature.ts";
import {
  sortSegmentedLeads,
  type CrmSortableLead,
} from "../contracts/lead-segmentation-order.ts";
import {
  CRM_TIMELINE_INCLUDED_EVENT_TYPES,
  formatTimelineEventLabel,
  formatTimelineTemperatureDetail,
  timelineCategoryForEvent,
} from "../contracts/lead-timeline-contracts.ts";
import {
  resolvePipelineUrgency,
  sortPipelineCards,
  type CrmPipelineCard,
} from "../contracts/pipeline-contracts.ts";
import { isLeadsWorkspacePath } from "../contracts/crm-workspace-theme.ts";
import type { LeadStageCode } from "../contracts/lead-stages.ts";

const root = process.cwd();
const read = (rel: string) =>
  readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

const MIGRATION = "supabase/migrations/20260904150000_crm_manual_sales_temperature.sql";
const QUERIES = "src/features/crm/server/crm-lead-queries.ts";
const CONTROL = "src/features/crm/components/leads/LeadSalesTemperatureControl.tsx";
const HEADER = "src/features/crm/components/leads/LeadCommandHeader.tsx";
const ACTIONS = "src/features/crm/server/crm-sales-temperature-actions.ts";
const SERVICE = "src/features/crm/server/crm-sales-temperature-service.ts";
const TABLE = "src/features/crm/components/leads/LeadListTable.tsx";
const CARDS = "src/features/crm/components/leads/LeadListCards.tsx";
const STRIP = "src/features/crm/components/leads/LeadSalesBucketStrip.tsx";
const SCORE = "src/features/crm/contracts/lead-score-contracts.ts";
const TEMPERATURE = "src/features/crm/contracts/lead-sales-temperature.ts";
const TOKENS = "src/features/admin-ops/tokens.css";
const LEADS_PAGE = "src/app/admin/crm/leads/page.tsx";
const DETAIL_PAGE = "src/app/admin/crm/leads/[leadId]/page.tsx";
const PIPELINE_QUERIES = "src/features/crm/server/crm-pipeline-queries.ts";
const PIPELINE_CARD = "src/features/crm/components/pipeline/PipelineLeadCard.tsx";
const PIPELINE_CONTRACTS = "src/features/crm/contracts/pipeline-contracts.ts";
const TIMELINE_CONTRACTS = "src/features/crm/contracts/lead-timeline-contracts.ts";
const TIMELINE_QUERIES = "src/features/crm/server/crm-lead-timeline-queries.ts";
const CRM_LAYOUT = "src/app/admin/crm/layout.tsx";
const SHELL = "src/features/crm/components/shell/CrmWorkspaceShell.tsx";
const HEADER_CTA = "src/features/crm/components/leads/LeadHeaderNextActionCta.tsx";
const ACTIVITY_WORKSPACE =
  "src/features/crm/components/activities/LeadActivityWorkspace.tsx";

const ACTIVE: LeadStageCode = "qualified";

/* ========================================================================== */
/* 1. Effective bucket precedence                                              */
/* ========================================================================== */

describe("effective bucket = lifecycle > manual > system", () => {
  test("closed_lost is LOST whatever anyone marked it", () => {
    for (const manual of [...CRM_MANUAL_SALES_TEMPERATURES, null]) {
      const result = resolveEffectiveSalesBucket("closed_lost", "HOT", manual);
      assert.equal(result.bucket, "LOST");
      assert.equal(result.source, "lifecycle");
    }
  });

  test("closed_won is WON whatever anyone marked it", () => {
    for (const manual of [...CRM_MANUAL_SALES_TEMPERATURES, null]) {
      assert.equal(
        resolveEffectiveSalesBucket("closed_won", "COLD", manual).bucket,
        "WON"
      );
    }
  });

  test("on_hold is ON_HOLD whatever anyone marked it", () => {
    for (const manual of [...CRM_MANUAL_SALES_TEMPERATURES, null]) {
      assert.equal(
        resolveEffectiveSalesBucket("on_hold", "HOT", manual).bucket,
        "ON_HOLD"
      );
    }
  });

  test("a manual WARM overrides a computed COLD", () => {
    const result = resolveEffectiveSalesBucket(ACTIVE, "COLD", "WARM");
    assert.equal(result.bucket, "WARM");
    assert.equal(result.source, "manual");
  });

  test("a manual COLD overrides a computed HOT", () => {
    const result = resolveEffectiveSalesBucket(ACTIVE, "HOT", "COLD");
    assert.equal(result.bucket, "COLD");
    assert.equal(result.source, "manual");
  });

  test("a manual HOT overrides a computed NURTURE", () => {
    assert.equal(
      resolveEffectiveSalesBucket(ACTIVE, "NURTURE", "HOT").bucket,
      "HOT"
    );
  });

  test("with no manual choice the system band decides", () => {
    for (const [band, expected] of [
      ["HOT", "HOT"],
      ["WARM", "WARM"],
      ["NURTURE", "COLD"],
      ["COLD", "COLD"],
    ] as const) {
      const result = resolveEffectiveSalesBucket(ACTIVE, band, null);
      assert.equal(result.bucket, expected, `${band} should fall back to ${expected}`);
      assert.equal(result.source, "system");
    }
  });

  test("NURTURE still folds into COLD, and only at this layer", () => {
    assert.equal(resolveEffectiveSalesBucket(ACTIVE, "NURTURE", null).bucket, "COLD");
    const scoreSource = read(SCORE);
    assert.match(scoreSource, /"HOT", "WARM", "NURTURE", "COLD"/);
    assert.match(scoreSource, /NURTURE: 20/);
  });

  test("nothing is ever unclassified", () => {
    const stages: LeadStageCode[] = [
      "new",
      "assigned",
      "contacted",
      "qualified",
      "consultation_scheduled",
      "proposal_sent",
      "negotiation",
      "closed_won",
      "closed_lost",
      "on_hold",
    ];
    for (const status of stages) {
      for (const band of ["HOT", "WARM", "NURTURE", "COLD"] as CrmLeadScoreBand[]) {
        for (const manual of [...CRM_MANUAL_SALES_TEMPERATURES, null]) {
          const { bucket } = resolveEffectiveSalesBucket(status, band, manual);
          assert.ok(
            (CRM_LEAD_SALES_BUCKETS as readonly string[]).includes(bucket),
            `${status}/${band}/${manual} produced ${bucket}`
          );
        }
      }
    }
  });

  test("a parked lead resumes to the temperature its owner chose", () => {
    // Held: the lifecycle wins and the stored HOT is merely outranked.
    assert.equal(resolveEffectiveSalesBucket("on_hold", "COLD", "HOT").bucket, "ON_HOLD");
    // Resumed with the SAME stored value: the human's judgement returns.
    const resumed = resolveEffectiveSalesBucket("qualified", "COLD", "HOT");
    assert.equal(resumed.bucket, "HOT");
    assert.equal(resumed.source, "manual");
  });

  test("the bucket-only helper agrees with the full resolver", () => {
    for (const manual of [...CRM_MANUAL_SALES_TEMPERATURES, null]) {
      assert.equal(
        resolveLeadSalesBucket(ACTIVE, "COLD", manual),
        resolveEffectiveSalesBucket(ACTIVE, "COLD", manual).bucket
      );
    }
  });
});

/* ========================================================================== */
/* 2. Only three are selectable                                                */
/* ========================================================================== */

describe("LOST / WON / HOLD are lifecycle-only", () => {
  test("exactly three temperatures are selectable", () => {
    assert.deepEqual([...CRM_MANUAL_SALES_TEMPERATURES], ["HOT", "WARM", "COLD"]);
  });

  test("lifecycle words are never accepted as a temperature", () => {
    for (const word of ["LOST", "WON", "ON_HOLD", "HOLD", "on_hold", "lost", "won"]) {
      assert.equal(
        parseManualSalesTemperature(word),
        null,
        `${word} must not parse as a temperature`
      );
    }
  });

  test("the segmented control renders only the three", () => {
    const src = read(CONTROL);
    assert.match(src, /CRM_MANUAL_SALES_TEMPERATURES\.map/);
    // No lifecycle option anywhere in the control.
    assert.doesNotMatch(src, /value="LOST"/);
    assert.doesNotMatch(src, /value="WON"/);
    assert.doesNotMatch(src, /value="ON_HOLD"/);
  });

  test("the action refuses a lifecycle word", () => {
    const src = read(ACTIONS);
    assert.match(src, /parseManualSalesTemperature\(raw\)/);
    assert.match(src, /must be Hot, Warm or Cold/);
  });

  test("the database CHECK allows only hot/warm/cold", () => {
    const src = read(MIGRATION);
    assert.match(
      src,
      /manual_sales_temperature in \('hot', 'warm', 'cold'\)/
    );
    // Never a lifecycle word in the allowed set.
    const check = src.slice(
      src.indexOf("chk_leads_manual_sales_temperature check"),
      src.indexOf("comment on column")
    );
    for (const word of ["'lost'", "'won'", "'on_hold'"]) {
      assert.doesNotMatch(check, new RegExp(word));
    }
  });

  test("lifecycle-controlled buckets are recognised", () => {
    assert.equal(isLifecycleControlledBucket("LOST"), true);
    assert.equal(isLifecycleControlledBucket("WON"), true);
    assert.equal(isLifecycleControlledBucket("ON_HOLD"), true);
    assert.equal(isLifecycleControlledBucket("HOT"), false);
    assert.equal(isLifecycleControlledBucket("WARM"), false);
    assert.equal(isLifecycleControlledBucket("COLD"), false);
  });
});

/* ========================================================================== */
/* 3. Wire values and reset                                                    */
/* ========================================================================== */

describe("setting and clearing", () => {
  test("temperatures travel lowercase, matching the CHECK", () => {
    assert.equal(manualSalesTemperatureValue("HOT"), "hot");
    assert.equal(manualSalesTemperatureValue("WARM"), "warm");
    assert.equal(manualSalesTemperatureValue("COLD"), "cold");
  });

  test("clearing sends null, not an empty string", () => {
    assert.equal(manualSalesTemperatureValue(null), null);
  });

  test("parsing is case-insensitive and whitespace-tolerant", () => {
    assert.equal(parseManualSalesTemperature("hot"), "HOT");
    assert.equal(parseManualSalesTemperature("  Warm "), "WARM");
    assert.equal(parseManualSalesTemperature("COLD"), "COLD");
    assert.equal(parseManualSalesTemperature(""), null);
    assert.equal(parseManualSalesTemperature(null), null);
    assert.equal(parseManualSalesTemperature("tepid"), null);
  });

  test("the Use system control submits an empty value", () => {
    const src = read(CONTROL);
    assert.match(src, /crm-temperature-use-system/);
    assert.match(src, /name="temperature"\s*\n\s*value=""/);
    // Offered only when there is an override to clear.
    assert.match(src, /\{isManual \? \(/);
  });

  test("an empty submission is a reset, not a validation failure", () => {
    const src = read(ACTIONS);
    assert.match(src, /raw\.length === 0 \? null : parseManualSalesTemperature\(raw\)/);
    assert.match(src, /Using the system suggestion/);
  });

  test("a reason is optional, never mandatory", () => {
    const src = read(ACTIONS);
    assert.match(src, /reasonRaw\.length > 0 \? reasonRaw : null/);
    assert.doesNotMatch(src, /reason is required/i);
  });
});

/* ========================================================================== */
/* 4. Authorization                                                            */
/* ========================================================================== */

describe("the database is the authority", () => {
  test("every gate fails closed, in order", () => {
    const src = read(MIGRATION);
    const impl = src.slice(src.indexOf("set_lead_sales_temperature_impl"));
    assert.match(impl, /v_actor := auth\.uid\(\);[\s\S]{0,120}Authentication required/);
    assert.match(impl, /public\.authorize\('leads\.transition'\)/);
    assert.match(impl, /private\.crm_can_mutate_lead\(p_lead_id\)/);
    assert.ok(
      impl.indexOf("auth.uid()") < impl.indexOf("authorize('leads.transition')"),
      "authentication is checked before permission"
    );
  });

  test("a lifecycle-controlled lead refuses the mutation", () => {
    const src = read(MIGRATION);
    assert.match(
      src,
      /v_lead\.status in \('closed_won', 'closed_lost', 'on_hold'\)[\s\S]{0,200}LIFECYCLE_OVERRIDES_TEMPERATURE/
    );
  });

  test("a lifecycle override does NOT erase the stored temperature", () => {
    const src = read(MIGRATION);
    // The refusal raises before any UPDATE, so the stored value survives.
    const refusal = src.indexOf("LIFECYCLE_OVERRIDES_TEMPERATURE");
    const update = src.indexOf("update public.leads\n  set manual_sales_temperature");
    assert.ok(refusal < update, "the refusal must precede any write");
  });

  test("a no-op writes no misleading history", () => {
    assert.match(read(MIGRATION), /v_old is not distinct from v_new[\s\S]{0,80}return v_lead;/);
  });

  test("no service-role client is used in this path", () => {
    for (const rel of [SERVICE, ACTIONS, CONTROL]) {
      assert.doesNotMatch(read(rel), /service_role|createServiceRoleClient|SERVICE_ROLE/);
    }
    assert.match(read(SERVICE), /await createClient\(\)/);
  });

  test("the service adds no second set of rules", () => {
    const src = read(SERVICE);
    // The database owns the checks; duplicating them here would let them drift.
    assert.doesNotMatch(src, /closed_lost|closed_won|on_hold/);
    assert.match(src, /set_lead_sales_temperature/);
  });

  test("the audit reuses the canonical lead_events ledger", () => {
    const src = read(MIGRATION);
    assert.match(src, /insert into public\.lead_events/);
    assert.match(src, /'lead\.sales_temperature_set'/);
    // Every pre-existing event type is preserved.
    for (const type of [
      "lead.created",
      "lead.status_changed",
      "lead.assigned",
      "lead.note_added",
      "lead.duplicate_detected",
      "lead.consent_updated",
      "lead.on_hold",
      "lead.resumed",
    ]) {
      assert.match(src, new RegExp(`'${type.replace(".", "\\.")}'`));
    }
    // No competing audit table.
    assert.doesNotMatch(src, /create table[\s\S]{0,60}temperature_history/i);
  });

  test("the audit records actor, both values and provenance", () => {
    const src = read(MIGRATION);
    assert.match(src, /'from', to_jsonb\(v_old\)/);
    assert.match(src, /'to', to_jsonb\(v_new\)/);
    assert.match(src, /v_actor,/);
    assert.match(src, /'source', case when v_new is null then 'system' else 'manual' end/);
    // clock_timestamp so several changes in one transaction stay ordered.
    assert.match(src, /clock_timestamp\(\)/);
  });
});

/* ========================================================================== */
/* 5. Counts, filtering, ordering                                              */
/* ========================================================================== */

describe("the workspace uses the effective bucket", () => {
  test("monthly counts follow a manual override", () => {
    // One September lead scores COLD; the salesperson marks it WARM.
    const before = countSalesBuckets([
      resolveEffectiveSalesBucket(ACTIVE, "COLD", null).bucket,
    ]);
    assert.equal(before.COLD, 1);
    assert.equal(before.WARM, 0);

    const after = countSalesBuckets([
      resolveEffectiveSalesBucket(ACTIVE, "COLD", "WARM").bucket,
    ]);
    assert.equal(after.COLD, 0);
    assert.equal(after.WARM, 1);
    assert.equal(after.TOTAL, before.TOTAL, "the cohort size is unchanged");
  });

  test("closing that same lead moves it to LOST", () => {
    const lost = countSalesBuckets([
      resolveEffectiveSalesBucket("closed_lost", "COLD", "WARM").bucket,
    ]);
    assert.equal(lost.WARM, 0);
    assert.equal(lost.LOST, 1);
  });

  test("the read model resolves before counting, filtering and slicing", () => {
    const src = read(QUERIES);
    assert.match(src, /resolveEffectiveSalesBucket\(/);
    assert.match(src, /parseManualSalesTemperature\(\s*row\.manual_sales_temperature\s*\)/);

    const resolveAt = src.indexOf("resolveEffectiveSalesBucket(");
    const countAt = src.indexOf("const bucketCounts = countSalesBuckets");
    const filterAt = src.indexOf("? scored.filter");
    const sliceAt = src.indexOf("ordered.slice(from,");
    assert.ok(resolveAt < countAt, "resolution precedes counting");
    assert.ok(countAt < filterAt, "counting precedes filtering");
    assert.ok(filterAt < sliceAt, "filtering precedes the page slice");
  });

  test("the manual column is actually selected", () => {
    assert.match(read(QUERIES), /manual_sales_temperature/);
  });

  test("ordering groups by effective bucket, then advisory score", () => {
    const base: CrmSortableLead = {
      id: "00000000-0000-4000-8000-000000000000",
      salesBucket: "COLD",
      priorityScore: 0,
      primaryNextActionDueAt: null,
      slaBreached: false,
      newUncontacted: false,
      createdAt: "2026-09-01T00:00:00.000Z",
      stageEnteredAt: "2026-09-01T00:00:00.000Z",
    };
    const now = Date.parse("2026-09-10T06:00:00.000Z");

    // Two manually-HOT leads: the advisory score still ranks them.
    const sorted = sortSegmentedLeads(
      [
        { ...base, id: "hot-71", salesBucket: "HOT", priorityScore: 71 },
        { ...base, id: "hot-82", salesBucket: "HOT", priorityScore: 82 },
        { ...base, id: "warm-99", salesBucket: "WARM", priorityScore: 99 },
      ],
      now
    );
    assert.deepEqual(
      sorted.map((entry) => entry.id),
      ["hot-82", "hot-71", "warm-99"],
      "bucket groups first, score orders within the group"
    );
  });

  test("terminal work still sinks below active work", () => {
    const base: CrmSortableLead = {
      id: "x",
      salesBucket: "COLD",
      priorityScore: 0,
      primaryNextActionDueAt: null,
      slaBreached: false,
      newUncontacted: false,
      createdAt: "2026-09-01T00:00:00.000Z",
      stageEnteredAt: "2026-09-01T00:00:00.000Z",
    };
    const sorted = sortSegmentedLeads([
      { ...base, id: "lost", salesBucket: "LOST", priorityScore: 100 },
      { ...base, id: "cold", salesBucket: "COLD", priorityScore: 1 },
    ]);
    assert.equal(sorted[0]!.id, "cold");
  });
});

/* ========================================================================== */
/* 6. The score engine is untouched                                            */
/* ========================================================================== */

describe("the advisory score is unchanged", () => {
  test("thresholds are exactly as before", () => {
    assert.equal(CRM_LEAD_SCORE_BAND_MIN.HOT, 70);
    assert.equal(CRM_LEAD_SCORE_BAND_MIN.WARM, 45);
    assert.equal(CRM_LEAD_SCORE_BAND_MIN.NURTURE, 20);
    assert.equal(CRM_LEAD_SCORE_BAND_MIN.COLD, 0);
    assert.equal(resolveScoreBand(70), "HOT");
    assert.equal(resolveScoreBand(69), "WARM");
    assert.equal(resolveScoreBand(44), "NURTURE");
    assert.equal(resolveScoreBand(19), "COLD");
  });

  test("weights are exactly as before", () => {
    assert.equal(CRM_SCORE_MATURITY_POINTS.new, 0);
    assert.equal(CRM_SCORE_MATURITY_POINTS.negotiation, 60);
    assert.equal(CRM_SCORE_ENGAGEMENT_POINTS.FIRST_CONTACT_ATTEMPT, 5);
    assert.equal(CRM_SCORE_ENGAGEMENT_POINTS.LIVE_ISSUED_QUOTATION, 10);
  });

  test("the score engine knows nothing about manual temperature", () => {
    const src = read(SCORE);
    assert.doesNotMatch(src, /manual_sales_temperature/);
    assert.doesNotMatch(src, /manualSalesTemperature/);
  });

  test("no SQL scoring duplicate was introduced", () => {
    const src = read(MIGRATION);
    assert.doesNotMatch(src, /priority_score|score_band|priorityScore/i);
  });
});

/* ========================================================================== */
/* 7. Milestones stay separate                                                 */
/* ========================================================================== */

describe("site visit and quotation are untouched", () => {
  test("neither is read by the temperature contract", () => {
    const src = read(TEMPERATURE);
    assert.doesNotMatch(src, /siteVisit|site_visit/i);
    assert.doesNotMatch(src, /quotation/i);
  });

  test("both still render on desktop and mobile", () => {
    for (const rel of [TABLE, CARDS]) {
      const src = read(rel);
      assert.match(src, /CRM_SITE_VISIT_STATE_LABELS\[item\.siteVisitState\]/);
      assert.match(src, /formatLeadQuotationState\(item\.quotationState\)/);
    }
  });

  test("the migration creates no second milestone model", () => {
    const src = read(MIGRATION);
    assert.doesNotMatch(src, /site_visit/);
    assert.doesNotMatch(src, /quotation_/);
  });
});

/* ========================================================================== */
/* 9. Premium dark theme                                                       */
/* ========================================================================== */

describe("the Leads workspace is premium dark", () => {
  test("a dark token layer exists and is centralized", () => {
    const css = read(TOKENS);
    assert.match(css, /\.od-crm-dark \{/);
    // Near-black ground, deep slate cards.
    assert.match(css, /--crm-bg: #0b1017;/);
    assert.match(css, /--crm-surface: #141b24;/);
    // Off-white primary text, muted cool-gray secondary.
    assert.match(css, /--crm-text: #eef2f6;/);
    assert.match(css, /--crm-text-secondary: #a9b7c7;/);
    // Warm ONEDECORE gold as the primary accent.
    assert.match(css, /--crm-primary: #c89d3c;/);
  });

  test("the semantic colour roles are restrained and correct", () => {
    const dark = read(TOKENS).slice(read(TOKENS).indexOf(".od-crm-dark {"));
    assert.match(dark, /Red is reserved for destructive and SLA alerts/);
    assert.match(dark, /Amber for warning and hold/);
    assert.match(dark, /Green for won/);
    assert.match(dark, /Cool blue for system information/);
    // No neon, no glass blur, no heavy gradients.
    assert.doesNotMatch(dark, /backdrop-filter|blur\(/);
    assert.doesNotMatch(dark, /linear-gradient|radial-gradient/);
  });

  test("ink on a filled accent is a token, not a hardcoded white", () => {
    const css = read(TOKENS);
    // White on gold is ~2:1 and fails. The dark theme supplies near-black ink.
    assert.match(css, /\.od-crm \.crm-btn-primary \{[\s\S]{0,120}color: var\(--crm-on-primary\)/);
    assert.match(css, /\.od-crm \.crm-btn-danger \{[\s\S]{0,120}color: var\(--crm-on-danger\)/);
    assert.match(css, /--crm-on-primary: #14100a;/);
    assert.doesNotMatch(css, /\.crm-btn-primary \{[\s\S]{0,120}color: #ffffff/);
  });

  test("elevation is restrained, and radii sit in the 10-14px band", () => {
    const dark = read(TOKENS).slice(read(TOKENS).indexOf(".od-crm-dark {"));
    assert.match(dark, /--crm-radius: 12px;/);
    assert.match(dark, /--crm-radius-sm: 10px;/);
    assert.match(dark, /border-radius: 14px;/);
    assert.match(dark, /box-shadow:[\s\S]{0,140}rgba\(0, 0, 0, 0\.4\)/);
  });

  test("the theme is applied at the CRM ROOT for Leads routes only", () => {
    // It used to sit on an inner page div, which left the outer workspace, the
    // nav and the gutters light around a dark island.
    assert.equal(isLeadsWorkspacePath("/admin/crm/leads"), true);
    assert.equal(isLeadsWorkspacePath("/admin/crm/pipeline"), false);
    assert.match(read(SHELL), /od-crm space-y-5\$\{dark \? " od-crm-dark" : ""\}/);
    // Deliberately not CRM-wide: other workspaces keep their reviewed palette.
    assert.match(read(TOKENS), /NOT applied CRM-wide/);
  });

  test("no CRM badge is stranded on a hardcoded light colour", () => {
    for (const rel of [
      "src/features/crm/components/leads/LeadStatusBadge.tsx",
      "src/features/crm/components/leads/LeadDetailTimeline.tsx",
    ]) {
      const src = read(rel);
      // Pale-on-pale literals would stay light inside the dark theme.
      for (const literal of ["#eef2ff", "#ecfeff", "#f5f3ff", "#4338ca", "#0e7490", "#6d28d9"]) {
        assert.doesNotMatch(src, new RegExp(literal), `${rel} still hardcodes ${literal}`);
      }
    }
  });

  test("reduced motion and focus rules still apply", () => {
    const css = read(TOKENS);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /focus-visible/);
  });

  test("MEASURED contrast ratios are documented alongside the palette", () => {
    const css = read(TOKENS);
    // Computed, not estimated: every pair was measured before being recorded.
    assert.match(css, /Contrast, MEASURED \(WCAG AA needs 4\.5:1/);
    assert.match(css, /#eef2f6 on #0b1017\s+16\.96:1/);
    assert.match(css, /#14100a on #c89d3c\s+7\.53:1/);
    assert.match(css, /Every pair clears AA; none relies on colour alone\./);
  });
});

/* ========================================================================== */
/* 10. Pipeline consistency                                                    */
/* ========================================================================== */

describe("the pipeline board shows the same effective bucket", () => {
  test("the projection selects the manual temperature", () => {
    const src = read(PIPELINE_QUERIES);
    assert.match(src, /manual_sales_temperature/);
    assert.match(src, /readonly manual_sales_temperature: string \| null;/);
  });

  test("it parses and resolves with the canonical functions", () => {
    const src = read(PIPELINE_QUERIES);
    assert.match(src, /parseManualSalesTemperature\(\s*row\.manual_sales_temperature\s*\)/);
    assert.match(src, /resolveEffectiveSalesBucket\(/);
    // No second resolver anywhere on this surface.
    assert.doesNotMatch(src, /function resolve\w*Bucket/);
  });

  test("the card contract carries bucket, source and temperature", () => {
    const src = read(PIPELINE_CONTRACTS);
    assert.match(src, /readonly salesBucket: CrmLeadSalesBucket;/);
    assert.match(src, /readonly salesBucketSource: CrmSalesBucketSource;/);
    assert.match(src, /readonly manualSalesTemperature: CrmManualSalesTemperature \| null;/);
  });

  test("the card renders the badge with its provenance", () => {
    const src = read(PIPELINE_CARD);
    assert.match(src, /<LeadSalesBucketBadge\s+bucket=\{card\.salesBucket\}/);
    assert.match(src, /source=\{card\.salesBucketSource\}/);
  });

  test("a manual choice wins on the board exactly as in the list", () => {
    // The board calls the same resolver, so these are its results too.
    assert.equal(resolveEffectiveSalesBucket("qualified", "COLD", "WARM").bucket, "WARM");
    assert.equal(resolveEffectiveSalesBucket("qualified", "HOT", "COLD").bucket, "COLD");
    assert.equal(resolveEffectiveSalesBucket("qualified", "COLD", null).bucket, "COLD");
    assert.equal(resolveEffectiveSalesBucket("qualified", "HOT", null).bucket, "HOT");
  });

  test("an ON HOLD card reads HOLD, because lifecycle wins", () => {
    // `on_hold` is a board column, so this is a case the board really renders.
    const held = resolveEffectiveSalesBucket("on_hold", "HOT", "HOT");
    assert.equal(held.bucket, "ON_HOLD");
    assert.equal(held.source, "lifecycle");
  });

  test("existing urgency ordering is untouched", () => {
    const base: CrmPipelineCard = {
      leadId: "a",
      displayName: "A",
      salesBucket: "COLD",
      salesBucketSource: "system",
      manualSalesTemperature: null,
      status: "contacted",
      serviceCode: "modular-kitchens",
      locality: null,
      sourceLabel: "Manual",
      assigneeId: null,
      assigneeLabel: "Unassigned",
      primaryNextActionTitle: null,
      primaryNextActionType: null,
      primaryNextActionDueAt: null,
      slaBreached: false,
      newUncontacted: false,
      stageEnteredAt: "2026-09-01T00:00:00.000Z",
      stageEnteredSource: "created",
      createdAt: "2026-09-01T00:00:00.000Z",
      score: {
        priorityScore: 0,
        band: "COLD",
        reasons: [],
        riskFlags: [],
        maturityPoints: 0,
        engagementPoints: 0,
        isActivePriorityRankable: true,
        computedAt: "2026-09-01T00:00:00.000Z",
        signalsAvailable: { slaPolicyActive: false, whatsappLinked: false },
      },
      dealValuePaise: null,
      commercialState: "unknown",
    };
    const now = Date.parse("2026-09-10T06:00:00.000Z");

    // The ladder still ranks by urgency, NOT by the new bucket field.
    assert.equal(resolvePipelineUrgency({ ...base, slaBreached: true }, now), "sla_breach");
    assert.equal(resolvePipelineUrgency(base, now), "no_next_action");

    const sorted = sortPipelineCards(
      [
        { ...base, leadId: "calm", primaryNextActionDueAt: "2026-09-20T06:00:00.000Z" },
        { ...base, leadId: "breach", slaBreached: true },
      ],
      now
    );
    assert.deepEqual(sorted.map((card) => card.leadId), ["breach", "calm"]);

    // A HOT bucket must not jump the urgency ladder on the board.
    const bucketDoesNotReorder = sortPipelineCards(
      [
        { ...base, leadId: "cold-breach", salesBucket: "COLD", slaBreached: true },
        { ...base, leadId: "hot-calm", salesBucket: "HOT", primaryNextActionDueAt: "2026-09-20T06:00:00.000Z" },
      ],
      now
    );
    assert.deepEqual(
      bucketDoesNotReorder.map((card) => card.leadId),
      ["cold-breach", "hot-calm"],
      "stage-board ordering stays urgency-first"
    );
  });
});

/* ========================================================================== */
/* 11. Timeline audit visibility                                               */
/* ========================================================================== */

describe("the temperature audit is visible in the timeline", () => {
  test("the event is included in the timeline vocabulary", () => {
    assert.ok(
      (CRM_TIMELINE_INCLUDED_EVENT_TYPES as readonly string[]).includes(
        "lead.sales_temperature_set"
      )
    );
  });

  test("the raw code is never shown", () => {
    const label = formatTimelineEventLabel("lead.sales_temperature_set");
    assert.equal(label, "Sales temperature changed");
    assert.doesNotMatch(label, /lead\./);
    assert.doesNotMatch(label, /_/);
  });

  test("it reuses an existing category", () => {
    const category = timelineCategoryForEvent("lead.sales_temperature_set");
    assert.equal(category, "stage");
    // No new category was invented for one event type.
    const src = read(TIMELINE_CONTRACTS);
    const categories = src.slice(
      src.indexOf("export const CRM_TIMELINE_CATEGORIES"),
      src.indexOf("export type CrmTimelineCategory")
    );
    assert.doesNotMatch(categories, /temperature/i);
  });

  test("from and to render human-readably", () => {
    assert.equal(
      formatTimelineTemperatureDetail({ from: null, to: "hot" }),
      "System \u2192 Hot"
    );
    assert.equal(
      formatTimelineTemperatureDetail({ from: "cold", to: "warm" }),
      "Cold \u2192 Warm"
    );
    // Clearing the override reads as a return to the system suggestion.
    assert.equal(
      formatTimelineTemperatureDetail({ from: "warm", to: null }),
      "Warm \u2192 System"
    );
  });

  test("a payload with neither side yields no empty arrow", () => {
    assert.equal(formatTimelineTemperatureDetail({}), null);
    assert.equal(formatTimelineTemperatureDetail(null), null);
    assert.equal(formatTimelineTemperatureDetail("nonsense"), null);
    assert.equal(formatTimelineTemperatureDetail({ source: "manual" }), null);
  });

  test("the query renders that detail for this event only", () => {
    const src = read(TIMELINE_QUERIES);
    assert.match(
      src,
      /row\.event_type === "lead\.sales_temperature_set"\s*\n?\s*\? formatTimelineTemperatureDetail\(row\.event_data\)\s*\n?\s*: null/
    );
    // event_data is already projected; actor and instant come from the row.
    assert.match(src, /select\("id, event_type, occurred_at, actor_id, actor_type, event_data"\)/);
    assert.match(src, /occurredAt: row\.occurred_at/);
    assert.match(src, /labelForUser\(row\.actor_id\)/);
  });

  test("no duplicate activity twin was introduced", () => {
    const migration = read(MIGRATION);
    // The audit is one lead_events row; no lead_activities mirror.
    assert.doesNotMatch(migration, /lead_activities/);
    const inserts = migration.match(/insert into public\.lead_events/g) ?? [];
    assert.equal(inserts.length, 1);
  });
});

/* ========================================================================== */
/* 12. The dark theme reaches the workspace ROOT                               */
/* ========================================================================== */

describe("the Leads dark theme is route-scoped at the CRM root", () => {
  test("only the Leads routes activate it", () => {
    for (const path of [
      "/admin/crm/leads",
      "/admin/crm/leads/new",
      "/admin/crm/leads/11111111-1111-4111-8111-111111111111",
      "/admin/crm/leads/abc/anything",
    ]) {
      assert.equal(isLeadsWorkspacePath(path), true, `${path} should be dark`);
    }
  });

  test("every other CRM route stays light", () => {
    for (const path of [
      "/admin/crm",
      "/admin/crm/pipeline",
      "/admin/crm/my-day",
      "/admin/crm/calendar",
      "/admin/crm/reports",
      "/admin/crm/imports",
      // A near-miss that must NOT match: a different segment with the prefix.
      "/admin/crm/leadsources",
      "/admin/quotations",
      null,
    ]) {
      assert.equal(isLeadsWorkspacePath(path), false, `${path} should stay light`);
    }
  });

  test("the class lands on the SAME element as .od-crm", () => {
    const shell = read(SHELL);
    // `.od-crm` declares `background: var(--crm-bg)`; the dark layer only
    // redefines that variable. On a different element the outer workspace, the
    // nav and the gutters stayed light around a dark island.
    assert.match(shell, /className=\{`od-crm space-y-5\$\{dark \? " od-crm-dark" : ""\}`\}/);
    assert.match(shell, /data-crm-theme=\{dark \? "dark" : "light"\}/);
  });

  test("the CRM layout renders that shell, so the nav is inside it", () => {
    const layout = read(CRM_LAYOUT);
    assert.match(layout, /<CrmWorkspaceShell>/);
    assert.match(layout, /<\/CrmWorkspaceShell>/);
    // The nav is a CHILD of the themed root, so it inherits the dark tokens.
    const shellStart = layout.indexOf("<CrmWorkspaceShell>", layout.indexOf("return ("));
    const navAt = layout.indexOf("<CrmNav", shellStart);
    const shellEnd = layout.indexOf("</CrmWorkspaceShell>", shellStart);
    assert.ok(navAt > shellStart && navAt < shellEnd, "CrmNav must sit inside the themed root");
    // No raw `.od-crm` div left behind.
    assert.doesNotMatch(layout, /className="od-crm /);
  });

  test("the pages no longer carry a second copy of the theme class", () => {
    // Two sources for one theme is exactly how they drift apart.
    assert.doesNotMatch(read(LEADS_PAGE), /od-crm-dark/);
    assert.doesNotMatch(read(DETAIL_PAGE), /od-crm-dark/);
  });

  test("the palette is defined exactly once", () => {
    const css = read(TOKENS);
    const blocks = css.match(/^\.od-crm-dark \{/gm) ?? [];
    assert.equal(blocks.length, 1, "the dark palette must not be duplicated");
    // And the token names are declared once inside it.
    const dark = css.slice(css.indexOf(".od-crm-dark {"));
    assert.equal((dark.match(/--crm-bg:/g) ?? []).length, 1);
    assert.equal((dark.match(/--crm-primary:/g) ?? []).length, 1);
  });
});

/* ========================================================================== */
/* 13. The header next-action CTA                                              */
/* ========================================================================== */

describe("the header carries the next-action CTA", () => {
  test("the no-primary branch renders the CTA beside the message", () => {
    const src = read(HEADER);
    assert.match(src, /No primary next action/);
    assert.match(src, /<LeadHeaderNextActionCta/);
    // Both live in one row, so the header states the problem AND offers the fix.
    const branch = src.slice(src.indexOf("No primary next action") - 400);
    assert.match(branch.slice(0, 900), /flex flex-wrap items-center/);
  });

  test("a lead WITH a primary action shows the summary, not the CTA", () => {
    const src = read(HEADER);
    const ctaAt = src.indexOf("<LeadHeaderNextActionCta");
    const elseAt = src.lastIndexOf(") : (", ctaAt);
    assert.ok(elseAt > 0 && elseAt < ctaAt, "the CTA must sit in the else branch only");
    // The primary-present branch renders the due state instead.
    assert.match(src, /activityDueStateLabel\(dueState\)/);
  });

  test("it dispatches the EXISTING intent and mutates nothing", () => {
    const src = read(HEADER_CTA);
    assert.match(src, /useLeadActions/);
    assert.match(
      src,
      /dispatchIntent\(\{ kind: "create-activity", activityType: null \}\)/
    );
    // No server action, no form, no fetch — the workspace owns the mutation.
    assert.doesNotMatch(src, /"use server"/);
    assert.doesNotMatch(src, /useActionState|<form|fetch\(|supabase/);
  });

  test("no second activity mutation was introduced anywhere", () => {
    const src = read(HEADER_CTA);
    assert.doesNotMatch(src, /createLeadFollowUp|create_lead_follow_up/);
    // The activity workspace is still the single create-form authority.
    assert.match(read(ACTIVITY_WORKSPACE), /scrollToCreateForm/);
  });

  test("gating mirrors the canonical workspace rule exactly", () => {
    const cta = read(HEADER_CTA);
    const workspace = read(ACTIVITY_WORKSPACE);

    // The canonical rule.
    assert.match(
      workspace,
      /!primaryActivity &&\s*\n\s*!isTerminal &&\s*\n\s*isAssigned &&\s*\n\s*leadStatus !== "on_hold" &&\s*\n\s*canManageLeadFollowUps/
    );
    // The CTA refuses on every one of the same grounds.
    assert.match(cta, /!canManageLeadFollowUps \|\| isTerminal \|\| isOnHold/);
    assert.match(cta, /if \(!isAssigned\)/);
    assert.match(cta, /return null;/);
  });

  test("an unassigned lead gets an honest state, not a dead button", () => {
    const src = read(HEADER_CTA);
    assert.match(src, /crm-header-next-action-needs-assignment/);
    assert.match(src, /Assign an owner to schedule one/);
    // The message is not a button, because pressing it could not work.
    // Just the unassigned branch body, up to its closing brace.
    const start = src.indexOf("if (!isAssigned) {");
    const block = src.slice(start, src.indexOf("\n  }", start));
    assert.match(block, /<span/);
    assert.doesNotMatch(block, /<button/);
    assert.doesNotMatch(block, /dispatchIntent/);
  });

  test("the header receives the canonical gating props", () => {
    const header = read(HEADER);
    assert.match(header, /readonly isAssigned: boolean;/);
    assert.match(header, /readonly canManageLeadFollowUps: boolean;/);
    assert.match(header, /isTerminal=\{isTerminalLeadStage\(status\)\}/);
    assert.match(header, /isOnHold=\{status === "on_hold"\}/);

    const page = read(DETAIL_PAGE);
    assert.match(page, /isAssigned=\{lead\.assignment\.currentAssigneeId !== null\}/);
    assert.match(page, /canManageLeadFollowUps=\{context\?\.canManageLeadFollowUps \?\? false\}/);
  });

  test("the CTA meets the mobile touch target and wraps", () => {
    const src = read(HEADER_CTA);
    assert.match(src, /min-h-11/);
    assert.match(read(HEADER), /flex flex-wrap items-center gap-2\.5/);
  });
});

/* ========================================================================== */
/* 8. UI                                                                       */
/* ========================================================================== */

describe("the workspace labels every indicator", () => {
  test("the header labels temperature, score and stage separately", () => {
    const src = read(HEADER);
    // Three chips that all read "COLD" were indistinguishable before.
    assert.match(src, />\s*Temp\s*</);
    assert.match(src, />\s*Score\s*</);
    assert.match(src, />\s*Stage\s*</);
    assert.match(src, /<LeadSalesBucketBadge bucket=\{effective\.bucket\} \/>/);
    assert.match(src, /<LeadScoreChip score=\{score\}/);
    assert.match(src, /<LeadStatusBadge status=\{status\} \/>/);
  });

  test("the header derives the bucket once, from the shared resolver", () => {
    const src = read(HEADER);
    assert.match(src, /resolveEffectiveSalesBucket\(/);
    assert.doesNotMatch(src, /deriveLeadScore/);
  });

  test("AUTO vs MANUAL is explicit", () => {
    const src = read(CONTROL);
    assert.match(src, /CRM_SALES_BUCKET_SOURCE_LABELS\[source\]/);
    assert.match(src, /data-testid="crm-temperature-source"/);
    const contract = read(TEMPERATURE);
    assert.match(contract, /system: "Auto"/);
    assert.match(contract, /manual: "Manual"/);
    assert.match(contract, /Using the system suggestion/);
  });

  test("the control is disabled while the lifecycle owns the bucket", () => {
    const src = read(HEADER);
    assert.match(src, /canEdit=\{canSetTemperature && !lifecycleControlled\}/);
    assert.match(src, /isLifecycleControlledBucket\(effective\.bucket\)/);
    const control = read(CONTROL);
    assert.match(control, /crm-temperature-locked/);
    assert.match(control, /returns when the lead resumes/);
  });

  test("classification is one click — no modal", () => {
    const src = read(CONTROL);
    assert.match(src, /type="submit"/);
    assert.doesNotMatch(src, /<dialog|role="dialog"|confirm\(/);
  });

  test("touch targets stay usable on mobile", () => {
    const src = read(CONTROL);
    // 44px practical minimum; min-h-11 is 2.75rem.
    const buttons = src.match(/min-h-11/g) ?? [];
    assert.ok(buttons.length >= 2, "temperature buttons need a real touch target");
    assert.match(src, /flex-wrap/);
  });

  test("list rows show the provenance without a second column", () => {
    assert.match(read(TABLE), /source=\{item\.salesBucketSource\}/);
    assert.match(read(CARDS), /source=\{item\.salesBucketSource\}/);
    const badge = read("src/features/crm/components/leads/LeadSalesBucketBadge.tsx");
    // Never shape- or colour-only.
    assert.match(badge, /<span className="sr-only">Set manually<\/span>/);
  });

  test("the strip keeps all seven tabs and its labels", () => {
    const src = read(STRIP);
    assert.match(src, /crm-bucket-tab-all/);
    assert.match(src, /CRM_LEAD_SALES_BUCKET_LABELS\[bucket\]/);
    assert.match(src, /countsExact \? count : "—"/);
  });

  test("the temperature control is never a lifecycle transition", () => {
    const src = read(CONTROL);
    assert.doesNotMatch(src, /transitionLeadStatus|closed_won|closed_lost|Mark WON/i);
    assert.match(src, /setLeadSalesTemperatureAction/);
  });
});
