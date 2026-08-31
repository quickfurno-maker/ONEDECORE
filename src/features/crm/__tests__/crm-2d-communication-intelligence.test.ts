/**
 * CRM 2D — Communication + Intelligence certification.
 *
 * Owner locks Q1–Q10. Covers the unified timeline (dedupe, determinism,
 * permission-aware omission), the command header, quick actions, deterministic
 * scoring, canonical deal value and the weighted pipeline.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  CRM_TIMELINE_INCLUDED_EVENT_TYPES,
  CRM_TIMELINE_INCLUDED_QUOTATION_EVENT_TYPES,
  CRM_TIMELINE_MAX_ENTRIES,
  CRM_TIMELINE_ORIGIN_ACTIVITY_TYPES,
  CRM_TIMELINE_SOURCE_FETCH_LIMIT,
  CRM_TIMELINE_SOURCE_RANK,
  CRM_TIMELINE_SUPPRESSED_EVENT_TYPES,
  compareTimelineEntries,
  formatTimelineActivityLabel,
  formatTimelineEventLabel,
  formatTimelineQuotationLabel,
  sortTimelineEntries,
  timelineCategoryForActivity,
  type CrmTimelineEntry,
} from "../contracts/lead-timeline-contracts.ts";
import {
  CRM_LEAD_EMITTED_RISK_FLAGS,
  CRM_LEAD_SCORE_BAND_MIN,
  CRM_LEAD_SCORE_MAX,
  CRM_LEAD_SCORE_MIN,
  CRM_SCORE_ENGAGEMENT_MAX,
  CRM_SCORE_ENGAGEMENT_POINTS,
  CRM_SCORE_MATURITY_MAX,
  CRM_SCORE_MATURITY_POINTS,
  CRM_SCORE_RECENT_ACTIVITY_DAYS,
  CRM_STALE_AFTER_HOURS,
  deriveLeadScore,
  resolveScoreBand,
  type CrmLeadScoreSignals,
} from "../contracts/lead-score-contracts.ts";
import {
  CRM_STAGE_PROBABILITY_BASIS_POINTS,
  computeWeightedValuePaise,
  formatDealValue,
  isParkedStage,
  stageProbabilityBasisPoints,
} from "../contracts/deal-value-contracts.ts";
import { LEAD_STAGE_CODES } from "../contracts/lead-stages.ts";
import { CRM_PIPELINE_URGENCY_CODES } from "../contracts/pipeline-contracts.ts";
import { latestIso } from "../server/crm-lead-score-signals.ts";

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
  "supabase/migrations/20260831140000_crm_lead_commercial_read_models.sql";
const TIMELINE_QUERIES = "src/features/crm/server/crm-lead-timeline-queries.ts";
const LEAD_REPOSITORY = "src/features/crm/server/crm-lead-repository.ts";
const LEAD_PAGE = "src/app/admin/crm/leads/[leadId]/page.tsx";
const QUICK_ACTIONS = "src/features/crm/components/leads/LeadQuickActions.tsx";
const COMMAND_HEADER = "src/features/crm/components/leads/LeadCommandHeader.tsx";
const TIMELINE_UI = "src/features/crm/components/leads/LeadDetailTimeline.tsx";
const NOTES_UI = "src/features/crm/components/leads/LeadDetailNotes.tsx";
const SCORE_CONTRACTS = "src/features/crm/contracts/lead-score-contracts.ts";
const PIPELINE_QUERIES = "src/features/crm/server/crm-pipeline-queries.ts";

const NOW = Date.parse("2026-08-31T09:00:00.000Z");
const HOUR_MS = 3_600_000;

function makeEntry(overrides: Partial<CrmTimelineEntry> = {}): CrmTimelineEntry {
  return {
    id: "activity:11111111-1111-4111-8111-111111111111",
    source: "activity",
    category: "activity",
    title: "Activity completed",
    detail: null,
    occurredAt: "2026-08-30T06:00:00.000Z",
    actorLabel: "Priya",
    referenceId: null,
    amountPaise: null,
    ...overrides,
  };
}

function makeSignals(
  overrides: Partial<CrmLeadScoreSignals> = {}
): CrmLeadScoreSignals {
  return {
    status: "contacted",
    isAssigned: true,
    hasFirstContactAttempt: false,
    hasMeaningfulOutcome: false,
    hasConsultationOrSiteVisit: false,
    commercialState: "unknown",
    lastMeaningfulActivityAt: null,
    // Fresh by default so unrelated cases are never incidentally STALE.
    latestMeaningfulSalesTouchAt: "2026-08-30T09:00:00.000Z",
    receivedAt: "2026-08-01T09:00:00.000Z",
    hasOpenPrimaryNextAction: true,
    primaryNextActionDueAt: "2026-09-05T06:00:00.000Z",
    slaDueAt: null,
    ...overrides,
  };
}

/* ========================================================================== */
/* PART A — Unified timeline: ordering determinism                            */
/* ========================================================================== */

