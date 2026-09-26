import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildWhatsappCrmAudienceRule,
  currentIstMonth,
  isWhatsappCrmLeadMonth,
  resolveIstMonthWindow,
} from "../contracts/crm-campaigns.ts";
import { ONEDECORE_WHATSAPP_TEMPLATE_LIBRARY } from "../contracts/template-library.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

describe("CRM-native WhatsApp campaign audiences", () => {
  test("hot/warm/cold/lost plus lead month becomes the actual audience rule", () => {
    assert.deepEqual(buildWhatsappCrmAudienceRule("hot", "2026-09"), {
      logic: "and",
      rules: [
        { field: "sales_temperature", operator: "equals", values: ["hot"] },
        { field: "lead_created_month", operator: "equals", values: ["2026-09"] },
      ],
    });
    assert.equal(isWhatsappCrmLeadMonth("2026-09"), true);
    assert.equal(isWhatsappCrmLeadMonth("2026-13"), false);
    assert.deepEqual(buildWhatsappCrmAudienceRule("lost", "2026-09"), {
      logic: "and",
      rules: [
        { field: "sales_temperature", operator: "equals", values: ["lost"] },
        { field: "lead_created_month", operator: "equals", values: ["2026-09"] },
      ],
    });
    assert.equal(currentIstMonth(new Date("2026-09-30T20:00:00Z")), "2026-10");
  });

  test("long-term nurture is all-time, timeline-scoped and excludes terminal leads", () => {
    assert.deepEqual(
      buildWhatsappCrmAudienceRule(
        "all",
        "2026-09",
        { projectTimeline: "after-2-months" },
        { allReceivedMonths: true, excludeTerminalStages: true }
      ),
      {
        logic: "and",
        rules: [
          {
            field: "lead_stage",
            operator: "not_in",
            values: ["closed_lost", "closed_won"],
          },
          {
            field: "project_timeline",
            operator: "equals",
            values: ["after-2-months"],
          },
        ],
      }
    );
  });

  test("month boundaries are Indian calendar boundaries, represented in UTC", () => {
    assert.deepEqual(resolveIstMonthWindow("2026-09"), {
      startIso: "2026-08-31T18:30:00.000Z",
      endIso: "2026-09-30T18:30:00.000Z",
    });
  });

  test("the migration applies CRM fields to generic preview and WhatsApp execution", () => {
    const sql = read("supabase/migrations/20260926090616_whatsapp_crm_campaign_audiences.sql");
    assert.match(sql, /'sales_temperature'/);
    assert.match(sql, /'lead_created_month'/);
    assert.match(sql, /l\.manual_sales_temperature/);
    assert.match(sql, /when p_lead_status = 'closed_lost' then 'lost'/);
    assert.match(sql, /coalesce\(nullif\(lower\(trim\(p_sales_temperature\)\), ''\), 'cold'\)/);
    assert.match(sql, /'hot','warm','cold','lost'/);
    assert.match(sql, /l\.created_at/);
    assert.match(sql, /create or replace function public\.preview_campaign_audience/);
    assert.match(sql, /create or replace function private\.whatsapp_campaign_audience_contact_ids/);
    assert.match(sql, /l\.deleted_at is null/);
  });

  test("nurture migration extends preview and execution with project timeline", () => {
    const sql = read("supabase/migrations/20260926133930_whatsapp_long_term_nurture.sql");
    assert.match(sql, /'project_timeline'/);
    assert.match(sql, /campaign_rule_group_matches_lead_v4/);
    assert.match(sql, /l\.timeline_code/);
    assert.match(sql, /create or replace function public\.preview_campaign_audience/);
    assert.match(sql, /create or replace function private\.whatsapp_campaign_audience_contact_ids/);
  });

  test("unset CRM temperature is Cold and the launcher has no unclassified bucket", () => {
    const query = read("src/features/whatsapp/server/whatsapp-crm-campaign-queries.ts");
    const launcher = read("src/features/whatsapp/components/campaigns/CrmCampaignLauncher.tsx");
    assert.match(query, /manual_sales_temperature\.is\.null/);
    assert.match(query, /temperature === "lost"/);
    assert.doesNotMatch(launcher, /Not classified|unclassified/);
  });

  test("dashboard and manager navigation expose the CRM campaign workspace", () => {
    const owner = read("src/app/admin/page.tsx");
    const manager = read("src/features/manager-workspace/contracts/manager-nav.ts");
    const page = read("src/app/admin/whatsapp/campaigns/page.tsx");
    assert.match(owner, /\/admin\/whatsapp\/campaigns#crm-campaign-launcher/);
    assert.match(manager, /\/admin\/whatsapp\/campaigns/);
    assert.match(page, /CrmCampaignLauncher/);
    assert.match(page, /getWhatsappCrmAudienceCountsForCurrentUser/);
  });
});

describe("ONEDECORE local template preparation", () => {
  test("the library covers the CRM/service starter set without requiring Meta", () => {
    assert.ok(ONEDECORE_WHATSAPP_TEMPLATE_LIBRARY.length >= 20);
    const ids = new Set(ONEDECORE_WHATSAPP_TEMPLATE_LIBRARY.map((preset) => preset.id));
    for (const id of [
      "new-enquiry",
      "consultation-confirmed",
      "site-visit-confirmed",
      "quotation-ready",
      "payment-reminder",
      "project-handover",
      "marketing-kitchen",
      "marketing-reengagement",
    ]) {
      assert.equal(ids.has(id), true, id);
    }
    const forms = read("src/features/whatsapp/components/templates/TemplateStudioForms.tsx");
    assert.match(forms, /Local preparation works even while the provider is off/);
    assert.match(forms, /Provider submission is disabled/);
    assert.match(forms, /disabled=\{!available \|\| pending\}/);
  });
});
