/**
 * Phase 5E-B — sales targets & CRM reporting tests.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  ACHIEVEMENT_INACTIVE_COPY,
  formatInrFromPaise,
  parseInrToPaise,
  validateCreateSalesTargetInput,
  validateTargetMonth,
} from "../contracts/sales-target-contracts.ts";
import { resolveReportDateRange } from "../contracts/reporting-date-range.ts";
import { REPORT_CUSTOM_MAX_DAYS } from "../contracts/reporting-contracts.ts";

const root = process.cwd();

describe("Phase 5E migration contract", () => {
  test("migration 16 defines sales targets foundation", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260803140000_crm_sales_targets_reporting_foundation.sql"
      ),
      "utf8"
    );
    assert.match(migration, /sales_targets/);
    assert.match(migration, /sales_target_events/);
    assert.match(migration, /sales_targets\.read/);
    assert.match(migration, /sales_targets\.manage/);
    assert.match(migration, /crm\.reporting\.read/);
    assert.match(migration, /create_sales_target/);
    assert.match(migration, /idx_lead_follow_ups_owner_status_due/);
    assert.doesNotMatch(migration, /achieved_revenue/);
    assert.doesNotMatch(migration, /attainment_percent/);
  });

  test("pgTAP test 10 exists", () => {
    const sql = readFileSync(
      join(root, "supabase/tests/database/10_crm_sales_targets_reporting_test.sql"),
      "utf8"
    );
    assert.match(sql, /phase5e/);
    assert.match(sql, /select plan\(24\)/);
  });
});

describe("Phase 5E permissions", () => {
  test("sales target permissions mapped in CRM_ROLE_PERMISSIONS", () => {
    const src = readFileSync(
      join(root, "src/features/crm/contracts/permissions.ts"),
      "utf8"
    );
    assert.match(src, /sales_targets\.read/);
    assert.match(src, /sales_targets\.manage/);
    assert.match(src, /crm\.reporting\.read/);
    assert.match(src, /super_admin:[\s\S]*sales_targets\.manage/);
    assert.doesNotMatch(src, /sales_manager:[\s\S]*sales_targets\.manage/);
    assert.doesNotMatch(src, /project_manager:[\s\S]*sales_targets\.read/);
  });
});

describe("Phase 5E target contracts", () => {
  test("achievement inactive copy is exact concept", () => {
    assert.equal(
      ACHIEVEMENT_INACTIVE_COPY,
      "Not activated until quotation acceptance (Phase 7B)"
    );
  });

  test("INR money formatting and parsing", () => {
    assert.equal(formatInrFromPaise(1_000_000), "₹10,000");
    assert.equal(parseInrToPaise("25000"), 2_500_000);
  });

  test("create target validation rejects invalid month", () => {
    const errors = validateCreateSalesTargetInput({
      targetScope: "sales_team",
      targetMonth: "2026-08-15",
      targetUserId: null,
      revenueTargetPaise: 1_000_000,
      closedWonCountTarget: 5,
      reason: "Valid reason for team target setup.",
    });
    assert.ok(errors.targetMonth);
  });

  test("target month validator accepts first day", () => {
    assert.equal(validateTargetMonth("2026-08-01"), null);
  });
});

describe("Phase 5E reporting date range", () => {
  test("custom range rejects spans over 366 days", () => {
    const result = resolveReportDateRange({
      preset: "custom",
      customStart: "2025-01-01",
      customEnd: "2026-12-31",
    });
    assert.ok(result.error?.includes(String(REPORT_CUSTOM_MAX_DAYS)));
  });

  test("this_month preset resolves IST boundaries", () => {
    const result = resolveReportDateRange({
      preset: "this_month",
      now: new Date("2026-08-15T12:00:00Z"),
    });
    assert.ok(result.range?.startIso.includes("+05:30"));
    assert.equal(result.range?.preset, "this_month");
  });
});

describe("Phase 5E routes and capabilities", () => {
  test("targets and reports routes exist", () => {
    assert.ok(existsSync(join(root, "src/app/admin/crm/targets/page.tsx")));
    assert.ok(existsSync(join(root, "src/app/admin/crm/reports/page.tsx")));
  });

  test("crm access context includes target/reporting capability flags", () => {
    const src = readFileSync(
      join(root, "src/features/crm/contracts/crm-access.ts"),
      "utf8"
    );
    assert.match(src, /canReadSalesTargets/);
    assert.match(src, /canManageSalesTargets/);
    assert.match(src, /canReadCrmReporting/);
  });

  test("nav exposes targets and reports when flagged", () => {
    const src = readFileSync(
      join(root, "src/features/crm/components/shell/CrmNav.tsx"),
      "utf8"
    );
    assert.match(src, /showTargets/);
    assert.match(src, /showReports/);
    assert.match(src, /\/admin\/crm\/targets/);
    assert.match(src, /\/admin\/crm\/reports/);
  });
});