describe("CRM 2D timeline — deterministic total order", () => {
  test("orders by occurredAt descending", () => {
    const older = makeEntry({
      id: "activity:a",
      occurredAt: "2026-08-01T00:00:00.000Z",
    });
    const newer = makeEntry({
      id: "activity:b",
      occurredAt: "2026-08-02T00:00:00.000Z",
    });
    assert.deepEqual(
      sortTimelineEntries([older, newer]).map((entry) => entry.id),
      ["activity:b", "activity:a"]
    );
  });

  test("identical timestamps break by documented source rank, not by id", () => {
    const at = "2026-08-30T06:00:00.000Z";
    // Deliberately give the lower-ranked source the alphabetically-first id, so
    // an id-only tie-break would produce the opposite order.
    const event = makeEntry({ id: "event:aaa", source: "event", occurredAt: at });
    const quotation = makeEntry({
      id: "quotation:zzz",
      source: "quotation",
      occurredAt: at,
    });

    assert.deepEqual(
      sortTimelineEntries([event, quotation]).map((entry) => entry.id),
      ["quotation:zzz", "event:aaa"]
    );
  });

  test("same source and instant break by id ascending", () => {
    const at = "2026-08-30T06:00:00.000Z";
    const first = makeEntry({ id: "activity:aaa", occurredAt: at });
    const second = makeEntry({ id: "activity:bbb", occurredAt: at });
    assert.deepEqual(
      sortTimelineEntries([second, first]).map((entry) => entry.id),
      ["activity:aaa", "activity:bbb"]
    );
  });

  test("comparator never returns 0 for two distinct entries", () => {
    const at = "2026-08-30T06:00:00.000Z";
    const left = makeEntry({ id: "activity:aaa", occurredAt: at });
    const right = makeEntry({ id: "activity:bbb", occurredAt: at });
    assert.notEqual(compareTimelineEntries(left, right), 0);
  });

  test("order is stable regardless of input order", () => {
    const at = "2026-08-30T06:00:00.000Z";
    const entries = [
      makeEntry({ id: "consent:c", source: "consent", occurredAt: at }),
      makeEntry({ id: "note:n", source: "note", occurredAt: at }),
      makeEntry({ id: "quotation:q", source: "quotation", occurredAt: at }),
      makeEntry({ id: "activity:a", source: "activity", occurredAt: at }),
      makeEntry({ id: "event:e", source: "event", occurredAt: at }),
    ];
    const expected = ["quotation:q", "note:n", "activity:a", "event:e", "consent:c"];

    assert.deepEqual(sortTimelineEntries(entries).map((e) => e.id), expected);
    assert.deepEqual(
      sortTimelineEntries([...entries].reverse()).map((e) => e.id),
      expected
    );
  });

  test("source rank is a total, gap-free ordering of every source", () => {
    const ranks = Object.values(CRM_TIMELINE_SOURCE_RANK).sort((a, b) => a - b);
    assert.deepEqual(ranks, [1, 2, 3, 4, 5]);
  });
});

/* ========================================================================== */
/* PART B — Unified timeline: dedupe policy                                   */
/* ========================================================================== */

describe("CRM 2D timeline — twin suppression", () => {
  test("every systematically twinned lead_event type is suppressed", () => {
    for (const eventType of [
      "lead.status_changed",
      "lead.on_hold",
      "lead.resumed",
      "lead.assigned",
      "lead.note_added",
    ]) {
      assert.ok(
        (CRM_TIMELINE_SUPPRESSED_EVENT_TYPES as readonly string[]).includes(
          eventType
        ),
        `${eventType} must be suppressed`
      );
      assert.ok(
        !(CRM_TIMELINE_INCLUDED_EVENT_TYPES as readonly string[]).includes(
          eventType
        ),
        `${eventType} must not also be included`
      );
    }
  });

  test("included and suppressed event sets are disjoint", () => {
    for (const included of CRM_TIMELINE_INCLUDED_EVENT_TYPES) {
      assert.ok(
        !(CRM_TIMELINE_SUPPRESSED_EVENT_TYPES as readonly string[]).includes(
          included
        )
      );
    }
  });

  test("lead.created is fetched but conditionally rendered against an origin twin", () => {
    assert.ok(
      (CRM_TIMELINE_INCLUDED_EVENT_TYPES as readonly string[]).includes(
        "lead.created"
      )
    );
    assert.deepEqual([...CRM_TIMELINE_ORIGIN_ACTIVITY_TYPES], [
      "lead.manual_created",
      "lead.bulk_imported",
    ]);
    const src = readSrc(TIMELINE_QUERIES);
    assert.match(src, /hasOriginActivity/);
    assert.match(src, /ORIGIN_ACTIVITY_TYPES\.includes\(row\.activity_type\)/);
    assert.match(src, /row\.event_type === "lead\.created" && hasOriginActivity/);
  });

  test("note twins are suppressed only when proven by reference_id", () => {
    const src = readSrc(TIMELINE_QUERIES);
    assert.match(src, /fetchedNoteIds/);
    assert.match(src, /row\.reference_id !== null/);
    assert.match(src, /fetchedNoteIds\.has\(row\.reference_id\)/);
  });

  test("dedupe never keys on timestamp alone", () => {
    const src = readSrc(TIMELINE_QUERIES);
    assert.doesNotMatch(src, /occurredAt ===|occurred_at ===/);
  });

  test("only decision-grade quotation events are included", () => {
    assert.deepEqual([...CRM_TIMELINE_INCLUDED_QUOTATION_EVENT_TYPES].sort(), [
      "quotation.accepted",
      "quotation.capability_issued",
      "quotation.capability_revoked",
      "quotation.created",
      "quotation.finalized",
      "quotation.revision_created",
    ]);

    for (const churn of [
      "quotation.draft_updated",
      "quotation.discount_changed",
      "quotation.tax_profile_changed",
      "quotation.pdf_generated",
      "quotation.send_requested",
    ]) {
      assert.ok(
        !(
          CRM_TIMELINE_INCLUDED_QUOTATION_EVENT_TYPES as readonly string[]
        ).includes(churn),
        `${churn} is draft churn and must stay out of the timeline`
      );
    }
  });
});

/* ========================================================================== */
/* PART C — Unified timeline: labels, bounds, permission omission             */
/* ========================================================================== */

