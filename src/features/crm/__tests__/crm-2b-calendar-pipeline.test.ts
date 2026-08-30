/**
 * CRM 2B — calendar + dedicated premium pipeline.
 *
 * Component/route behaviour is asserted from source text (repo convention, see
 * crm-activity-ui.test.ts); range math, urgency ordering and movement guards are
 * asserted against the real pure contracts.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  addCalendarDays,
  buildCalendarHref,
  calendarLocalDate,
  calendarLocalDayStartUtc,
  calendarLocalHour,
  calendarLocalTimeToUtc,
  calendarStartOfWeek,
  CRM_CALENDAR_TIMEZONE,
  CRM_CALENDAR_VIEWS,
  groupCalendarEventsByLocalDate,
  isCalendarLocalDate,
  parseCalendarAnchorDate,
  parseCalendarView,
  resolveCalendarRange,
  resolveCalendarRescheduleTarget,
  shiftCalendarAnchor,
  type CrmCalendarEvent,
} from "../contracts/calendar-contracts.ts";
import {
  CRM_PIPELINE_BOARD_STAGES,
  CRM_PIPELINE_STAGE_FETCH_LIMIT,
  comparePipelineCards,
  formatPipelineStageAgeLabel,
  getPipelineDropTargets,
  isPipelineBoardStage,
  pipelineStageAgeDays,
  resolvePipelineDropRejection,
  resolvePipelineUrgency,
  sortPipelineCards,
  type CrmPipelineCard,
} from "../contracts/pipeline-contracts.ts";
import { LEAD_STAGE_CODES } from "../contracts/lead-stages.ts";

const root = process.cwd();

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const CALENDAR_WORKSPACE = "src/features/crm/components/calendar/CrmCalendarWorkspace.tsx";
const CALENDAR_DIALOG = "src/features/crm/components/calendar/CalendarEventDialog.tsx";
const CALENDAR_CHIP = "src/features/crm/components/calendar/CalendarEventChip.tsx";
const CALENDAR_QUERIES = "src/features/crm/server/crm-calendar-queries.ts";
const CALENDAR_PAGE = "src/app/admin/crm/calendar/page.tsx";
const PIPELINE_BOARD = "src/features/crm/components/pipeline/CrmPipelineBoard.tsx";
const PIPELINE_CARD = "src/features/crm/components/pipeline/PipelineLeadCard.tsx";
const PIPELINE_MOVE_DIALOG =
  "src/features/crm/components/pipeline/PipelineMoveStageDialog.tsx";
const PIPELINE_QUERIES = "src/features/crm/server/crm-pipeline-queries.ts";
const PIPELINE_PAGE = "src/app/admin/crm/pipeline/page.tsx";
const LEADS_PAGE = "src/app/admin/crm/leads/page.tsx";
const CRM_NAV = "src/features/crm/components/shell/CrmNav.tsx";
const ACTIVITY_RPC_MIGRATION =
  "supabase/migrations/20260828140000_crm_activity_rpc_workflows.sql";

function makeEvent(overrides: Partial<CrmCalendarEvent> = {}): CrmCalendarEvent {
  return {
    activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    leadId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    leadDisplayLabel: "Rahul S",
    leadStatus: "contacted",
    ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ownerLabel: "Priya",
    activityType: "call",
    title: "Follow-up call",
    priority: "normal",
    dueAt: "2026-09-01T09:30:00.000Z",
    durationMinutes: 15,
    isPrimaryNextAction: true,
    ...overrides,
  };
}

function makeCard(overrides: Partial<CrmPipelineCard> = {}): CrmPipelineCard {
  return {
    leadId: "11111111-1111-4111-8111-111111111111",
    displayName: "Lead",
    status: "contacted",
    serviceCode: "modular-kitchens",
    locality: "Kharadi",
    sourceLabel: "Website",
    assigneeId: "22222222-2222-4222-8222-222222222222",
    assigneeLabel: "Priya",
    primaryNextActionTitle: "Follow-up call",
    primaryNextActionType: "call",
    primaryNextActionDueAt: "2026-09-10T06:00:00.000Z",
    slaBreached: false,
    newUncontacted: false,
    stageEnteredAt: "2026-09-01T06:00:00.000Z",
    stageEnteredSource: "event",
    createdAt: "2026-08-25T06:00:00.000Z",
    ...overrides,
  };
}

/* ========================================================================== */
/* PART B — calendar range math (Asia/Kolkata)                                */
/* ========================================================================== */

