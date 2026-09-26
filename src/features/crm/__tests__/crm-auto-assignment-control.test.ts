import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const MIGRATION = "supabase/migrations/20260925153724_crm_auto_assignment_control.sql";
const PAGE = "src/app/admin/crm/settings/assignment-rules/page.tsx";
const PANEL = "src/features/crm/components/settings/AssignmentRulesPanel.tsx";
const SERVICE = "src/features/crm/server/crm-assignment-rule-service.ts";
const ACTIONS = "src/features/crm/server/crm-assignment-rule-actions.ts";

describe("CRM auto-assignment control", () => {
  test("is OFF by default and never backfills existing leads", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /auto_assignment_enabled boolean not null default false/);
    assert.match(sql, /values \(true, false\)/);
    assert.match(sql, /after insert on public\.leads/);
    assert.doesNotMatch(sql, /update public\.leads[\s\S]*where .*created_at/i);
    assert.match(sql, /never backfills/i);
  });

  test("only future public-intake and local-test leads are eligible", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /NEW\.entry_method not in \('public_intake', 'local_test'\)/);
    assert.match(sql, /NEW\.assigned_to is not null/);
    assert.match(sql, /NEW\.status <> 'new'/);
    assert.doesNotMatch(sql, /NEW\.entry_method.*'import'.*or/i);
  });

  test("reuses the canonical rule resolver and First Contact SLA automation", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /private\.crm_resolve_lead_assignment_rule/);
    assert.match(sql, /assignment_method[\s\S]*'source_rule'/);
    assert.match(sql, /private\.ensure_first_contact_sla_clock/);
    assert.match(sql, /private\.ensure_sla_first_contact_primary/);
  });

  test("activation is Super Admin governed and audited", () => {
    const sql = read(MIGRATION);
    assert.match(sql, /private\.has_role\('super_admin'\)/);
    assert.match(sql, /crm_assignment_setting_events/);
    assert.match(sql, /previous_enabled/);
    assert.match(sql, /new_enabled/);
    assert.match(sql, /leads\.assignment_rules\.manage/);
  });

  test("settings UI explains future-only behaviour and blocks unsafe activation", () => {
    const page = read(PAGE);
    const panel = read(PANEL);
    assert.match(page, /fetchCrmAutoAssignmentSettingForCurrentUser/);
    assert.match(panel, /future website leads/i);
    assert.match(panel, /Existing leads are never changed/i);
    assert.match(panel, /hasEligibleSetup/);
    assert.match(panel, /Turn Auto Assignment ON/);
    assert.match(panel, /Super Admin control/);
  });

  test("the app changes the switch only through governed RPCs", () => {
    const service = read(SERVICE);
    const actions = read(ACTIONS);
    assert.match(service, /get_crm_auto_assignment_setting/);
    assert.match(service, /set_crm_auto_assignment_enabled/);
    assert.doesNotMatch(actions, /\.from\("crm_assignment_settings"\)/);
    assert.doesNotMatch(actions, /\.rpc\(/);
  });
});