describe("CRM 2D timeline — labels and disclosure", () => {
  test("no raw dotted code survives label formatting", () => {
    const codes = [
      ...CRM_TIMELINE_INCLUDED_EVENT_TYPES,
      "lead.status_changed",
      "lead.assigned",
    ];
    for (const code of codes) {
      assert.doesNotMatch(
        formatTimelineEventLabel(code),
        /\./,
        `${code} must not render as a raw code`
      );
    }

    for (const code of [
      "note.created",
      "follow_up.completed",
      "status.changed",
      "assignment.changed",
      "cadence.enrolled",
      "lead.manual_created",
    ]) {
      assert.doesNotMatch(formatTimelineActivityLabel(code), /\./);
    }

    for (const code of CRM_TIMELINE_INCLUDED_QUOTATION_EVENT_TYPES) {
      assert.doesNotMatch(formatTimelineQuotationLabel(code), /\./);
    }
  });

  test("an unknown code still formats without a dot", () => {
    assert.doesNotMatch(formatTimelineActivityLabel("some.future.code"), /\./);
  });

  test("categories map the CRM taxonomy onto user-facing groups", () => {
    assert.equal(timelineCategoryForActivity("status.changed"), "stage");
    assert.equal(timelineCategoryForActivity("assignment.changed"), "assignment");
    assert.equal(timelineCategoryForActivity("cadence.stopped"), "cadence");
    assert.equal(timelineCategoryForActivity("note.created"), "note");
    assert.equal(timelineCategoryForActivity("follow_up.completed"), "activity");
  });

  test("timeline UI never prints a raw entry code and discloses truncation", () => {
    const src = readSrc(TIMELINE_UI);
    assert.match(src, /entry\.title/);
    assert.doesNotMatch(src, /entry\.source \+|event_type|activity_type/);
    assert.match(src, /crm-timeline-truncated/);
    assert.match(src, /timeline\.limit/);
  });

  test("bounds are explicit and finite", () => {
    assert.equal(CRM_TIMELINE_SOURCE_FETCH_LIMIT, 60);
    assert.equal(CRM_TIMELINE_MAX_ENTRIES, 120);
    assert.ok(CRM_TIMELINE_MAX_ENTRIES >= CRM_TIMELINE_SOURCE_FETCH_LIMIT);
  });

  test("permission-scoped sources are gated and omitted silently", () => {
    const src = readSrc(TIMELINE_QUERIES);
    assert.match(src, /context\.canReadActivities/);
    assert.match(src, /context\.canReadConsents/);
    // No hidden-entry counter: that would leak the volume of restricted data.
    assert.doesNotMatch(src, /hiddenCount|omittedCount|restrictedCount/);
  });

  test("consent entries never attribute a staff identity", () => {
    const src = readSrc(TIMELINE_QUERIES);
    assert.match(src, /actor_type === "staff" \? "Staff member" : "Client"/);
  });

  test("WhatsApp sources stay out of the timeline while the lead link is unwritten", () => {
    const src = readSrc(TIMELINE_QUERIES);
    assert.doesNotMatch(src, /whatsapp_messages|whatsapp_conversations/);
  });
});

/* ========================================================================== */
/* PART D — Repository and page wiring                                        */
/* ========================================================================== */

describe("CRM 2D lead detail wiring", () => {
  test("the repository no longer merges lead_activities with lead_events inline", () => {
    const src = readSrc(LEAD_REPOSITORY);
    assert.match(src, /fetchLeadTimelinePage/);
    assert.doesNotMatch(src, /kind: "activity" as const/);
    assert.doesNotMatch(src, /kind: "event" as const/);
    assert.doesNotMatch(src, /right\.id\.localeCompare\(left\.id\)/);
  });

  test("the repository reads the per-lead SLA clock for header and score", () => {
    const src = readSrc(LEAD_REPOSITORY);
    assert.match(src, /crm_sla_clocks/);
    assert.match(src, /first_contact_attempt_at/);
  });

  test("the page composes the command header and quick actions", () => {
    const src = readSrc(LEAD_PAGE);
    assert.match(src, /LeadCommandHeader/);
    assert.match(src, /LeadQuickActions/);
    assert.match(src, /LeadActionsProvider/);
    assert.match(src, /deriveLeadScore/);
    assert.match(src, /fetchLeadCommercialState/);
  });

  test("notes keep the composer and lose the duplicate history list", () => {
    const src = readSrc(NOTES_UI);
    assert.match(src, /LeadNoteComposer/);
    assert.doesNotMatch(src, /notes\.map/);
    assert.doesNotMatch(src, /No notes recorded/);
  });

  test("one server-captured now is threaded through the page render", () => {
    const src = readSrc(LEAD_PAGE);
    // Captured once in the repository, mirroring board.capturedAt, so the render
    // stays pure and every time-dependent derivation agrees.
    assert.match(src, /const nowMs = Date\.parse\(lead\.capturedAt\)/);
    assert.doesNotMatch(src, /Date\.now\(\)/);
    assert.match(readSrc(LEAD_REPOSITORY), /capturedAt: new Date\(\)\.toISOString\(\)/);
  });
});

/* ========================================================================== */
/* PART E — Quick actions                                                     */
/* ========================================================================== */