describe("CRM 2B calendar — Asia/Kolkata range math", () => {
  test("display timezone is Asia/Kolkata", () => {
    assert.equal(CRM_CALENDAR_TIMEZONE, "Asia/Kolkata");
  });

  test("local date is IST, not UTC, across the +05:30 boundary", () => {
    // 2026-09-01T19:00Z is 2026-09-02T00:30 IST.
    assert.equal(calendarLocalDate("2026-09-01T19:00:00.000Z"), "2026-09-02");
    // 2026-09-01T18:00Z is 2026-09-01T23:30 IST.
    assert.equal(calendarLocalDate("2026-09-01T18:00:00.000Z"), "2026-09-01");
  });

  test("local day start maps to 18:30Z the previous UTC day", () => {
    assert.equal(
      calendarLocalDayStartUtc("2026-09-02"),
      "2026-09-01T18:30:00.000Z"
    );
  });

  test("local wall clock converts to the right UTC instant", () => {
    assert.equal(
      calendarLocalTimeToUtc("2026-09-02", 15, 30),
      "2026-09-02T10:00:00.000Z"
    );
    assert.equal(calendarLocalHour("2026-09-02T10:00:00.000Z"), 15);
  });

  test("day range covers exactly one local day", () => {
    const range = resolveCalendarRange("day", "2026-09-02");
    assert.equal(range.days.length, 1);
    assert.deepEqual([...range.days], ["2026-09-02"]);
    assert.equal(range.startUtc, "2026-09-01T18:30:00.000Z");
    assert.equal(range.endUtc, "2026-09-02T18:30:00.000Z");
  });

  test("week range is seven Monday-start local days", () => {
    // 2026-09-02 is a Wednesday.
    const range = resolveCalendarRange("week", "2026-09-02");
    assert.equal(range.days.length, 7);
    assert.equal(range.periodStartDate, "2026-08-31");
    assert.equal(range.periodEndDate, "2026-09-06");
    assert.equal(calendarStartOfWeek("2026-09-02"), "2026-08-31");
    assert.equal(range.startUtc, calendarLocalDayStartUtc("2026-08-31"));
    assert.equal(
      range.endUtc,
      calendarLocalDayStartUtc(addCalendarDays("2026-09-06", 1))
    );
  });

  test("month range labels the month but fetches only the rendered grid", () => {
    const range = resolveCalendarRange("month", "2026-09-15");
    assert.equal(range.periodStartDate, "2026-09-01");
    assert.equal(range.periodEndDate, "2026-09-30");
    // Whole Monday-start weeks, nothing beyond what the grid renders.
    assert.equal(range.visibleStartDate, "2026-08-31");
    assert.equal(range.visibleEndDate, "2026-10-04");
    assert.equal(range.days.length % 7, 0);
    assert.equal(range.days[0], range.visibleStartDate);
    assert.equal(range.days[range.days.length - 1], range.visibleEndDate);
  });

  test("month range handles a February that starts on a Monday", () => {
    const range = resolveCalendarRange("month", "2027-02-10");
    assert.equal(range.periodStartDate, "2027-02-01");
    assert.equal(range.periodEndDate, "2027-02-28");
    assert.equal(range.visibleStartDate, "2027-02-01");
    assert.equal(range.days.length % 7, 0);
  });

  test("previous/next shift by the view period and roll years", () => {
    assert.equal(shiftCalendarAnchor("day", "2026-09-02", 1), "2026-09-03");
    assert.equal(shiftCalendarAnchor("week", "2026-09-02", -1), "2026-08-26");
    assert.equal(shiftCalendarAnchor("month", "2026-12-15", 1), "2027-01-01");
    assert.equal(shiftCalendarAnchor("month", "2026-01-15", -1), "2025-12-31");
  });

  test("view and date params are validated, never trusted", () => {
    assert.equal(parseCalendarView("month"), "month");
    assert.equal(parseCalendarView("agenda"), "week");
    assert.equal(parseCalendarView(undefined), "week");
    assert.equal(
      parseCalendarAnchorDate("2026-09-02", "2026-01-01T00:00:00.000Z"),
      "2026-09-02"
    );
    assert.equal(
      parseCalendarAnchorDate("2026-02-31", "2026-01-01T12:00:00.000Z"),
      "2026-01-01"
    );
    assert.equal(
      parseCalendarAnchorDate("not-a-date", "2026-01-01T12:00:00.000Z"),
      "2026-01-01"
    );
    assert.equal(isCalendarLocalDate("2026-02-31"), false);
    assert.equal(isCalendarLocalDate("2026-02-28"), true);
  });

  test("calendar hrefs round-trip view, date and owner scope", () => {
    const href = buildCalendarHref("day", "2026-09-02", "owner-1");
    assert.match(href, /^\/admin\/crm\/calendar\?/);
    assert.match(href, /view=day/);
    assert.match(href, /date=2026-09-02/);
    assert.match(href, /owner=owner-1/);
    assert.doesNotMatch(buildCalendarHref("week", "2026-09-02", null), /owner=/);
  });

  test("every supported view resolves a non-empty bounded range", () => {
    for (const view of CRM_CALENDAR_VIEWS) {
      const range = resolveCalendarRange(view, "2026-09-02");
      assert.ok(range.days.length > 0);
      assert.ok(Date.parse(range.startUtc) < Date.parse(range.endUtc));
    }
  });
});

