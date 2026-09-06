/**
 * Deleting an enquiry — the application half.
 *
 * The database suite (`50_crm_super_admin_lead_tombstone_test.sql`) owns
 * "who may delete and what survives". This one owns the questions SQL cannot
 * answer: does the control appear for the right person, does the form make the
 * owner mean it, and is the delete path genuinely separate from Closed Lost.
 *
 * The last one is the reason this file exists at all. Closed Lost and Delete
 * are one careless refactor away from sharing a helper, and the day they do,
 * `leads.transition` becomes a delete permission.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  LEAD_DELETE_CONFIRMATION,
  LEAD_DELETE_REASON_MAX,
  LEAD_DELETE_REASON_MIN,
  leadDeleteFieldErrorsToRecord,
  validateLeadDeleteInput,
} from "../contracts/lead-delete-contracts.ts";
import { CRM_ROLE_PERMISSIONS } from "../contracts/permissions.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** Strips comments: these files DESCRIBE what they refuse to do. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

/** The same for SQL, whose comments quote the rules they enforce. */
const sqlCode = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*/g, "");

const MIGRATION =
  "supabase/migrations/20260906180000_crm_super_admin_lead_tombstone.sql";
const DANGER_ZONE =
  "src/features/crm/components/leads/LeadDeleteDangerZone.tsx";
const ACTION = "src/features/crm/server/crm-lead-delete-actions.ts";
const SERVICE = "src/features/crm/server/crm-lead-delete-service.ts";
const DETAIL_PAGE = "src/app/admin/crm/leads/[leadId]/page.tsx";

const VALID = {
  leadId: "e0aaaaaa-0000-4000-8000-000000000001",
  reason: "Duplicate enquiry created in error by the website form",
  expectedUpdatedAt: "2026-09-06T10:00:00.000Z",
  confirmation: LEAD_DELETE_CONFIRMATION,
};

/* ========================================================================== */
/* 1. The owner has to mean it                                                 */
/* ========================================================================== */

describe("the delete input contract", () => {
  test("a complete, deliberate request validates", () => {
    assert.deepEqual(validateLeadDeleteInput(VALID), []);
  });

  test("a reason is required, and a shrug is not one", () => {
    for (const reason of ["", "   ", "junk", "duplicate"]) {
      const errors = validateLeadDeleteInput({ ...VALID, reason });
      assert.ok(
        errors.some((error) => error.field === "reason"),
        `"${reason}" must be refused`
      );
    }
    assert.equal(LEAD_DELETE_REASON_MIN, 10);
  });

  test("a reason has a ceiling too", () => {
    const errors = validateLeadDeleteInput({
      ...VALID,
      reason: "x".repeat(LEAD_DELETE_REASON_MAX + 1),
    });
    assert.ok(errors.some((error) => error.field === "reason"));
    assert.equal(LEAD_DELETE_REASON_MAX, 500);
  });

  test("the confirmation is exact, and case matters", () => {
    assert.equal(LEAD_DELETE_CONFIRMATION, "DELETE");
    for (const confirmation of ["", "delete", "Delete", "DELETE ", "yes"]) {
      const errors = validateLeadDeleteInput({ ...VALID, confirmation });
      assert.ok(
        errors.some((error) => error.field === "confirmation"),
        `"${confirmation}" must be refused`
      );
    }
  });

  test("a malformed enquiry reference is refused", () => {
    for (const leadId of ["", "not-a-uuid", "1234"]) {
      const errors = validateLeadDeleteInput({ ...VALID, leadId });
      assert.ok(errors.some((error) => error.field === "leadId"));
    }
  });

  test("field errors collapse to the first message per field", () => {
    const record = leadDeleteFieldErrorsToRecord(
      validateLeadDeleteInput({ ...VALID, reason: "", confirmation: "no" })
    );
    assert.ok(record.reason);
    assert.ok(record.confirmation);
    assert.equal(record.leadId, undefined);
  });
});

