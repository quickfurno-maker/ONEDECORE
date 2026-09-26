import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  moveScheduledInstantToDate,
  parseWhatsappSchedulerMonth,
  parseWhatsappSchedulerView,
  schedulerDateKey,
  schedulerMonthCells,
  schedulerWeekDates,
  whatsappSchedulerEvents,
} from "../contracts/campaign-scheduler.ts";
import type { WhatsappCampaignVersionSummary } from "../contracts/campaign-execution.ts";

const ROOT = process.cwd();
const read = (path: string) =>
  readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");

function version(
  status = "scheduled",
  scheduledFor = "2026-10-05T05:30:00.000Z"
): WhatsappCampaignVersionSummary {
  return {
    versionId: "11111111-1111-4111-8111-111111111111",
    campaignId: "22222222-2222-4222-8222-222222222222",
    campaignName: "September Hot Leads",
    campaignReference: "OD-CAMPAIGN-001",
    versionNumber: 1,
    title: "September Hot Leads",
    status: "approved",
    updatedAt: "2026-09-26T10:00:00.000Z",
    specState: "frozen",
    templateName: "festive_consultation",
    segmentName: null,
    latestRun: {
      id: "33333333-3333-4333-8333-333333333333",
      status,
      scheduledFor,
      autoStart: true,
      requestedByMe: true,
      startedAt: null,
      completedAt: null,
      failureCode: null,
      totalCount: 0,
      eligibleCount: 0,
      excludedCount: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      reconcileCount: 0,
      createdAt: "2026-09-26T10:00:00.000Z",
    },
  };
}
describe("WhatsApp premium campaign scheduler calendar", () => {
  test("calendar parsing is bounded and month grid is Monday-first", () => {
    assert.equal(parseWhatsappSchedulerView("week"), "week");
    assert.equal(parseWhatsappSchedulerView("unknown"), "month");
    assert.equal(parseWhatsappSchedulerMonth("2026-10", "2026-09-26"), "2026-10");
    assert.equal(parseWhatsappSchedulerMonth("2026-99", "2026-09-26"), "2026-09");

    const cells = schedulerMonthCells("2026-10");
    assert.equal(cells.length, 42);
    assert.equal(cells[0], "2026-09-28");
    assert.equal(cells[41], "2026-11-08");

    const week = schedulerWeekDates("2026-10-01");
    assert.deepEqual(week, [
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });

  test("dragging a run changes the IST date but preserves its IST clock time", () => {
    const original = "2026-10-05T05:30:00.000Z"; // 11:00 IST
    const moved = moveScheduledInstantToDate(original, "2026-10-12");
    assert.equal(moved, "2026-10-12T05:30:00.000Z");
    assert.equal(schedulerDateKey(moved!), "2026-10-12");
  });

  test("only still-scheduled runs are movable", () => {
    const scheduled = whatsappSchedulerEvents([version("scheduled")]);
    const completed = whatsappSchedulerEvents([version("completed")]);
    assert.equal(scheduled[0]?.canReschedule, true);
    assert.equal(completed[0]?.canReschedule, false);
    assert.equal(scheduled[0]?.campaignName, "September Hot Leads");
  });
});
describe("Scheduler is one governed WhatsApp surface, not a second sender", () => {
  test("navigation, CRM, nurture and Template Studio all hand off to Scheduler", () => {
    const control = read("src/features/whatsapp/contracts/control-plane.ts");
    const crm = read("src/app/admin/crm/leads/page.tsx");
    const nurture = read("src/app/admin/crm/nurture/page.tsx");
    const templates = read("src/app/admin/whatsapp/templates/page.tsx");
    const scheduler = read("src/app/admin/whatsapp/scheduler/page.tsx");

    assert.match(control, /key: "scheduler".*label: "Scheduler"/);
    assert.match(crm, /crm-leads-whatsapp-scheduler-link/);
    assert.match(nurture, /Schedule WhatsApp nurture/);
    assert.match(templates, /Schedule campaign/);
    assert.match(templates, /status === "APPROVED"[\s\S]*category === "MARKETING"/);
    assert.match(scheduler, /Month|month/);
    assert.match(scheduler, /CampaignSchedulerCalendar/);
    assert.match(scheduler, /Rule fixed · members live/);
    assert.match(scheduler, /listWhatsappSchedulerEventsForCurrentUser/);
  });

  test("scheduler uses the existing campaign run worker and does not dispatch providers itself", () => {
    const schedulerPage = read("src/app/admin/whatsapp/scheduler/page.tsx");
    const calendar = read(
      "src/features/whatsapp/components/campaigns/CampaignSchedulerCalendar.tsx"
    );
    assert.doesNotMatch(schedulerPage, /dispatchTemplateMessage|createAdminClient/);
    assert.doesNotMatch(calendar, /dispatchTemplateMessage|createAdminClient/);
    assert.match(schedulerPage, /CampaignCreateRunForm/);
    assert.match(calendar, /SCHEDULER_FILTERS/);
    assert.match(calendar, /od-scheduler__drawer/);
  });
});
describe("Live CRM truth is evaluated at due-time, then recipients are frozen for the run", () => {
  test("due materialisation reads the frozen rule but resolves its members live", () => {
    const execution = read(
      "supabase/migrations/20260915100000_whatsapp_campaign_execution.sql"
    );
    assert.match(
      execution,
      /scheduled_for<=clock_timestamp\(\)[\s\S]*whatsapp_campaign_materialize/
    );
    assert.match(
      execution,
      /whatsapp_campaign_materialize[\s\S]*campaign_audience_rule_versions[\s\S]*whatsapp_campaign_audience_contact_ids/
    );
    assert.match(execution, /insert into public\.whatsapp_campaign_recipients/);
    assert.match(execution, /audience_materialized/);
  });

  test("each send is still rechecked for template, DNC, channel, consent, caps and quiet hours", () => {
    const execution = read(
      "supabase/migrations/20260915100000_whatsapp_campaign_execution.sql"
    );
    const start = execution.indexOf(
      "create or replace function private.whatsapp_campaign_job_eligibility"
    );
    assert.ok(start >= 0);
    const eligibility = execution.slice(start);
    for (const token of [
      "whatsapp_campaign_template_problem",
      "do_not_contact",
      "whatsapp_latest_marketing_consent",
      "whatsapp_preference_opted_out",
      "whatsapp_campaign_frequency_capped",
      "whatsapp_campaign_quiet_until",
    ]) {
      assert.match(eligibility, new RegExp(token));
    }
  });
});
describe("Rescheduling is narrow, audited and cannot mutate an active run", () => {
  test("forward migration keeps operator rules and scheduled-only movement", () => {
    const migration = read(
      "supabase/migrations/20260926183000_whatsapp_campaign_scheduler.sql"
    );
    assert.match(migration, /reschedule_whatsapp_campaign_run/);
    assert.match(migration, /whatsapp\.campaigns\.execute/);
    assert.match(migration, /whatsapp_campaign_raise_operator_denial/);
    assert.match(migration, /v_run\.status <> 'scheduled'/);
    assert.match(migration, /interval '2 minutes'/);
    assert.match(migration, /interval '90 days'/);
    assert.match(migration, /run_rescheduled/);
    assert.match(migration, /previous_scheduled_for/);
    assert.match(migration, /list_whatsapp_campaign_scheduler_runs/);
    assert.match(migration, /limit 1000/i);
    assert.doesNotMatch(migration, /service_role/);
  });

  test("recurrence is not silently activated in the initial scheduler release", () => {
    const migration = read(
      "supabase/migrations/20260926183000_whatsapp_campaign_scheduler.sql"
    );
    const page = read("src/app/admin/whatsapp/scheduler/page.tsx");
    assert.doesNotMatch(migration, /rrule|recurrence|repeat_interval/i);
    assert.doesNotMatch(page, /enable recurrence|repeat every/i);
  });
});