describe("CRM 2B calendar — event grouping", () => {
  test("events bucket by IST day, not UTC day", () => {
    const grouped = groupCalendarEventsByLocalDate([
      makeEvent({ activityId: "a1", dueAt: "2026-09-01T19:00:00.000Z" }),
      makeEvent({ activityId: "a2", dueAt: "2026-09-01T05:00:00.000Z" }),
    ]);
    assert.deepEqual(Object.keys(grouped).sort(), ["2026-09-01", "2026-09-02"]);
    assert.equal(grouped["2026-09-02"]![0]!.activityId, "a1");
  });

  test("same-day events are ordered by due time then primary flag", () => {
    const grouped = groupCalendarEventsByLocalDate([
      makeEvent({ activityId: "late", dueAt: "2026-09-01T08:00:00.000Z" }),
      makeEvent({ activityId: "early", dueAt: "2026-09-01T04:00:00.000Z" }),
    ]);
    assert.deepEqual(
      grouped["2026-09-01"]!.map((event) => event.activityId),
      ["early", "late"]
    );
  });
});

/* ========================================================================== */
/* PART A — audited reschedule targets                                        */
/* ========================================================================== */

describe("CRM 2B calendar — reschedule targets", () => {
  const NOW = Date.parse("2026-09-01T00:00:00.000Z");

  test("a day drop preserves the existing IST time of day", () => {
    const result = resolveCalendarRescheduleTarget({
      currentDueAt: "2026-09-02T10:00:00.000Z", // 15:30 IST
      targetLocalDate: "2026-09-04",
      now: NOW,
    });
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.dueAt, "2026-09-04T10:00:00.000Z");
    assert.equal(calendarLocalHour(result.ok ? result.dueAt : ""), 15);
  });

  test("an hour-slot drop sets the IST hour on the target day", () => {
    const result = resolveCalendarRescheduleTarget({
      currentDueAt: "2026-09-02T10:00:00.000Z",
      targetLocalDate: "2026-09-03",
      targetHour: 9,
      now: NOW,
    });
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.dueAt, "2026-09-03T03:30:00.000Z");
  });

  test("a past slot is refused before the RPC is called", () => {
    const result = resolveCalendarRescheduleTarget({
      currentDueAt: "2026-09-02T10:00:00.000Z",
      targetLocalDate: "2026-08-20",
      now: NOW,
    });
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /future/i);
  });

  test("dropping onto the same slot is a no-op, not a mutation", () => {
    const result = resolveCalendarRescheduleTarget({
      currentDueAt: "2026-09-02T10:00:00.000Z",
      targetLocalDate: "2026-09-02",
      now: NOW,
    });
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /already scheduled/i);
  });

  test("invalid target dates and hours are refused", () => {
    assert.equal(
      resolveCalendarRescheduleTarget({
        currentDueAt: "2026-09-02T10:00:00.000Z",
        targetLocalDate: "2026-02-31",
        now: NOW,
      }).ok,
      false
    );
    assert.equal(
      resolveCalendarRescheduleTarget({
        currentDueAt: "2026-09-02T10:00:00.000Z",
        targetLocalDate: "2026-09-04",
        targetHour: 27,
        now: NOW,
      }).ok,
      false
    );
  });

  test("reschedule stays on the audited RPC and appends a lifecycle event", () => {
    const migration = readSrc(ACTIVITY_RPC_MIGRATION);
    assert.match(migration, /reschedule_lead_activity_impl/);
    assert.match(migration, /ACTIVITY_NOT_OPEN/);
    assert.match(migration, /ACTIVITY_DUE_MUST_BE_FUTURE/);
    assert.match(migration, /ACTIVITY_OWNER_NOT_AUTHORIZED/);
    assert.match(migration, /crm\.follow_ups\.manage/);
    assert.match(migration, /insert into public\.lead_follow_up_events/);
    assert.match(migration, /'rescheduled'/);
    assert.match(migration, /previous_values/);
  });

  test("the workspace mutates only through the audited server action", () => {
    const src = readSrc(CALENDAR_WORKSPACE);
    assert.match(src, /rescheduleLeadActivityAction/);
    // No client-side table writes, no service-role client.
    assert.doesNotMatch(src, /createClient|service_role|SERVICE_ROLE/);
    assert.doesNotMatch(src, /\.from\("lead_follow_ups"\)/);
  });

  test("a rejected reschedule reverts the optimistic move and surfaces the reason", () => {
    const src = readSrc(CALENDAR_WORKSPACE);
    assert.match(src, /if \(!result\.success\)/);
    assert.match(src, /delete next\[activityId\]/);
    assert.match(src, /setErrorMessage\(result\.message/);
    assert.match(src, /role="alert"/);
  });

  test("completed and cancelled activities never reach the calendar", () => {
    const src = readSrc(CALENDAR_QUERIES);
    assert.match(src, /\.eq\("status", "open"\)/);
  });
});