/* ========================================================================== */
/* 2. Only the owner sees it                                                   */
/* ========================================================================== */

describe("the Danger Zone belongs to the Super Admin alone", () => {
  test("the page renders it on canDeleteLeads and nothing else", () => {
    const page = read(DETAIL_PAGE);
    assert.match(page, /context\?\.canDeleteLeads \? \(/);
    assert.match(page, /<LeadDeleteDangerZone/);

    // The near-miss flags must not be what gates it.
    const gate = page.slice(
      page.indexOf("canDeleteLeads"),
      page.indexOf("<LeadDeleteDangerZone")
    );
    for (const wrong of ["canTransitionLeads", "canManageLead", "canReadBroad"]) {
      assert.ok(!gate.includes(wrong), `the gate must not use ${wrong}`);
    }
  });

  test("canDeleteLeads is the owner-only permission, in the mirror too", () => {
    assert.ok(CRM_ROLE_PERMISSIONS.super_admin.includes("leads.delete"));
    for (const role of [
      "sales_manager",
      "sales_executive",
      "management",
      "sales",
      "project_manager",
      "designer",
      "project_operations",
    ] as const) {
      assert.equal(
        CRM_ROLE_PERMISSIONS[role].includes("leads.delete"),
        false,
        `${role} must not hold leads.delete`
      );
    }
  });

  test("the control says Delete enquiry, not Close or Mark Lost", () => {
    const zone = read(DANGER_ZONE);
    assert.match(zone, /Delete enquiry/);
    assert.doesNotMatch(code(zone), /Close Lead|Mark Lost/);
    // And it points the reader at the thing they probably want instead.
    assert.match(zone, /Closed Lost/);
  });

  test("the form cannot be submitted until both fields are right", () => {
    const zone = code(read(DANGER_ZONE));
    assert.match(zone, /const canSubmit =/);
    assert.match(zone, /trimmedReason\.length >= LEAD_DELETE_REASON_MIN/);
    assert.match(zone, /confirmation === LEAD_DELETE_CONFIRMATION/);
    assert.match(zone, /disabled=\{!canSubmit\}/);
    // A native confirm() is not a confirmation: it is dismissible muscle memory.
    assert.doesNotMatch(zone, /window\.confirm|confirm\(/);
  });

  test("it carries the updated_at the page was rendered from", () => {
    assert.match(read(DANGER_ZONE), /name="expectedUpdatedAt"/);
    assert.match(read(DETAIL_PAGE), /expectedUpdatedAt=\{lead\.overview\.updatedAt\}/);
  });

  test("there is no bulk delete and no restore", () => {
    // The prose says "no undo"; what must be absent is a CONTROL, so the check
    // reads identifiers rather than words the copy legitimately uses.
    const zone = code(read(DANGER_ZONE));
    for (const absent of [
      "selectedIds",
      "selectedLeadIds",
      "bulkDelete",
      "restoreLead",
      "undeleteLead",
      "restoreLeadAction",
    ]) {
      assert.ok(!zone.includes(absent), `this phase ships no ${absent}`);
    }
    // Exactly one form, and it deletes.
    assert.equal((zone.match(/<form/g) ?? []).length, 1);
    assert.equal((zone.match(/action=\{formAction\}/g) ?? []).length, 1);
  });
});

/* ========================================================================== */
/* 3. The server path                                                          */
/* ========================================================================== */

describe("the delete action is its own path, not a lifecycle transition", () => {
  const action = read(ACTION);

  test("it checks canDeleteLeads and not a near-miss flag", () => {
    assert.match(action, /if \(!context\.canDeleteLeads\)/);
    for (const wrong of [
      "admin.access",
      "leads.manage",
      "leads.transition",
      "canTransitionLeads",
    ]) {
      assert.ok(
        !code(action).includes(wrong),
        `${wrong} must not appear as authority here`
      );
    }
  });

  test("it calls the canonical tombstone RPC and passes the stale check", () => {
    assert.match(action, /deleteLeadForCurrentUser/);
    assert.match(read(SERVICE), /rpc\("delete_lead_tombstone"/);
    assert.match(read(SERVICE), /p_expected_updated_at: input\.expectedUpdatedAt/);
    assert.match(read(SERVICE), /p_confirmation: input\.confirmation/);
  });

  test("it never physically deletes and never uses a service role", () => {
    for (const rel of [ACTION, SERVICE]) {
      const src = read(rel);
      assert.doesNotMatch(src, /\.delete\(\)/);
      assert.doesNotMatch(src, /from\("leads"\)/);
      assert.doesNotMatch(src, /service_role|SERVICE_ROLE|createAdminClient/);
    }
  });

  test("it refreshes every surface the enquiry has to vanish from", () => {
    for (const path of [
      "/admin/crm/leads",
      "/admin/crm/my-day",
      "/admin/crm/calendar",
      "/admin/crm/reports",
    ]) {
      assert.ok(action.includes(path), `${path} must be revalidated`);
    }
    assert.match(action, /redirect\("\/admin\/crm\/leads"\)/);
  });

  test("Closed Lost is untouched and lives somewhere else entirely", () => {
    // Different file, different permission, different verb.
    assert.ok(!action.includes("transitionLeadStatus"));
    const lifecycle = read("src/features/crm/server/crm-lifecycle-actions.ts");
    assert.ok(!lifecycle.includes("delete_lead_tombstone"));
    assert.ok(!lifecycle.includes("deleteLeadForCurrentUser"));
    assert.ok(CRM_ROLE_PERMISSIONS.sales_executive.includes("leads.transition"));
  });
});

/* ========================================================================== */
/* 4. No physical delete anywhere                                              */
/* ========================================================================== */

describe("nothing in this feature can physically delete a lead", () => {
  test("the migration writes a tombstone, never a DELETE", () => {
    const sql = sqlCode(read(MIGRATION));
    assert.doesNotMatch(sql, /delete\s+from\s+public\.leads/i);
    assert.doesNotMatch(sql, /truncate/i);
    assert.doesNotMatch(sql, /on delete cascade/i);
    assert.match(sql, /update public\.leads/);
    assert.match(sql, /set deleted_at = v_deleted_at/);
  });

  test("the RPC is double-locked on permission AND role", () => {
    const sql = sqlCode(read(MIGRATION));
    assert.match(sql, /authorize\('leads\.delete'\)/);
    assert.match(sql, /has_role\('super_admin'\)/);
    // The near misses are never consulted.
    for (const wrong of ["admin.access", "leads.manage", "leads.transition"]) {
      const rpc = sql.slice(sql.indexOf("function public.delete_lead_tombstone"));
      assert.ok(!rpc.includes(wrong), `${wrong} must not appear in the RPC`);
    }
  });

  test("a materially converted enquiry is refused", () => {
    const sql = read(MIGRATION);
    const rpc = sql.slice(sql.indexOf("function public.delete_lead_tombstone"));
    assert.match(rpc, /status = 'closed_won'/);
    assert.match(rpc, /from public\.quotations q where q\.lead_id/);
    assert.match(rpc, /from public\.quotation_acceptances qa where qa\.lead_id/);
    assert.match(rpc, /from public\.projects p where p\.lead_id/);
    assert.match(rpc, /CRM_LEAD_DELETE_CONVERTED_BLOCKED/);
  });

  test("history is quiesced through its own lifecycle, never deleted", () => {
    const sql = read(MIGRATION);
    const rpc = sql.slice(sql.indexOf("function public.delete_lead_tombstone"));
    assert.match(rpc, /update public\.lead_follow_ups/);
    assert.match(rpc, /status = 'cancelled'/);
    assert.match(rpc, /update public\.crm_lead_cadence_enrollments/);
    assert.match(rpc, /status = 'stopped'/);
    assert.doesNotMatch(rpc, /delete from public\.lead_/i);
    assert.doesNotMatch(rpc, /delete from public\.contacts/i);
  });

  test("the tombstone columns are RPC-only, like the pipeline columns", () => {
    const sql = read(MIGRATION);
    const guard = sql.slice(
      sql.indexOf("function private.forbid_direct_lead_owner_status_update")
    );
    for (const column of [
      "deleted_at",
      "deleted_by",
      "delete_reason",
      "deletion_reference",
    ]) {
      assert.match(
        guard.slice(0, guard.indexOf("$$;")),
        new RegExp(`NEW\\.${column} is distinct from OLD\\.${column}`),
        `${column} must be guarded against a direct write`
      );
    }
  });
});

/* ========================================================================== */
/* 5. Operational containment                                                  */
/* ========================================================================== */

describe("a deleted enquiry disappears from the operational surfaces", () => {
  const sql = read(MIGRATION);

  test("the row policy excludes tombstones, with no owner exception", () => {
    assert.match(sql, /create policy leads_select_crm_scoped/);
    const policy = sql.slice(
      sql.indexOf("create policy leads_select_crm_scoped"),
      sql.indexOf("-- E. SECURITY DEFINER")
    );
    assert.match(policy, /deleted_at is null/);
    // No recycle bin in this phase, so no branch pretending there is one.
    assert.ok(!policy.includes("super_admin"));
  });

  test("the central CRM predicates are hardened together", () => {
    for (const predicate of [
      "private.crm_can_view_lead_by_id",
      "private.crm_can_mutate_lead",
      "private.crm_user_can_operate_lead",
      "private.crm_can_view_contact",
    ]) {
      assert.ok(
        sql.includes(`create or replace function ${predicate}`),
        `${predicate} must be re-created with the filter`
      );
    }
    assert.match(sql, /create or replace function private\.crm_lead_is_operational/);
  });

  test("the definer functions RLS cannot reach are filtered too", () => {
    for (const fn of [
      "private.crm_lead_deal_values",
      "private.crm_evaluate_manual_lead_duplicate",
      "private.ensure_first_contact_sla_clock",
      "private.whatsapp_evaluate_service_send_eligibility",
      "private.whatsapp_inbox_can_use_conversation",
      "public.create_quotation_draft",
      "public.preview_campaign_audience",
      "public.get_campaign_metrics_board",
    ]) {
      assert.ok(
        sql.includes(`create or replace function ${fn}`),
        `${fn} must be re-created with the filter`
      );
    }
  });

  test("every re-created body reads the filtered lead set", () => {
    // The substitution is uniform and mechanical, which is what makes the
    // migration reviewable by diffing each body against its original.
    const filtered = sql.match(
      /\(select \* from public\.leads where deleted_at is null\)/g
    );
    assert.ok(
      (filtered?.length ?? 0) >= 14,
      `expected the filtered lead set throughout, saw ${filtered?.length ?? 0}`
    );
  });

  test("the read models inherit the filter rather than re-implementing it", () => {
    /*
     * The CRM read models query `leads` through the authenticated client, so the
     * row policy is what hides a tombstone from the list, the pipeline, My Day,
     * the calendar, the dashboard and the mobile routes alike. A second filter
     * in TypeScript would be a second thing to forget.
     */
    for (const rel of [
      "src/features/crm/server/crm-lead-queries.ts",
      "src/features/crm/server/crm-pipeline-queries.ts",
      "src/features/crm/server/crm-calendar-queries.ts",
    ]) {
      const src = read(rel);
      assert.doesNotMatch(
        src,
        /service_role|SERVICE_ROLE|createAdminClient/,
        `${rel} must read through RLS`
      );
    }
  });

  test("no mobile delete endpoint ships in this phase", () => {
    const action = read(ACTION);
    assert.ok(!action.includes("api/mobile"));
    // The mobile routes are read-only for leads and stay that way here.
    assert.doesNotMatch(
      read("src/app/api/mobile/crm/leads/route.ts"),
      /delete_lead_tombstone/
    );
  });
});
