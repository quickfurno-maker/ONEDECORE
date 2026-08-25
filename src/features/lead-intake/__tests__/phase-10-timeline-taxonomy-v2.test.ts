/**
 * PR #94 — timeline taxonomy v2 (owner-authorized).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { LEAD_TIMELINE_CODES } from "../planner-allowlist.ts";
import { formatCrmCodeLabel } from "../../crm/contracts/crm-labels.ts";
import { MANUAL_LEAD_CATALOG_LABELS } from "../../crm/contracts/manual-lead-contracts.ts";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("PR94 timeline taxonomy v2", () => {
  test("PM_PLANNER and allowlist expose exactly the four canonical timelines", () => {
    const planner = read("src/features/public-site/home-r4/content.ts");
    const timelineBlock = planner.slice(
      planner.indexOf("timelines: ["),
      planner.indexOf("],", planner.indexOf("timelines: [") + 1) + 1
    );
    assert.match(timelineBlock, /id: "immediate", label: "Immediate"/);
    assert.match(timelineBlock, /id: "within-1-month", label: "Within 1 month"/);
    assert.match(timelineBlock, /id: "within-2-months", label: "Within 2 months"/);
    assert.match(timelineBlock, /id: "after-2-months", label: "After 2 months"/);
    assert.equal((timelineBlock.match(/id:/g) ?? []).length, 4);
    assert.deepEqual([...LEAD_TIMELINE_CODES], [
      "immediate",
      "within-1-month",
      "within-2-months",
      "after-2-months",
    ]);
    for (const legacy of [
      "ready-now",
      "within-3-months",
      "3-6-months",
      "more-than-6-months",
      "Just exploring",
      "Ready now",
      "Within 3 months",
    ]) {
      assert.doesNotMatch(timelineBlock, new RegExp(legacy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.doesNotMatch(timelineBlock, /id: "exploring"|label: "Just exploring"/);
  });

  test("CRM display maps the four canonical IDs to customer labels", () => {
    assert.equal(formatCrmCodeLabel("immediate"), "Immediate");
    assert.equal(formatCrmCodeLabel("within-1-month"), "Within 1 month");
    assert.equal(formatCrmCodeLabel("within-2-months"), "Within 2 months");
    assert.equal(formatCrmCodeLabel("after-2-months"), "After 2 months");
    assert.deepEqual(Object.keys(MANUAL_LEAD_CATALOG_LABELS.timeline), [
      "immediate",
      "within-1-month",
      "within-2-months",
      "after-2-months",
    ]);
  });

  test("HomePlan summary resolves timeline through PM_PLANNER labels", () => {
    const plan = read("src/features/public-site/home-r4/HomePlan.tsx");
    const capture = read("src/features/lead-intake/public/HomeLeadCapture.tsx");
    assert.match(plan, /labelOf\(PM_PLANNER\.timelines, plan\.timeline\)/);
    assert.match(capture, /PM_PLANNER\.timelines\.map/);
    assert.doesNotMatch(plan, /ready-now|within-3-months/);
    assert.doesNotMatch(capture, /ready-now|within-3-months/);
  });

  test("forward migration exists after reserved payment timestamp and updates contract", () => {
    assert.equal(
      existsSync(
        join(
          root,
          "supabase/migrations/20260825140000_commerce_online_payment_adapter_foundation.sql"
        )
      ),
      false
    );
    const migration = join(
      root,
      "supabase/migrations/20260825163000_lead_timeline_taxonomy_v2.sql"
    );
    assert.equal(existsSync(migration), true);
    const src = readFileSync(migration, "utf8");
    assert.match(src, /chk_leads_timeline_code/);
    assert.match(src, /'immediate'/);
    assert.match(src, /'within-1-month'/);
    assert.match(src, /'within-2-months'/);
    assert.match(src, /'after-2-months'/);
    assert.match(src, /create or replace function public\.submit_lead_intake/);
    assert.match(src, /create or replace function private\.create_manual_lead_impl/);
    assert.match(src, /create or replace function private\.crm_import_validate_row/);
    assert.doesNotMatch(src, /'ready-now'|within-3-months|more-than-6-months/);
    assert.doesNotMatch(src, /20260825140000_commerce_online_payment/);
    const names = readdirSync(join(root, "supabase/migrations"));
    assert.equal(
      names.includes("20260825140000_commerce_online_payment_adapter_foundation.sql"),
      false
    );
    assert.ok(names.includes("20260825163000_lead_timeline_taxonomy_v2.sql"));
  });

  test("no silent remapping helpers from new IDs to legacy IDs", () => {
    const files = [
      "src/features/lead-intake/public/plan-to-lead-request.ts",
      "src/features/lead-intake/server/lead-intake-validation.ts",
      "src/features/lead-intake/planner-allowlist.ts",
      "src/features/public-site/home-r4/content.ts",
    ];
    for (const rel of files) {
      const src = read(rel);
      assert.doesNotMatch(
        src,
        /immediate\s*->\s*ready-now|within-1-month\s*->\s*within-3-months/
      );
      assert.doesNotMatch(src, /ready-now|within-3-months|more-than-6-months/);
    }
  });
});
