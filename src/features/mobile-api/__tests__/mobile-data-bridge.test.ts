import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const route = readFileSync(
  join(process.cwd(), "src/app/api/mobile/data/route.ts"),
  "utf8"
);

test("mobile data bridge uses caller bearer auth and never service role", () => {
  assert.match(route, /readBearerToken\(request\)/);
  assert.match(route, /createBearerClient\(token\)/);
  assert.match(route, /db\.auth\.getUser\(\)/);
  assert.doesNotMatch(route, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("mobile data bridge is an explicit allowlist, not an arbitrary proxy", () => {
  for (const table of [
    "attendance_corrections",
    "attendance_days",
    "attendance_policies",
    "attendance_submissions",
    "contact_channels",
    "contacts",
    "crm_lead_cadence_enrollments",
    "lead_activity_outcome_codes",
    "lead_follow_ups",
    "lead_notes",
    "lead_sources",
    "leads",
    "leave_requests",
    "leave_types",
    "profiles",
    "project_design_workflows",
    "project_designer_assignments",
    "project_execution_workflows",
    "project_manager_assignments",
    "projects",
    "quotations",
    "staff_employment_profiles",
    "user_roles",
  ]) {
    assert.match(route, new RegExp(JSON.stringify(table)));
  }

  for (const rpc of [
    "approve_attendance_day",
    "assign_lead",
    "cancel_lead_follow_up",
    "complete_lead_follow_up",
    "correct_attendance_day",
    "create_lead_follow_up",
    "get_attendance_approval_inbox",
    "get_attendance_monthly_summary",
    "get_crm_lead_commercial_state",
    "get_project_execution_high_level_status",
    "has_active_role",
    "list_crm_assignable_executives",
    "list_salary_statements",
    "reject_attendance_day",
    "return_attendance_for_correction",
  ]) {
    assert.match(route, new RegExp(JSON.stringify(rpc)));
  }

  assert.match(route, /const INSERT_TABLES = new Set\(\[\s*"lead_notes"/);
  assert.match(route, /payload\.action === "insert"/);
  assert.match(route, /Writes are not allowed for that mobile table/);
});

test("mobile data bridge preserves database enforcement under the caller token", () => {
  assert.match(route, /db\.from\(payload\.table as never\)/);
  assert.match(route, /db\.rpc\(payload\.name as never/);
  assert.match(route, /READ_TABLES\.has/);
  assert.match(route, /RPCS\.has/);
});