/* ========================================================================== */
/* PART B — calendar read model + UI                                          */
/* ========================================================================== */

describe("CRM 2B calendar — bounded, permission-aware read model", () => {
  test("route and loading state exist", () => {
    assert.equal(existsSync(join(root, CALENDAR_PAGE)), true);
    assert.equal(
      existsSync(join(root, "src/app/admin/crm/calendar/loading.tsx")),
      true
    );
  });

  test("page requires CRM read access and gates rescheduling on follow-up manage", () => {
    const src = readSrc(CALENDAR_PAGE);
    assert.match(src, /requireCrmReadAccess\("\/admin\/crm\/calendar"\)/);
    assert.match(src, /canReschedule=\{context\.canManageLeadFollowUps\}/);
    assert.match(src, /canFilterOwner=\{context\.canReadBroad\}/);
  });

  test("reads are bounded to the visible range and never fetch everything", () => {
    const src = readSrc(CALENDAR_QUERIES);
    assert.match(src, /\.gte\("due_at", range\.startUtc\)/);
    assert.match(src, /\.lt\("due_at", range\.endUtc\)/);
    assert.match(src, /CRM_CALENDAR_EVENT_LIMIT/);
    assert.match(src, /\.limit\(/);
  });

  test("assignment-scoped roles cannot widen past their own activities", () => {
    const src = readSrc(CALENDAR_QUERIES);
    assert.match(
      src,
      /context\.canReadBroad\s*\?\s*options\.ownerId \?\? null\s*:\s*context\.userId/
    );
  });

  test("owner labels come from one directory lookup, not per-event queries", () => {
    const src = readSrc(CALENDAR_QUERIES);
    assert.match(src, /fetchCrmAssigneeDirectory/);
    assert.match(src, /leads!lead_follow_ups_lead_id_fkey/);
    // Exactly one activity read plus one directory read.
    assert.equal(src.match(/\.from\(/g)?.length, 1);
  });

  test("day, week and month surfaces are all rendered", () => {
    const src = readSrc(CALENDAR_WORKSPACE);
    assert.match(src, /crm-calendar-day/);
    assert.match(src, /crm-calendar-week/);
    assert.match(src, /crm-calendar-month/);
    assert.match(src, /crm-calendar-today/);
    assert.match(src, /crm-calendar-prev/);
    assert.match(src, /crm-calendar-next/);
    assert.match(src, /crm-calendar-range-title/);
    assert.match(src, /Asia\/Kolkata/);
  });

  test("keyboard and touch users get a non-drag reschedule path", () => {
    const dialog = readSrc(CALENDAR_DIALOG);
    assert.match(dialog, /crm-calendar-reschedule-open/);
    assert.match(dialog, /crm-calendar-reschedule-submit/);
    assert.match(dialog, /CrmDateTimeField/);
    assert.match(dialog, /crm-calendar-open-lead/);

    const chip = readSrc(CALENDAR_CHIP);
    // The chip is a real button first and a drag source second.
    assert.match(chip, /type="button"/);
    assert.match(chip, /onClick=\{\(\) => onOpen\(event\)\}/);
    assert.match(chip, /aria-label=/);
  });

  test("month cells drill into day view and bound their previews", () => {
    const src = readSrc(CALENDAR_WORKSPACE);
    assert.match(src, /MONTH_CELL_PREVIEW/);
    assert.match(src, /buildCalendarHref\("day"/);
    assert.match(src, /\+\{overflow\} more/);
  });

  test("no Google, Outlook or third-party calendar dependency is introduced", () => {
    for (const file of [CALENDAR_WORKSPACE, CALENDAR_CHIP, CALENDAR_DIALOG, CALENDAR_QUERIES, CALENDAR_PAGE]) {
      const src = readSrc(file);
      assert.doesNotMatch(src, /google|outlook|microsoftgraph|fullcalendar|react-big-calendar/i);
    }
    const pkg = JSON.parse(readSrc("package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    assert.equal(
      names.some((name) =>
        /calendar|dnd|drag|googleapis|@microsoft/i.test(name)
      ),
      false
    );
  });
});

/* ========================================================================== */
/* PART C — dedicated premium pipeline                                        */
/* ========================================================================== */

describe("CRM 2B pipeline — canonical stage model", () => {
  test("route and loading state exist", () => {
    assert.equal(existsSync(join(root, PIPELINE_PAGE)), true);
    assert.equal(
      existsSync(join(root, "src/app/admin/crm/pipeline/loading.tsx")),
      true
    );
  });

  test("board stages are a subset of the canonical stage taxonomy", () => {
    for (const stage of CRM_PIPELINE_BOARD_STAGES) {
      assert.equal(
        (LEAD_STAGE_CODES as readonly string[]).includes(stage),
        true,
        `${stage} is not a canonical lead stage`
      );
    }
    assert.equal(isPipelineBoardStage("contacted"), true);
    assert.equal(isPipelineBoardStage("nurturing"), false);
  });

  test("terminal stages are not board columns", () => {
    assert.equal(
      (CRM_PIPELINE_BOARD_STAGES as readonly string[]).includes("closed_won"),
      false
    );
    assert.equal(
      (CRM_PIPELINE_BOARD_STAGES as readonly string[]).includes("closed_lost"),
      false
    );
  });

  test("no second stage taxonomy is declared anywhere in the pipeline slice", () => {
    for (const file of [PIPELINE_BOARD, PIPELINE_CARD, PIPELINE_QUERIES, PIPELINE_PAGE]) {
      const src = readSrc(file);
      assert.doesNotMatch(src, /"(prospect|nurturing|won|lost|discovery)"/i);
    }
  });
});

describe("CRM 2B pipeline — deterministic urgency ordering", () => {
  test("urgency ladder follows the approved priority order", () => {
    const now = Date.parse("2026-09-10T00:00:00.000Z");
    assert.equal(
      resolvePipelineUrgency(makeCard({ slaBreached: true }), now),
      "sla_breach"
    );
    assert.equal(
      resolvePipelineUrgency(
        makeCard({ primaryNextActionDueAt: null, primaryNextActionTitle: null }),
        now
      ),
      "no_next_action"
    );
    assert.equal(
      resolvePipelineUrgency(
        makeCard({ primaryNextActionDueAt: "2026-09-01T00:00:00.000Z" }),
        now
      ),
      "overdue"
    );
    assert.equal(
      resolvePipelineUrgency(
        makeCard({
          newUncontacted: true,
          primaryNextActionDueAt: "2026-09-20T00:00:00.000Z",
        }),
        now
      ),
      "new_uncontacted"
    );
    assert.equal(
      resolvePipelineUrgency(
        makeCard({ primaryNextActionDueAt: "2026-09-10T06:00:00.000Z" }),
        now
      ),
      "due_today"
    );
    assert.equal(
      resolvePipelineUrgency(
        makeCard({ primaryNextActionDueAt: "2026-09-20T06:00:00.000Z" }),
        now
      ),
      "upcoming"
    );
  });

  test("no-primary and overdue sort above due-today and upcoming", () => {
    const now = Date.parse("2026-09-10T00:00:00.000Z");
    const ordered = sortPipelineCards(
      [
        makeCard({
          leadId: "d-upcoming",
          primaryNextActionDueAt: "2026-09-25T06:00:00.000Z",
        }),
        makeCard({
          leadId: "c-today",
          primaryNextActionDueAt: "2026-09-10T09:00:00.000Z",
        }),
        makeCard({
          leadId: "b-overdue",
          primaryNextActionDueAt: "2026-09-02T06:00:00.000Z",
        }),
        makeCard({ leadId: "a-none", primaryNextActionDueAt: null }),
        makeCard({ leadId: "z-sla", slaBreached: true }),
      ],
      now
    );
    assert.deepEqual(
      ordered.map((card) => card.leadId),
      ["z-sla", "a-none", "b-overdue", "c-today", "d-upcoming"]
    );
  });

  test("ordering is never plain created_at", () => {
    const now = Date.parse("2026-09-10T00:00:00.000Z");
    const older = makeCard({
      leadId: "older",
      createdAt: "2026-01-01T00:00:00.000Z",
      primaryNextActionDueAt: "2026-09-25T06:00:00.000Z",
    });
    const newer = makeCard({
      leadId: "newer",
      createdAt: "2026-09-09T00:00:00.000Z",
      primaryNextActionDueAt: null,
    });
    assert.deepEqual(
      sortPipelineCards([older, newer], now).map((card) => card.leadId),
      ["newer", "older"]
    );
  });

  test("ties break deterministically and the comparator is a total order", () => {
    const now = Date.parse("2026-09-10T00:00:00.000Z");
    const left = makeCard({ leadId: "aaa" });
    const right = makeCard({ leadId: "bbb" });
    assert.equal(comparePipelineCards(left, right, now) < 0, true);
    assert.equal(comparePipelineCards(right, left, now) > 0, true);
    assert.equal(comparePipelineCards(left, left, now), 0);
    // Same rank + same due time falls through to created_at, then id.
    const olderSameDue = makeCard({
      leadId: "zzz",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(comparePipelineCards(olderSameDue, left, now) < 0, true);
  });

  test("an inactive SLA policy never fabricates a breach signal", () => {
    const now = Date.parse("2026-09-10T00:00:00.000Z");
    // With no policy the clock carries no due date, so slaBreached stays false.
    const card = makeCard({ slaBreached: false, newUncontacted: true });
    assert.notEqual(resolvePipelineUrgency(card, now), "sla_breach");

    const src = readSrc(PIPELINE_QUERIES);
    // Breach requires a real deadline the policy actually produced.
    assert.match(src, /sla\?\.slaDueAt != null/);
    assert.match(src, /sla\.firstContactAttemptAt == null/);
    assert.match(src, /hasActiveSlaDue/);
    assert.match(src, /slaSignalAvailable: slaClocks\.hasActiveSlaDue/);

    const board = readSrc(PIPELINE_BOARD);
    assert.match(board, /No SLA policy is active/);
  });

  test("stage age is reported from canonical stage-entry events", () => {
    const now = Date.parse("2026-09-10T00:00:00.000Z");
    assert.equal(
      pipelineStageAgeDays(
        makeCard({ stageEnteredAt: "2026-09-07T00:00:00.000Z" }),
        now
      ),
      3
    );
    assert.equal(formatPipelineStageAgeLabel(3), "3d in stage");
    assert.equal(formatPipelineStageAgeLabel(0), "Today in stage");

    const src = readSrc(PIPELINE_QUERIES);
    assert.match(src, /lead_events/);
    assert.match(src, /CRM_PIPELINE_STAGE_ENTRY_EVENT_TYPES/);
  });
});

describe("CRM 2B pipeline — movement uses the canonical transition authority", () => {
  test("drop targets are forward transitions only", () => {
    assert.deepEqual([...getPipelineDropTargets("assigned")], ["contacted"]);
    assert.deepEqual([...getPipelineDropTargets("qualified")], [
      "consultation_scheduled",
    ]);
    assert.deepEqual([...getPipelineDropTargets("on_hold")], []);
    assert.deepEqual([...getPipelineDropTargets("closed_won")], []);
    assert.deepEqual([...getPipelineDropTargets("closed_lost")], []);
  });

  test("Closed Won can never be produced by a drop target", () => {
    for (const stage of LEAD_STAGE_CODES) {
      assert.equal(
        getPipelineDropTargets(stage).includes("closed_won"),
        false,
        `${stage} must not offer closed_won`
      );
      const rejection = resolvePipelineDropRejection(stage, "closed_won");
      assert.notEqual(rejection, null, `${stage} -> closed_won must be refused`);
      if (stage !== "closed_won") {
        assert.match(rejection ?? "", /accepted quotation/i);
      }
    }
  });

  test("assignment-owned stages are not drop targets", () => {
    assert.match(
      resolvePipelineDropRejection("contacted", "new") ?? "",
      /lead assignment/i
    );
    assert.match(
      resolvePipelineDropRejection("contacted", "assigned") ?? "",
      /lead assignment/i
    );
  });

  test("reason-bearing stages are routed to the dialog, never to a bare drop", () => {
    assert.match(
      resolvePipelineDropRejection("contacted", "on_hold") ?? "",
      /reason.*Move stage/i
    );
    assert.match(
      resolvePipelineDropRejection("contacted", "closed_lost") ?? "",
      /reason.*Move stage/i
    );
  });

  test("stage-skipping and terminal moves are refused with a clear reason", () => {
    assert.match(
      resolvePipelineDropRejection("assigned", "negotiation") ?? "",
      /cannot move straight to/i
    );
    assert.match(
      resolvePipelineDropRejection("closed_lost", "contacted") ?? "",
      /Closed leads cannot be moved/i
    );
    assert.match(
      resolvePipelineDropRejection("contacted", "contacted") ?? "",
      /already in this stage/i
    );
    assert.equal(resolvePipelineDropRejection("assigned", "contacted"), null);
  });

  test("the board calls transition_lead_status and never writes leads directly", () => {
    const src = readSrc(PIPELINE_BOARD);
    assert.match(src, /transitionLeadStatusAction/);
    assert.doesNotMatch(src, /createClient|service_role|SERVICE_ROLE/);
    assert.doesNotMatch(src, /\.from\("leads"\)/);
    assert.doesNotMatch(src, /update\(/);
  });

  test("a rejected transition rolls the card back to its server stage", () => {
    const src = readSrc(PIPELINE_BOARD);
    assert.match(src, /if \(!result\.success\)/);
    assert.match(src, /delete next\[card\.leadId\]/);
    assert.match(src, /setErrorMessage\(result\.message/);
    assert.match(src, /crm-pipeline-error/);
  });

  test("a client-side refusal short-circuits before any server call", () => {
    const src = readSrc(PIPELINE_BOARD);
    assert.match(src, /resolvePipelineDropRejection/);
    assert.match(src, /if \(rejection\) \{/);
  });

  test("keyboard and touch users get a non-drag move-stage path", () => {
    const card = readSrc(PIPELINE_CARD);
    assert.match(card, /crm-pipeline-move-stage/);
    assert.match(card, /type="button"/);

    const dialog = readSrc(PIPELINE_MOVE_DIALOG);
    assert.match(dialog, /crm-pipeline-move-to-/);
    assert.match(dialog, /crm-pipeline-on-hold/);
    assert.match(dialog, /crm-pipeline-closed-lost/);
    // On-hold / closed-lost reuse the canonical CRM 2A dialogs and their reasons.
    assert.match(dialog, /LeadOnHoldDialog/);
    assert.match(dialog, /LeadClosedLostDialog/);
    assert.match(dialog, /Closed Won is set only when a quotation is accepted/);
  });
});

describe("CRM 2B pipeline — bounded reads and premium card content", () => {
  test("stage totals are exact counts, not page lengths", () => {
    const src = readSrc(PIPELINE_QUERIES);
    assert.match(src, /count: "exact"/);
    assert.match(src, /CRM_PIPELINE_STAGE_FETCH_LIMIT/);
    assert.equal(CRM_PIPELINE_STAGE_FETCH_LIMIT <= 50, true);
  });

  test("enrichment is batched by lead id — no per-card queries", () => {
    const src = readSrc(PIPELINE_QUERIES);
    assert.match(src, /\.in\("lead_id", \[\.\.\.leadIds\]\)/);
    assert.match(src, /Promise\.all/);
  });

  test("cards carry the sales-useful minimum", () => {
    const src = readSrc(PIPELINE_CARD);
    assert.match(src, /card\.displayName/);
    assert.match(src, /card\.serviceCode/);
    assert.match(src, /card\.locality/);
    assert.match(src, /card\.assigneeLabel/);
    assert.match(src, /card\.primaryNextActionTitle/);
    assert.match(src, /card\.primaryNextActionDueAt/);
    assert.match(src, /formatPipelineStageAgeLabel/);
    assert.match(src, /admin\/crm\/leads\/\$\{card\.leadId\}/);
  });

  test("urgency is never communicated by colour alone", () => {
    const src = readSrc(PIPELINE_CARD);
    assert.match(src, /CRM_PIPELINE_URGENCY_LABELS\[urgency\]/);
  });
});

/* ========================================================================== */
/* PART C/D — Leads cutover, nav, and stale visibility                        */
/* ========================================================================== */

describe("CRM 2B cutover and navigation", () => {
  test("Leads keeps no divergent pipeline implementation", () => {
    const src = readSrc(LEADS_PAGE);
    assert.match(src, /crm-leads-pipeline-link/);
    assert.match(src, /\/admin\/crm\/pipeline/);
    assert.doesNotMatch(src, /LeadPipelineBoard/);
    assert.doesNotMatch(src, /view=pipeline/);
    assert.equal(
      existsSync(
        join(root, "src/features/crm/components/leads/LeadPipelineBoard.tsx")
      ),
      false
    );
  });

  test("CRM nav exposes My Day, Leads, Pipeline, Calendar and Overview", () => {
    const src = readSrc(CRM_NAV);
    assert.match(src, /"\/admin\/crm\/my-day", label: "My Day"/);
    assert.match(src, /"\/admin\/crm\/leads", label: "Leads"/);
    assert.match(src, /"\/admin\/crm\/pipeline", label: "Pipeline"/);
    assert.match(src, /"\/admin\/crm\/calendar", label: "Calendar"/);
    assert.match(src, /"\/admin\/crm", label: "Overview"/);
    // Permission-gated secondary links are preserved.
    assert.match(src, /showImports/);
    assert.match(src, /showAssignmentRules/);
    assert.match(src, /showTargets/);
    assert.match(src, /showReports/);
  });

  test("attention states are canonical; no mutable stale/rotting columns are added", () => {
    const contracts = readSrc("src/features/crm/contracts/pipeline-contracts.ts");
    assert.match(contracts, /no_next_action/);
    assert.match(contracts, /overdue/);
    assert.match(contracts, /due_today/);
    assert.match(contracts, /new_uncontacted/);
    assert.match(contracts, /sla_breach/);
    // No lead column writes and no invented threshold.
    assert.doesNotMatch(contracts, /is_stale|is_rotting|ROTTING_DAYS|STALE_DAYS/);
    const queries = readSrc(PIPELINE_QUERIES);
    assert.doesNotMatch(queries, /\.update\(/);
    assert.doesNotMatch(queries, /is_stale|is_rotting/);
  });

  test("CRM 2B adds no migration and does not touch SLA activation", () => {
    const migrationsAdded = [
      "supabase/migrations/20260830140000_crm_calendar_pipeline.sql",
    ].filter((path) => existsSync(join(root, path)));
    assert.deepEqual(migrationsAdded, []);
    for (const file of [PIPELINE_QUERIES, CALENDAR_QUERIES]) {
      const src = readSrc(file);
      assert.doesNotMatch(src, /crm_sla_policies|update_crm_sla_policy|is_active/);
    }
  });
});