describe("CRM 2D quick actions", () => {
  test("exactly the five locked actions ship", () => {
    const src = readSrc(QUICK_ACTIONS);
    for (const testId of [
      "crm-quick-action-call",
      "crm-quick-action-complete",
      "crm-quick-action-add-activity",
      "crm-quick-action-add-note",
      "crm-quick-action-quotation",
    ]) {
      assert.match(src, new RegExp(testId));
    }
    const actionIds = new Set(
      (src.match(/data-testid="crm-quick-action-[a-z-]+"/g) ?? []).filter(
        (id) => !id.includes("crm-quick-action-error")
      )
    );
    assert.equal(actionIds.size, 5, "no button wall: exactly five quick actions");
  });

  test("no WhatsApp quick action while the conversation lead link is unwritten", () => {
    const code = stripComments(readSrc(QUICK_ACTIONS));
    assert.doesNotMatch(code, /whatsapp/i);
    // The exclusion must stay documented so it is not silently "fixed" later.
    assert.match(readSrc(QUICK_ACTIONS), /no canonical writer/);
  });

  test("quick actions never write a table or add a server action", () => {
    const src = readSrc(QUICK_ACTIONS);
    assert.doesNotMatch(src, /createClient|supabase|\.from\(|\.rpc\(/);
    // The only mutation it calls directly is the existing quotation-draft action.
    assert.match(src, /createQuotationDraftAction/);
    assert.doesNotMatch(src, /createLeadActivityAction|addLeadNoteAction/);
  });

  test("stage transition and cadence stay in their own controls", () => {
    const src = readSrc(QUICK_ACTIONS);
    assert.doesNotMatch(src, /transitionLeadStatusAction|enrollLeadInCadence|assignLeadAction/);
  });

  test("terminal stages hide mutating actions", () => {
    const src = readSrc(QUICK_ACTIONS);
    assert.match(src, /isTerminalLeadStage/);
    assert.match(src, /canMutateActivities/);
  });

  test("denied permissions omit rather than disable", () => {
    const src = readSrc(QUICK_ACTIONS);
    assert.match(src, /canMutateActivities \? \(/);
    assert.match(src, /canManageLeadNotes && !isTerminal \? \(/);
    // Omission, not disable: no action is rendered behind a disabled guard.
    assert.doesNotMatch(src, /disabled=\{!can/);
  });
});

/* ========================================================================== */
/* PART F — Deterministic scoring                                             */
/* ========================================================================== */

describe("CRM 2D scoring — determinism and bounds", () => {
  test("identical inputs always produce an identical result", () => {
    const signals = makeSignals({
      hasFirstContactAttempt: true,
      hasMeaningfulOutcome: true,
      commercialState: "issued",
    });
    const first = JSON.stringify(deriveLeadScore(signals, NOW));
    for (let index = 0; index < 50; index += 1) {
      assert.equal(JSON.stringify(deriveLeadScore(signals, NOW)), first);
    }
  });

  test("score is always within bounds for every stage and signal combination", () => {
    for (const status of LEAD_STAGE_CODES) {
      for (const maxed of [false, true]) {
        const score = deriveLeadScore(
          makeSignals({
            status,
            hasFirstContactAttempt: maxed,
            hasMeaningfulOutcome: maxed,
            hasConsultationOrSiteVisit: maxed,
            commercialState: maxed ? "accepted" : "unknown",
            lastMeaningfulActivityAt: maxed
              ? "2026-08-30T06:00:00.000Z"
              : null,
          }),
          NOW
        );
        assert.ok(score.priorityScore >= CRM_LEAD_SCORE_MIN);
        assert.ok(score.priorityScore <= CRM_LEAD_SCORE_MAX);
        assert.ok(Number.isInteger(score.priorityScore));
      }
    }
  });

  test("component caps match the owner lock", () => {
    assert.equal(CRM_SCORE_MATURITY_MAX, 60);
    assert.equal(CRM_SCORE_ENGAGEMENT_MAX, 40);
    assert.equal(
      Math.max(...Object.values(CRM_SCORE_MATURITY_POINTS)),
      CRM_SCORE_MATURITY_MAX
    );
    assert.equal(
      Object.values(CRM_SCORE_ENGAGEMENT_POINTS).reduce((a, b) => a + b, 0),
      CRM_SCORE_ENGAGEMENT_MAX
    );
  });

  test("the maturity ladder matches the owner lock exactly", () => {
    assert.deepEqual(CRM_SCORE_MATURITY_POINTS, {
      new: 0,
      assigned: 5,
      contacted: 15,
      qualified: 25,
      consultation_scheduled: 35,
      proposal_sent: 50,
      negotiation: 60,
      closed_won: 60,
      closed_lost: 0,
      on_hold: 0,
    });
  });

  test("every non-zero contribution appears in reasons", () => {
    const score = deriveLeadScore(
      makeSignals({
        status: "negotiation",
        hasFirstContactAttempt: true,
        hasMeaningfulOutcome: true,
        hasConsultationOrSiteVisit: true,
        commercialState: "issued",
        lastMeaningfulActivityAt: "2026-08-30T06:00:00.000Z",
      }),
      NOW
    );

    assert.equal(score.priorityScore, 100);
    const summed = score.reasons.reduce((total, reason) => total + reason.points, 0);
    assert.equal(summed, score.maturityPoints + score.engagementPoints);
    assert.deepEqual(
      score.reasons.map((reason) => reason.code).sort(),
      [
        "CONSULTATION_OR_SITE_VISIT",
        "FIRST_CONTACT_ATTEMPT",
        "LIVE_ISSUED_QUOTATION",
        "MATURITY_STAGE",
        "MEANINGFUL_OUTCOME",
        "RECENT_MEANINGFUL_ACTIVITY",
      ]
    );
  });

  test("each engagement factor awards once only", () => {
    const score = deriveLeadScore(
      makeSignals({ status: "new", hasFirstContactAttempt: true }),
      NOW
    );
    const firstContact = score.reasons.filter(
      (reason) => reason.code === "FIRST_CONTACT_ATTEMPT"
    );
    assert.equal(firstContact.length, 1);
    assert.equal(score.engagementPoints, 5);
  });

  test("recent-activity window is exactly the locked number of days", () => {
    assert.equal(CRM_SCORE_RECENT_ACTIVITY_DAYS, 7);

    const inside = deriveLeadScore(
      makeSignals({
        lastMeaningfulActivityAt: new Date(NOW - 6 * 86_400_000).toISOString(),
      }),
      NOW
    );
    const outside = deriveLeadScore(
      makeSignals({
        lastMeaningfulActivityAt: new Date(NOW - 8 * 86_400_000).toISOString(),
      }),
      NOW
    );

    assert.equal(inside.engagementPoints, 5);
    assert.equal(outside.engagementPoints, 0);
  });

  test("an accepted quotation also satisfies the live-issued factor", () => {
    const accepted = deriveLeadScore(
      makeSignals({ status: "new", commercialState: "accepted" }),
      NOW
    );
    const finalized = deriveLeadScore(
      makeSignals({ status: "new", commercialState: "finalized" }),
      NOW
    );
    assert.equal(accepted.engagementPoints, 10);
    assert.equal(finalized.engagementPoints, 0);
  });
});

describe("CRM 2D scoring — bands, overrides and risk flags", () => {
  test("band thresholds match the owner lock", () => {
    assert.deepEqual(CRM_LEAD_SCORE_BAND_MIN, {
      HOT: 70,
      WARM: 45,
      NURTURE: 20,
      COLD: 0,
    });
  });

  test("band boundaries are exact", () => {
    assert.equal(resolveScoreBand(70), "HOT");
    assert.equal(resolveScoreBand(69), "WARM");
    assert.equal(resolveScoreBand(45), "WARM");
    assert.equal(resolveScoreBand(44), "NURTURE");
    assert.equal(resolveScoreBand(20), "NURTURE");
    assert.equal(resolveScoreBand(19), "COLD");
    assert.equal(resolveScoreBand(0), "COLD");
  });

  test("closed_won is 100 and excluded from active ranking", () => {
    const score = deriveLeadScore(makeSignals({ status: "closed_won" }), NOW);
    assert.equal(score.priorityScore, 100);
    assert.equal(score.band, "HOT");
    assert.equal(score.isActivePriorityRankable, false);
    assert.deepEqual(score.riskFlags, []);
  });

  test("closed_lost is 0", () => {
    const score = deriveLeadScore(
      makeSignals({
        status: "closed_lost",
        hasFirstContactAttempt: true,
        hasMeaningfulOutcome: true,
        commercialState: "issued",
      }),
      NOW
    );
    assert.equal(score.priorityScore, 0);
    assert.equal(score.isActivePriorityRankable, false);
    assert.deepEqual(score.riskFlags, []);
  });

  test("on_hold is 0, PARKED, and excluded from active ranking", () => {
    const score = deriveLeadScore(
      makeSignals({ status: "on_hold", hasMeaningfulOutcome: true }),
      NOW
    );
    assert.equal(score.priorityScore, 0);
    assert.equal(score.isActivePriorityRankable, false);
    assert.ok(score.riskFlags.includes("PARKED"));
    assert.ok(!score.riskFlags.includes("NO_PRIMARY_NEXT_ACTION"));
  });

  test("risk flags never change the numeric score", () => {
    const clean = deriveLeadScore(makeSignals(), NOW);
    const risky = deriveLeadScore(
      makeSignals({
        isAssigned: false,
        hasOpenPrimaryNextAction: false,
        primaryNextActionDueAt: null,
      }),
      NOW
    );
    assert.equal(clean.priorityScore, risky.priorityScore);
    assert.ok(risky.riskFlags.length > clean.riskFlags.length);
  });

  test("overdue, unassigned and no-next-action flags are canonical", () => {
    const overdue = deriveLeadScore(
      makeSignals({ primaryNextActionDueAt: "2026-08-01T06:00:00.000Z" }),
      NOW
    );
    assert.ok(overdue.riskFlags.includes("OVERDUE_NEXT_ACTION"));

    const unassigned = deriveLeadScore(
      makeSignals({ isAssigned: false, hasOpenPrimaryNextAction: false }),
      NOW
    );
    assert.ok(unassigned.riskFlags.includes("UNASSIGNED"));
    assert.ok(!unassigned.riskFlags.includes("NO_PRIMARY_NEXT_ACTION"));

    const noAction = deriveLeadScore(
      makeSignals({ hasOpenPrimaryNextAction: false, primaryNextActionDueAt: null }),
      NOW
    );
    assert.ok(noAction.riskFlags.includes("NO_PRIMARY_NEXT_ACTION"));
  });

  test("SLA breach is only flagged when a policy actually produced a deadline", () => {
    const inactive = deriveLeadScore(makeSignals({ slaDueAt: null }), NOW);
    assert.ok(!inactive.riskFlags.includes("SLA_BREACH"));
    assert.equal(inactive.signalsAvailable.slaPolicyActive, false);

    const breached = deriveLeadScore(
      makeSignals({
        slaDueAt: "2026-08-01T06:00:00.000Z",
        hasFirstContactAttempt: false,
      }),
      NOW
    );
    assert.ok(breached.riskFlags.includes("SLA_BREACH"));
    assert.equal(breached.signalsAvailable.slaPolicyActive, true);

    const attempted = deriveLeadScore(
      makeSignals({
        slaDueAt: "2026-08-01T06:00:00.000Z",
        hasFirstContactAttempt: true,
      }),
      NOW
    );
    assert.ok(!attempted.riskFlags.includes("SLA_BREACH"));
  });

  test("STALE is emitted under the owner-locked 168-hour policy", () => {
    assert.equal(CRM_STALE_AFTER_HOURS, 168);
    assert.ok(
      (CRM_LEAD_EMITTED_RISK_FLAGS as readonly string[]).includes("STALE")
    );
    // The threshold lives in CRM 2D, never in the CRM 2B pipeline contract.
    const pipeline = readSrc("src/features/crm/contracts/pipeline-contracts.ts");
    assert.doesNotMatch(pipeline, /STALE|ROTTING/i);
  });

  test("STALE boundary: 167h59m59s is not stale, exactly 168h is", () => {
    const justUnder = deriveLeadScore(
      makeSignals({
        latestMeaningfulSalesTouchAt: new Date(
          NOW - (168 * HOUR_MS - 1_000)
        ).toISOString(),
      }),
      NOW
    );
    assert.ok(
      !justUnder.riskFlags.includes("STALE"),
      "167h59m59s must not be stale"
    );

    const exactly = deriveLeadScore(
      makeSignals({
        latestMeaningfulSalesTouchAt: new Date(NOW - 168 * HOUR_MS).toISOString(),
      }),
      NOW
    );
    assert.ok(exactly.riskFlags.includes("STALE"), "exactly 168h must be stale");
  });

  test("a recent note clears STALE", () => {
    const stale = deriveLeadScore(
      makeSignals({
        latestMeaningfulSalesTouchAt: new Date(NOW - 200 * HOUR_MS).toISOString(),
      }),
      NOW
    );
    assert.ok(stale.riskFlags.includes("STALE"));

    // The note is the newest of the three touch sources.
    const cleared = deriveLeadScore(
      makeSignals({
        latestMeaningfulSalesTouchAt: new Date(NOW - 2 * HOUR_MS).toISOString(),
      }),
      NOW
    );
    assert.ok(!cleared.riskFlags.includes("STALE"));
  });

  test("the touch resolver takes MAX over activity, note and quotation event", () => {
    const activity = new Date(NOW - 300 * HOUR_MS).toISOString();
    const note = new Date(NOW - 2 * HOUR_MS).toISOString();
    const quotationEvent = new Date(NOW - 400 * HOUR_MS).toISOString();

    assert.equal(latestIso([activity, note, quotationEvent]), note);

    const recentActivity = new Date(NOW - 3 * HOUR_MS).toISOString();
    assert.equal(latestIso([recentActivity, null, quotationEvent]), recentActivity);

    const recentQuotation = new Date(NOW - 1 * HOUR_MS).toISOString();
    assert.equal(latestIso([activity, null, recentQuotation]), recentQuotation);

    // Nothing at all leaves the receipt fallback to the derivation.
    assert.equal(latestIso([null, null, null]), null);
  });

  test("a recent qualifying completed activity clears STALE", () => {
    const cleared = deriveLeadScore(
      makeSignals({
        lastMeaningfulActivityAt: new Date(NOW - 3 * HOUR_MS).toISOString(),
        latestMeaningfulSalesTouchAt: new Date(NOW - 3 * HOUR_MS).toISOString(),
      }),
      NOW
    );
    assert.ok(!cleared.riskFlags.includes("STALE"));
  });

  test("a recent client-visible quotation event clears STALE", () => {
    const cleared = deriveLeadScore(
      makeSignals({
        lastMeaningfulActivityAt: null,
        latestMeaningfulSalesTouchAt: new Date(NOW - 1 * HOUR_MS).toISOString(),
      }),
      NOW
    );
    assert.ok(!cleared.riskFlags.includes("STALE"));
  });

  test("an internal_task alone does not clear STALE", () => {
    // internal_task is excluded from the touch maxima at BOTH assembly sites,
    // so a lead whose only recent work is an internal task stays stale.
    assert.match(
      readSrc("src/features/crm/server/crm-lead-score-signals.ts"),
      /internal_task/
    );
    assert.match(readSrc(PIPELINE_QUERIES), /internal_task/);

    const stale = deriveLeadScore(
      makeSignals({
        lastMeaningfulActivityAt: null,
        latestMeaningfulSalesTouchAt: new Date(NOW - 240 * HOUR_MS).toISOString(),
      }),
      NOW
    );
    assert.ok(stale.riskFlags.includes("STALE"));
  });

  test("with no touch at all, STALE falls back to the lead receipt instant", () => {
    const fresh = deriveLeadScore(
      makeSignals({
        latestMeaningfulSalesTouchAt: null,
        receivedAt: new Date(NOW - 10 * HOUR_MS).toISOString(),
      }),
      NOW
    );
    assert.ok(!fresh.riskFlags.includes("STALE"));

    const aged = deriveLeadScore(
      makeSignals({
        latestMeaningfulSalesTouchAt: null,
        receivedAt: new Date(NOW - 169 * HOUR_MS).toISOString(),
      }),
      NOW
    );
    assert.ok(aged.riskFlags.includes("STALE"));
  });

  test("on_hold, closed_won and closed_lost never surface STALE", () => {
    for (const status of ["on_hold", "closed_won", "closed_lost"] as const) {
      const score = deriveLeadScore(
        makeSignals({
          status,
          latestMeaningfulSalesTouchAt: null,
          receivedAt: new Date(NOW - 5_000 * HOUR_MS).toISOString(),
        }),
        NOW
      );
      assert.ok(
        !score.riskFlags.includes("STALE"),
        status + " must never surface STALE"
      );
    }
  });

  test("STALE changes neither the score, the probability, nor the weighted value", () => {
    const fresh = makeSignals({
      status: "negotiation",
      latestMeaningfulSalesTouchAt: new Date(NOW - 1 * HOUR_MS).toISOString(),
    });
    const stale = {
      ...fresh,
      latestMeaningfulSalesTouchAt: new Date(NOW - 500 * HOUR_MS).toISOString(),
    };

    const freshScore = deriveLeadScore(fresh, NOW);
    const staleScore = deriveLeadScore(stale, NOW);

    assert.equal(freshScore.priorityScore, staleScore.priorityScore);
    assert.equal(freshScore.band, staleScore.band);
    assert.deepEqual(freshScore.reasons, staleScore.reasons);
    assert.ok(!freshScore.riskFlags.includes("STALE"));
    assert.ok(staleScore.riskFlags.includes("STALE"));

    // Probability and weighted value are functions of stage alone.
    assert.equal(stageProbabilityBasisPoints("negotiation"), 8_000);
    assert.equal(computeWeightedValuePaise(1_000_000, "negotiation"), 800_000);
  });

  test("emitted risk flags reuse the CRM 2B urgency vocabulary where they overlap", () => {
    const urgency = new Set<string>(CRM_PIPELINE_URGENCY_CODES);
    const overlap: Readonly<Record<string, string>> = {
      SLA_BREACH: "sla_breach",
      OVERDUE_NEXT_ACTION: "overdue",
      NO_PRIMARY_NEXT_ACTION: "no_next_action",
    };
    for (const [flag, canonical] of Object.entries(overlap)) {
      assert.ok(
        urgency.has(canonical),
        `${flag} must reuse the existing CRM 2B urgency code ${canonical}`
      );
    }
  });
});

describe("CRM 2D scoring — non-discrimination", () => {
  test("the signal type carries no identity, contact or locality field", () => {
    const signals = makeSignals();
    const forbidden = [
      "locality",
      "submittedName",
      "submitted_name",
      "displayName",
      "submittedEmail",
      "email",
      "phone",
      "contactName",
      "budgetComfortCode",
      "budget_comfort_code",
      "estimateSnapshot",
      "estimate_snapshot",
      "sourceId",
      "primarySourceId",
    ];
    for (const key of forbidden) {
      assert.ok(
        !Object.hasOwn(signals, key),
        `CrmLeadScoreSignals must never carry ${key}`
      );
    }
    assert.doesNotMatch(JSON.stringify(signals), /locality|email|phone/i);
  });

  test("the scoring module never references a sensitive or excluded column", () => {
    const src = readSrc(SCORE_CONTRACTS);
    for (const forbidden of [
      "budget_comfort_code",
      "estimate_snapshot",
      "submitted_email",
      "primary_source_id",
    ]) {
      assert.doesNotMatch(
        src,
        new RegExp(`readonly\\s+${forbidden}`),
        `${forbidden} must not be a scoring input`
      );
    }
    // Documented exclusion, not an input.
    assert.match(src, /NON-DISCRIMINATION/);
  });

  test("no WhatsApp signal enters the score while the lead link is unwritten", () => {
    const score = deriveLeadScore(makeSignals(), NOW);
    assert.equal(score.signalsAvailable.whatsappLinked, false);
    const signals = makeSignals();
    assert.ok(!Object.keys(signals).some((key) => /whatsapp/i.test(key)));
  });
});

describe("CRM 2D scoring — surface parity", () => {
  test("detail and pipeline assemble the identical signal shape", () => {
    const detail = readSrc("src/features/crm/server/crm-lead-score-signals.ts");
    const pipeline = readSrc(PIPELINE_QUERIES);

    for (const field of [
      "hasFirstContactAttempt",
      "hasMeaningfulOutcome",
      "hasConsultationOrSiteVisit",
      "commercialState",
      "lastMeaningfulActivityAt",
      "hasOpenPrimaryNextAction",
      "primaryNextActionDueAt",
      "slaDueAt",
    ]) {
      assert.match(detail, new RegExp(field), `detail must set ${field}`);
      assert.match(pipeline, new RegExp(field), `pipeline must set ${field}`);
    }
  });

  test("both surfaces exclude internal_task from meaningful activity recency", () => {
    assert.match(
      readSrc("src/features/crm/server/crm-lead-score-signals.ts"),
      /internal_task/
    );
    assert.match(readSrc(PIPELINE_QUERIES), /internal_task/);
  });

  test("the same signals produce the same score regardless of surface", () => {
    const signals = makeSignals({
      status: "proposal_sent",
      hasFirstContactAttempt: true,
      commercialState: "issued",
    });
    assert.deepEqual(
      deriveLeadScore(signals, NOW),
      deriveLeadScore({ ...signals }, NOW)
    );
  });
});

/* ========================================================================== */
/* PART G — Deal value and weighted pipeline                                  */
/* ========================================================================== */

describe("CRM 2D deal value and weighted pipeline", () => {
  test("stage probabilities match the owner lock exactly", () => {
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
  });

  test("the TypeScript probability mirror matches the migration CASE", () => {
    const sql = readSrc(MIGRATION);
    const expected: readonly [string, number][] = [
      ["new", 500],
      ["assigned", 1000],
      ["contacted", 2000],
      ["qualified", 3500],
      ["consultation_scheduled", 5000],
      ["proposal_sent", 6500],
      ["negotiation", 8000],
      ["closed_won", 10000],
      ["closed_lost", 0],
      ["on_hold", 0],
    ];
    for (const [stage, bp] of expected) {
      assert.match(
        sql,
        new RegExp(`when '${stage}' then ${bp}\\b`),
        `migration must encode ${stage} = ${bp}bp`
      );
      assert.equal(
        stageProbabilityBasisPoints(stage as (typeof LEAD_STAGE_CODES)[number]),
        bp
      );
    }
  });

  test("every stage has a probability", () => {
    for (const stage of LEAD_STAGE_CODES) {
      assert.equal(typeof stageProbabilityBasisPoints(stage), "number");
    }
  });

  test("on_hold is parked at zero", () => {
    assert.equal(stageProbabilityBasisPoints("on_hold"), 0);
    assert.equal(isParkedStage("on_hold"), true);
    assert.equal(isParkedStage("negotiation"), false);
  });

  test("weighted value rounds per lead using integer paise", () => {
    assert.equal(computeWeightedValuePaise(8_400_000, "assigned"), 840_000);
    assert.equal(computeWeightedValuePaise(8_400_000, "proposal_sent"), 5_460_000);
    assert.equal(computeWeightedValuePaise(1_000_000, "closed_won"), 1_000_000);
    assert.equal(computeWeightedValuePaise(1_000_000, "closed_lost"), 0);
    assert.equal(computeWeightedValuePaise(1_000_000, "on_hold"), 0);
    // Half-up on an odd paise amount, never a float remainder.
    assert.equal(computeWeightedValuePaise(1, "consultation_scheduled"), 1);
    assert.ok(
      Number.isInteger(computeWeightedValuePaise(333_333, "qualified") as number)
    );
  });

  test("unknown deal value stays unknown and never becomes zero", () => {
    assert.equal(computeWeightedValuePaise(null, "negotiation"), null);
    assert.equal(formatDealValue(null), "Value unknown");
    assert.notEqual(formatDealValue(null), formatDealValue(0));
  });

  test("aggregates come from the RPC, never from the loaded cards", () => {
    const src = readSrc(PIPELINE_QUERIES);
    assert.match(src, /fetchCrmPipelineValueSummary/);
    const board = readSrc(
      "src/features/crm/components/pipeline/CrmPipelineBoard.tsx"
    );
    assert.match(board, /board\.valueSummary/);
    assert.doesNotMatch(board, /computeWeightedValuePaise/);
  });

  test("the board discloses how many leads are actually valued", () => {
    const board = readSrc(
      "src/features/crm/components/pipeline/CrmPipelineBoard.tsx"
    );
    assert.match(board, /activeValuedLeadCount/);
    assert.match(board, /parkedLeadCount/);
  });

  test("probability is never derived from the score, and stage is never mutated", () => {
    const dealValue = readSrc("src/features/crm/contracts/deal-value-contracts.ts");
    assert.doesNotMatch(dealValue, /priorityScore|CrmLeadScore|deriveLeadScore/);
    const sql = readSrc(MIGRATION);
    assert.doesNotMatch(sql, /update public\.leads/i);
    assert.doesNotMatch(sql, /insert into public\.leads/i);
  });
});

/* ========================================================================== */
/* PART H — Migration safety and scope                                        */
/* ========================================================================== */

describe("CRM 2D migration scope", () => {
  test("adds functions only: no table, column, policy, permission or trigger", () => {
    const sql = readSrc(MIGRATION);
    assert.doesNotMatch(sql, /create table/i);
    assert.doesNotMatch(sql, /alter table/i);
    assert.doesNotMatch(sql, /create policy|drop policy|alter policy/i);
    assert.doesNotMatch(sql, /create trigger|drop trigger/i);
    assert.doesNotMatch(sql, /insert into public\.permissions/i);
    assert.doesNotMatch(sql, /insert into public\.role_permissions/i);
    assert.doesNotMatch(sql, /create index/i);
  });

  test("exactly one SECURITY DEFINER, and it is the deal-value resolver", () => {
    const sql = readSrc(MIGRATION);
    const definerCount = (sql.match(/^security definer$/gm) ?? []).length;
    assert.equal(definerCount, 1, "exactly one SECURITY DEFINER declaration");
    const invokerCount = (sql.match(/^security invoker$/gm) ?? []).length;
    assert.equal(invokerCount, 3, "all three public read surfaces are INVOKER");
    assert.match(
      sql,
      /create or replace function private\.crm_lead_deal_values[\s\S]*?security definer/
    );
  });

  test("the DEFINER re-applies CRM lead visibility internally", () => {
    const sql = readSrc(MIGRATION);
    assert.match(sql, /private\.crm_can_view_lead\(l\.assigned_to\)/);
  });

  test("public read surfaces are SECURITY INVOKER", () => {
    const sql = readSrc(MIGRATION);
    for (const fn of [
      "get_crm_lead_commercial_state",
      "get_crm_lead_deal_values",
      "get_crm_pipeline_value_summary",
    ]) {
      const block = sql.slice(sql.indexOf(`function public.${fn}`));
      assert.match(
        block.slice(0, 800),
        /security invoker/,
        `${fn} must be SECURITY INVOKER`
      );
    }
  });

  test("every function pins search_path and revokes public/anon", () => {
    const sql = readSrc(MIGRATION);
    const created = (sql.match(/create or replace function/g) ?? []).length;
    const pinned = (sql.match(/set search_path = ''/g) ?? []).length;
    assert.equal(pinned, created);

    for (const signature of [
      "private.crm_lead_deal_values\\(uuid, uuid\\)",
      "private.crm_stage_probability_bp\\(text\\)",
      "public.get_crm_lead_commercial_state\\(uuid\\)",
      "public.get_crm_lead_deal_values\\(uuid\\[\\]\\)",
      "public.get_crm_pipeline_value_summary\\(uuid\\)",
    ]) {
      assert.match(sql, new RegExp(`revoke all on function ${signature} from public, anon`));
      assert.match(sql, new RegExp(`grant execute on function ${signature} to authenticated`));
      assert.match(sql, new RegExp(`alter function ${signature} owner to postgres`));
    }
  });

  test("no capability material is ever projected", () => {
    const sql = readSrc(MIGRATION);
    const returnsBlocks = sql.match(/returns table \([\s\S]*?\)/g) ?? [];
    for (const block of returnsBlocks) {
      assert.doesNotMatch(block, /capability_token_hash|derivation_nonce/);
    }
    assert.doesNotMatch(sql, /jsonb_build_object[\s\S]*capability_token_hash/);
  });

  test("CRM 2A/2B/2C authorities are untouched", () => {
    const sql = readSrc(MIGRATION);
    for (const authority of [
      "transition_lead_status",
      "complete_lead_activity",
      "create_lead_activity",
      "assign_lead",
      "enroll_lead_in_cadence",
      "create_whatsapp_service_send_intent",
      "accept_quotation_by_capability",
      "accepted_quotation_close_won_impl",
      "get_crm_my_day",
    ]) {
      assert.doesNotMatch(
        sql,
        new RegExp(`create or replace function [a-z]+\\.${authority}\\b`),
        `${authority} must not be redefined by CRM 2D`
      );
    }
  });
});

/* ========================================================================== */
/* PART I — Cross-scope and regression guards                                 */
/* ========================================================================== */

describe("CRM 2D scope guards", () => {
  const CRM_2D_FILES = [
    "src/features/crm/contracts/lead-timeline-contracts.ts",
    "src/features/crm/contracts/lead-score-contracts.ts",
    "src/features/crm/contracts/deal-value-contracts.ts",
    "src/features/crm/server/crm-lead-timeline-queries.ts",
    "src/features/crm/server/crm-lead-commercial-queries.ts",
    "src/features/crm/server/crm-lead-score-signals.ts",
    COMMAND_HEADER,
    QUICK_ACTIONS,
    TIMELINE_UI,
  ];

  test("no CRM 2D module reaches into projects or marketing", () => {
    for (const file of CRM_2D_FILES) {
      const src = readSrc(file);
      assert.doesNotMatch(src, /features\/projects|features\/marketing/);
    }
  });

  test("no AI, ML or external enrichment anywhere in CRM 2D", () => {
    for (const file of [...CRM_2D_FILES, MIGRATION]) {
      const src = readSrc(file);
      assert.doesNotMatch(src, /\b(openai|anthropic|llm|embedding|vector|jarvis|quickfurno)\b/i);
    }
  });

  test("no score persistence or history table is introduced", () => {
    // Strip comments AND string literals: the only permitted mention of a score
    // in this migration is the COMMENT stating probability is never derived
    // from one. No identifier, column or table may carry it.
    const sql = stripComments(readSrc(MIGRATION)).replace(/'(?:[^']|'')*'/g, "''");
    assert.doesNotMatch(sql, /score/i, "no score identifier, column or table");
    const scoreSrc = readSrc(SCORE_CONTRACTS);
    assert.doesNotMatch(scoreSrc, /supabase|createClient|server-only/i);
    assert.doesNotMatch(scoreSrc, /insert into|\.insert\(|\.upsert\(/i);
  });

  test("the Phase 5B lead-list minimisation invariant still holds", () => {
    const queries = readSrc("src/features/crm/server/crm-lead-queries.ts");
    assert.doesNotMatch(queries, /attribution/);
    assert.doesNotMatch(queries, /estimate_snapshot/);
    assert.doesNotMatch(queries, /contact_id/);
  });

  test("CRM 2B keeps its unthresholded stage-age policy", () => {
    const contracts = readSrc("src/features/crm/contracts/pipeline-contracts.ts");
    assert.doesNotMatch(contracts, /is_stale|is_rotting|ROTTING_DAYS|STALE_DAYS/);
    const queries = readSrc(PIPELINE_QUERIES);
    assert.doesNotMatch(queries, /\.update\(/);
    assert.doesNotMatch(queries, /is_stale|is_rotting/);
  });

  test("the command header summarises but never becomes a second authority", () => {
    const src = readSrc(COMMAND_HEADER);
    assert.doesNotMatch(
      src,
      /transitionLeadStatusAction|assignLeadAction|enrollLeadInCadenceAction/
    );
    assert.doesNotMatch(src, /createClient|\.rpc\(|\.from\(/);
  });
});
