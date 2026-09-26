import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  buildWhatsappCrmAudienceRule,
  sanitizeWhatsappCrmCampaignFilters,
} from "../contracts/crm-campaigns.ts";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
const MIGRATION = "supabase/migrations/20260926090630_whatsapp_crm_native_campaign_filters.sql";
const LAUNCHER = "src/features/whatsapp/components/campaigns/CrmCampaignLauncher.tsx";
const PAGE = "src/app/admin/whatsapp/campaigns/page.tsx";
const QUERIES = "src/features/whatsapp/server/whatsapp-crm-campaign-queries.ts";

describe("P4 CRM-native WhatsApp campaigns", () => {
  test("advanced CRM filters become governed campaign rules", () => {
    const group = buildWhatsappCrmAudienceRule("hot", "2026-09", {
      stage: "qualified",
      service: "modular-kitchens",
      source: "website",
      locality: "Baner",
      owner: "11111111-1111-4111-8111-111111111111",
      budget: "6-12l",
      lastInteractionAge: "8-14d",
      milestone: "site_visit",
      dormantDuration: "15-30d",
    });
    assert.equal(group.logic, "and");
    assert.equal(group.rules.length, 11);
    assert.ok(group.rules.some((rule) => rule.field === "owner"));
    assert.ok(group.rules.some((rule) => rule.field === "milestone"));
    assert.ok(group.rules.some((rule) => rule.field === "dormant_duration"));
  });
  test("invalid dynamic filter values are discarded before rule creation", () => {
    const filters = sanitizeWhatsappCrmCampaignFilters({
      stage: "made-up-stage",
      owner: "not-a-uuid",
      budget: "unlimited",
      locality: "  Baner  ",
    });
    assert.equal(filters.stage, undefined);
    assert.equal(filters.owner, undefined);
    assert.equal(filters.budget, undefined);
    assert.equal(filters.locality, "Baner");
  });

  test("the launcher exposes CRM filters without user-facing JSON", () => {
    const launcher = read(LAUNCHER);
    for (const label of [
      "Lead month", "Stage", "Service", "Source", "Locality", "Owner", "Budget",
      "Last interaction", "Consultation / site visit / quotation", "Dormant duration",
    ]) {
      assert.equal(launcher.includes(label), true, label);
    }
    assert.match(launcher, /Create CRM WhatsApp campaign/);
    assert.doesNotMatch(launcher, /<textarea[^>]*name=["']ruleGroup/);
  });

  test("campaign workspace presents the complete P4 journey", () => {
    const page = read(PAGE);
    for (const step of [
      "Audience", "Eligibility", "Template", "Variables", "CTA",
      "Preview", "Test", "Approval", "Schedule", "Launch",
    ]) {
      assert.equal(page.includes(">" + step + "<"), true, step);
    }
    assert.match(page, /previewCampaignAudience/);
    assert.match(page, /pre-template CRM eligibility proof/);
    assert.match(page, /frequency caps, quiet hours and CTA readiness/);
  });
  test("database matcher applies advanced CRM fields to preview and execution", () => {
    const sql = read(MIGRATION);
    for (const field of [
      "owner", "budget", "last_interaction_age", "milestone", "dormant_duration",
    ]) {
      assert.equal(sql.includes("'" + field + "'"), true, field);
    }
    assert.match(sql, /campaign_rule_group_matches_lead_v3/);
    assert.match(sql, /lead_activities/);
    assert.match(sql, /max\(a\.occurred_at\)/);
    assert.match(sql, /consultation_scheduled/);
    assert.match(sql, /site_visit_scheduled/);
    assert.match(sql, /proposal_sent/);
    assert.match(sql, /create or replace function private\.whatsapp_campaign_audience_contact_ids/);
    assert.match(sql, /create or replace function public\.preview_campaign_audience/);
  });

  test("P4 does not activate Meta, mutate consent, or add browser privileged access", () => {
    const sql = read(MIGRATION);
    const launcher = read(LAUNCHER);
    const queries = read(QUERIES);
    assert.doesNotMatch(sql, /insert into public\.consent_events/i);
    assert.doesNotMatch(sql, /marketing_execution_enabled\s*=\s*true/i);
    assert.doesNotMatch(sql, /provider_message|meta_access_token/i);
    assert.match(queries, /createClient\(\)/);
    assert.doesNotMatch(queries, /createAdminClient|service_role|SERVICE_ROLE/);
    assert.doesNotMatch(launcher, /service_role|META_ACCESS_TOKEN/);
  });
});
