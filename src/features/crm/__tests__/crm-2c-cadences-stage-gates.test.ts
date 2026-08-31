/**
 * CRM 2C — sales playbook cadences + stage gates.
 *
 * Pure contracts are exercised directly; component/route wiring is asserted from
 * source text (repo convention, see crm-2b-calendar-pipeline.test.ts).
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  CRM_ACTIVITY_RESOLUTIONS,
  CRM_ACTIVITY_SOURCES,
  completeInputToRpcArgs,
  normalizeCompleteLeadActivityInput,
  parseActivityResolution,
  parseCompleteLeadActivityForm,
  validateCompleteLeadActivityInput,
} from "../contracts/activity-contracts.ts";
import {
  CRM_CADENCE_ENROLLMENT_STATUSES,
  CRM_CADENCE_MAX_DELAY_HOURS,
  CRM_CADENCE_MAX_STEPS,
  CRM_CADENCE_STOP_REASONS,
  CRM_CADENCE_TEMPLATE_STATUSES,
  cadenceStepInputsToRpcPayload,
  formatCadenceDelayLabel,
  formatCadenceStatusLabel,
  formatCadenceStopReasonLabel,
  isLiveCadenceEnrollment,
  normalizeCadenceStepInputs,
  normalizeCadenceTemplateInput,
  validateCadenceStepInputs,
  validateCadenceTemplateInput,
  validateEnrollLeadInCadenceInput,
  type CrmCadenceStepInput,
} from "../contracts/cadence-contracts.ts";
import { CRM_PERMISSION_CODES, CRM_ROLE_PERMISSIONS } from "../contracts/permissions.ts";
import { getCompletionResolutionOptions, getDefaultCompletionResolution } from "../components/activities/activity-ui-utils.ts";

const root = process.cwd();

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const MIGRATION =
  "supabase/migrations/20260830140000_crm_cadence_playbook_foundation.sql";
const PGTAP = "supabase/tests/database/36_crm_cadence_playbook_foundation_test.sql";
const CADENCE_CONTRACTS = "src/features/crm/contracts/cadence-contracts.ts";
const CADENCE_ACTIONS = "src/features/crm/server/crm-cadence-actions.ts";
const CADENCE_SERVICE = "src/features/crm/server/crm-cadence-service.ts";
const CADENCE_ADAPTERS = "src/features/crm/server/crm-cadence-adapters.ts";
const CADENCE_QUERIES = "src/features/crm/server/crm-cadence-queries.ts";
const CADENCE_LIST_PAGE = "src/app/admin/crm/cadences/page.tsx";
const CADENCE_NEW_PAGE = "src/app/admin/crm/cadences/new/page.tsx";
const CADENCE_DETAIL_PAGE = "src/app/admin/crm/cadences/[cadenceId]/page.tsx";
const CADENCE_EDITOR =
  "src/features/crm/components/cadences/CadenceDraftEditor.tsx";
const CADENCE_LIFECYCLE =
  "src/features/crm/components/cadences/CadenceLifecycleActions.tsx";
const CADENCE_LIST = "src/features/crm/components/cadences/CadenceList.tsx";
const LEAD_CADENCE_PANEL =
  "src/features/crm/components/leads/LeadCadencePanel.tsx";
const CRM_NAV = "src/features/crm/components/shell/CrmNav.tsx";
const CRM_LAYOUT = "src/app/admin/crm/layout.tsx";
const LEAD_DETAIL_PAGE = "src/app/admin/crm/leads/[leadId]/page.tsx";
const COMPLETE_DIALOG =
  "src/features/crm/components/activities/CompleteActivityDialog.tsx";
const ACTIVITY_WORKSPACE =
  "src/features/crm/components/activities/LeadActivityWorkspace.tsx";
const PIPELINE_BOARD =
  "src/features/crm/components/pipeline/CrmPipelineBoard.tsx";
const STATUS_PANEL =
  "src/features/crm/components/leads/LeadStatusTransitionPanel.tsx";
const CALENDAR_QUERIES = "src/features/crm/server/crm-calendar-queries.ts";
const MY_DAY_MIGRATION = "supabase/migrations/20260829120000_crm_my_day_read_model.sql";
const CRM_ERRORS = "src/features/crm/server/crm-errors.ts";

function step(overrides: Partial<CrmCadenceStepInput> = {}): CrmCadenceStepInput {
  return {
    activityType: "call",
    title: "First contact call",
    priority: "urgent",
    delayHours: 0,
    durationMinutes: null,
    reminderOffsetMinutes: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe("CRM 2C cadence contracts", () => {
  test("template and enrollment vocabularies mirror the migration", () => {
    assert.deepEqual([...CRM_CADENCE_TEMPLATE_STATUSES], [
      "draft",
      "published",
      "archived",
    ]);
    assert.deepEqual([...CRM_CADENCE_ENROLLMENT_STATUSES], [
      "active",
      "paused",
      "completed",
      "stopped",
    ]);
    assert.deepEqual([...CRM_CADENCE_STOP_REASONS], [
      "lead_closed_won",
      "lead_closed_lost",
      "owner_not_operable",
      "manual_override",
      "cancelled_by_user",
    ]);

    const migration = readSrc(MIGRATION);
    for (const status of CRM_CADENCE_TEMPLATE_STATUSES) {
      assert.match(migration, new RegExp(`'${status}'`));
    }
    for (const reason of CRM_CADENCE_STOP_REASONS) {
      assert.match(migration, new RegExp(`'${reason}'`));
    }
  });

  test("only active and paused enrollments are live", () => {
    assert.equal(isLiveCadenceEnrollment("active"), true);
    assert.equal(isLiveCadenceEnrollment("paused"), true);
    assert.equal(isLiveCadenceEnrollment("completed"), false);
    assert.equal(isLiveCadenceEnrollment("stopped"), false);
  });

  test("template validation enforces the DB name and description bounds", () => {
    assert.deepEqual(
      validateCadenceTemplateInput({ name: "Interior enquiry", description: null }),
      []
    );
    assert.equal(
      validateCadenceTemplateInput({ name: "x", description: null })[0]?.field,
      "name"
    );
    assert.equal(
      validateCadenceTemplateInput({
        name: "Valid name",
        description: "d".repeat(501),
      })[0]?.field,
      "description"
    );
  });

  test("step validation mirrors every lead_follow_ups bound", () => {
    assert.deepEqual(validateCadenceStepInputs([step()]), []);
    assert.equal(validateCadenceStepInputs([])[0]?.field, "steps");
    assert.equal(
      validateCadenceStepInputs(
        Array.from({ length: CRM_CADENCE_MAX_STEPS + 1 }, () => step())
      )[0]?.field,
      "steps"
    );
    assert.equal(
      validateCadenceStepInputs([step({ title: "" })])[0]?.field,
      "steps.0.title"
    );
    assert.equal(
      validateCadenceStepInputs([
        step({ delayHours: CRM_CADENCE_MAX_DELAY_HOURS + 1 }),
      ])[0]?.field,
      "steps.0.delayHours"
    );
    assert.equal(
      validateCadenceStepInputs([step({ durationMinutes: 0 })])[0]?.field,
      "steps.0.durationMinutes"
    );
    assert.equal(
      validateCadenceStepInputs([step({ reminderOffsetMinutes: -1 })])[0]?.field,
      "steps.0.reminderOffsetMinutes"
    );
  });

  test("step order is positional — the editor array index is the step order", () => {
    const normalized = normalizeCadenceStepInputs([
      { activityType: "site_visit", title: "Visit", delayHours: "48" },
      { activityType: "call", title: "Debrief", delayHours: "24", priority: "high" },
    ]);

    assert.equal(normalized.length, 2);
    assert.equal(normalized[0]?.activityType, "site_visit");
    assert.equal(normalized[1]?.priority, "high");

    const payload = cadenceStepInputsToRpcPayload(normalized);
    assert.deepEqual(Object.keys(payload[0] ?? {}), [
      "activityType",
      "title",
      "priority",
      "delayHours",
      "durationMinutes",
      "reminderOffsetMinutes",
    ]);
    // No ordinal is ever transported: the DB derives step_order from position.
    assert.equal("stepOrder" in (payload[0] ?? {}), false);
  });

  test("unknown step values fall back to invalid rather than silently defaulting", () => {
    const normalized = normalizeCadenceStepInputs([
      { activityType: "email_blast", title: "Blast", delayHours: "abc" },
    ]);
    const errors = validateCadenceStepInputs(normalized);
    assert.ok(errors.some((entry) => entry.field === "steps.0.delayHours"));
  });

  test("enrollment input requires real identifiers", () => {
    assert.deepEqual(
      validateEnrollLeadInCadenceInput({
        leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        templateId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
      []
    );
    assert.equal(
      validateEnrollLeadInCadenceInput({ leadId: "nope", templateId: "nope" })
        .length,
      2
    );
  });

  test("delay and status labels read as sales language", () => {
    assert.equal(formatCadenceDelayLabel(0), "Immediately");
    assert.equal(formatCadenceDelayLabel(1), "1 hour later");
    assert.equal(formatCadenceDelayLabel(4), "4 hours later");
    assert.equal(formatCadenceDelayLabel(24), "1 day later");
    assert.equal(formatCadenceDelayLabel(30), "1 day 6h later");
    assert.equal(formatCadenceStatusLabel("paused"), "Paused");
    assert.equal(
      formatCadenceStopReasonLabel("lead_closed_won"),
      "Lead closed won"
    );
    assert.equal(formatCadenceStopReasonLabel(null), null);
  });

  test("template normalization trims and nulls an empty description", () => {
    assert.deepEqual(
      normalizeCadenceTemplateInput({ name: "  Proposal  ", description: "   " }),
      { name: "Proposal", description: null }
    );
  });
});

// ---------------------------------------------------------------------------

describe("CRM 2C CADENCE_NEXT resolution", () => {
  test("CADENCE_NEXT joins the resolution vocabulary; CLOSED_WON never does", () => {
    assert.ok(CRM_ACTIVITY_RESOLUTIONS.includes("CADENCE_NEXT"));
    assert.equal(parseActivityResolution("CADENCE_NEXT"), "CADENCE_NEXT");
    assert.equal(parseActivityResolution("CLOSED_WON"), null);
    assert.ok(CRM_ACTIVITY_SOURCES.includes("cadence"));
  });

  test("CADENCE_NEXT carries no next-primary payload to the RPC", () => {
    const input = normalizeCompleteLeadActivityInput({
      activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      outcomeCode: "connected",
      resolution: "CADENCE_NEXT",
    });
    assert.equal(input.resolution, "CADENCE_NEXT");
    assert.deepEqual(validateCompleteLeadActivityInput(input), []);

    const args = completeInputToRpcArgs(input);
    assert.equal(args.p_resolution, "CADENCE_NEXT");
    assert.equal(args.p_next_activity_type, null);
    assert.equal(args.p_next_title, null);
    assert.equal(args.p_next_due_at, null);
    assert.equal(args.p_on_hold_reason, null);
    assert.equal(args.p_closed_lost_reason, null);
  });

  test("mixing CADENCE_NEXT with another resolution payload is refused", () => {
    const parsed = parseCompleteLeadActivityForm({
      activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      outcomeCode: "connected",
      resolution: "CADENCE_NEXT",
      nextTitle: "Sneaky manual next action",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.fieldErrors?.resolution !== undefined, true);
    }
  });

  test("CADENCE_NEXT is offered only for an active cadence step with a next step", () => {
    const withCadence = getCompletionResolutionOptions({
      leadStatus: "contacted",
      isPrimary: true,
      hasOtherOpenPrimary: false,
      canContinueCadence: true,
    });
    assert.ok(withCadence.includes("CADENCE_NEXT"));
    assert.equal(getDefaultCompletionResolution(withCadence), "CADENCE_NEXT");

    const withoutCadence = getCompletionResolutionOptions({
      leadStatus: "contacted",
      isPrimary: true,
      hasOtherOpenPrimary: false,
    });
    assert.equal(withoutCadence.includes("CADENCE_NEXT"), false);

    // Terminal leads may only complete; a cadence can never revive them.
    const terminal = getCompletionResolutionOptions({
      leadStatus: "closed_won",
      isPrimary: true,
      hasOtherOpenPrimary: false,
      canContinueCadence: true,
    });
    assert.deepEqual([...terminal], ["NONE"]);
    assert.equal(terminal.includes("CLOSED_WON" as never), false);
  });

  test("the complete dialog only offers CADENCE_NEXT for the active enrollment", () => {
    const workspace = readSrc(ACTIVITY_WORKSPACE);
    assert.match(workspace, /activeCadenceEnrollmentId/);
    assert.match(workspace, /hasNextCadenceStep/);
    assert.match(
      workspace,
      /completeTarget\?\.cadenceEnrollmentId === activeCadenceEnrollmentId/
    );

    const dialog = readSrc(COMPLETE_DIALOG);
    assert.match(dialog, /canContinueCadence/);
    assert.match(dialog, /CADENCE_NEXT_STEP_UNAVAILABLE/);

    const leadPage = readSrc(LEAD_DETAIL_PAGE);
    assert.match(leadPage, /leadCadence\?\.status === "active"/);
    assert.match(leadPage, /upcomingStepTitle != null/);
  });
});

// ---------------------------------------------------------------------------

describe("CRM 2C stage gates", () => {
  test("gates live inside the canonical transition implementation only", () => {
    const migration = readSrc(MIGRATION);
    assert.match(
      migration,
      /create or replace function private\.transition_lead_status_impl/
    );
    assert.match(migration, /CRM_STAGE_GATE_FIRST_CONTACT_REQUIRED/);
    assert.match(migration, /CRM_STAGE_GATE_CONSULTATION_REQUIRED/);
    assert.match(migration, /CRM_STAGE_GATE_PROPOSAL_DELIVERY_REQUIRED/);

    // No second transition RPC is introduced anywhere in CRM 2C.
    assert.doesNotMatch(
      migration,
      /create or replace function public\.transition_lead_status\b/
    );
  });

  test("each gate reads canonical evidence, never a mutable flag", () => {
    const migration = readSrc(MIGRATION);
    assert.match(migration, /crm_sla_clocks[\s\S]{0,200}first_contact_attempt_at is not null/);
    assert.match(
      migration,
      /activity_type in \('consultation', 'site_visit'\)/
    );
    assert.match(migration, /quotation_access_grants/);
    assert.match(migration, /v\.status = 'finalized'/);
    assert.match(migration, /g\.revoked_at is null/);
    assert.doesNotMatch(migration, /gate_override|manual_override_flag|bypass_gate/);
  });

  test("gates never apply to Closed Lost, On Hold, resume or assignment edges", () => {
    const migration = readSrc(MIGRATION);
    const gateBlock = migration.slice(
      migration.indexOf("CRM 2C stage gates (owner lock D1)"),
      migration.indexOf("CRM_STAGE_GATE_PROPOSAL_DELIVERY_REQUIRED")
    );
    assert.doesNotMatch(gateBlock, /p_new_status = 'closed_lost'/);
    assert.doesNotMatch(gateBlock, /p_new_status = 'on_hold'/);
    // Every gate is keyed on a specific FROM stage, so on_hold resume never matches.
    assert.match(gateBlock, /v_old = 'assigned' and p_new_status = 'contacted'/);
    assert.match(
      gateBlock,
      /v_old = 'qualified' and p_new_status = 'consultation_scheduled'/
    );
  });

  test("contacted -> qualified and proposal_sent -> negotiation stay ungated", () => {
    const migration = readSrc(MIGRATION);
    assert.doesNotMatch(
      migration,
      /v_old = 'contacted' and p_new_status = 'qualified'[\s\S]{0,400}raise exception 'CRM_STAGE_GATE/
    );
    assert.doesNotMatch(
      migration,
      /v_old = 'proposal_sent' and p_new_status = 'negotiation'/
    );
  });

  test("Closed Won stays exclusive to accepted-quotation authority", () => {
    const migration = readSrc(MIGRATION);
    assert.match(migration, /CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE/);
    assert.match(
      migration,
      /create or replace function private\.accepted_quotation_close_won_impl/
    );
    assert.match(
      migration,
      /stop_lead_cadence_for_system\(p_lead_id, p_actor_id, 'lead_closed_won'\)/
    );
  });

  test("gate failures surface identically from lead detail and Pipeline", () => {
    // One shared server action is the only transition path for both surfaces.
    assert.match(readSrc(STATUS_PANEL), /transitionLeadStatusAction/);
    assert.match(readSrc(PIPELINE_BOARD), /transitionLeadStatusAction/);

    const errors = readSrc(CRM_ERRORS);
    assert.match(errors, /crm_stage_gate_first_contact_required/);
    assert.match(errors, /crm_stage_gate_consultation_required/);
    assert.match(errors, /crm_stage_gate_proposal_delivery_required/);
    assert.match(
      errors,
      /Record a first contact attempt before moving this lead to Contacted\./
    );
    assert.match(
      errors,
      /Schedule a consultation or site visit before moving this lead to Consultation Scheduled\./
    );
    assert.match(
      errors,
      /Send the finalized quotation through the controlled client-access flow/
    );
  });

  test("Pipeline rolls back its optimistic move and shows the gate message", () => {
    const board = readSrc(PIPELINE_BOARD);
    assert.match(board, /if \(!result\.success\)/);
    assert.match(board, /delete next\[card\.leadId\]/);
    assert.match(board, /setErrorMessage\(result\.message/);
    // The board never writes leads directly.
    assert.doesNotMatch(board, /\.from\("leads"\)/);
  });

  test("CRM 2C token mapping runs before the generic not-found fallback", () => {
    const errors = readSrc(CRM_ERRORS);
    assert.ok(
      errors.indexOf("crm2cTokenMap") < errors.indexOf("activityTokenMap"),
      "CRM 2C tokens must be matched first"
    );
    assert.ok(
      errors.indexOf("cadence_template_not_found") <
        errors.indexOf('normalised.includes("not found")')
    );
  });
});

// ---------------------------------------------------------------------------

describe("CRM 2C cadence runtime boundaries", () => {
  test("progression is one step at a time with no scheduler", () => {
    const migration = readSrc(MIGRATION);
    assert.match(migration, /crm_cadence_next_step/);
    assert.match(migration, /step_order > coalesce\(p_after_order, 0::smallint\)/);
    assert.match(migration, /limit 1/);
    assert.doesNotMatch(migration, /pg_cron|cron\.schedule|pg_net/);
    assert.equal(existsSync(join(root, "supabase/functions")), false);
  });

  test("every materialized step is the single open primary next action", () => {
    const migration = readSrc(MIGRATION);
    assert.match(migration, /clear_open_primary_for_lead/);
    assert.match(migration, /uq_lead_follow_ups_cadence_step/);
    assert.match(migration, /is_primary_next_action[\s\S]{0,400}'cadence'/);
  });

  test("cadence provenance is immutable and consistent", () => {
    const migration = readSrc(MIGRATION);
    assert.match(migration, /chk_lead_follow_ups_cadence_provenance/);
    assert.match(
      migration,
      /cadence_enrollment_id is not null and cadence_step_id is not null and source = 'cadence'/
    );
    // No denormalized cadence flag is added to public.leads.
    assert.doesNotMatch(migration, /alter table public\.leads[\s\S]{0,200}cadence/);
  });

  test("On Hold pauses and Closed Lost stops, both via the transition authority", () => {
    const migration = readSrc(MIGRATION);
    assert.match(
      migration,
      /if p_new_status = 'on_hold' then\s*\n\s*perform private\.pause_lead_cadence_for_hold/
    );
    assert.match(
      migration,
      /stop_lead_cadence_for_system\(p_lead_id, v_actor, 'lead_closed_lost'\)/
    );
  });

  test("cancelling a cadence never removes the lead primary next action", () => {
    const migration = readSrc(MIGRATION);
    const cancelImpl = migration.slice(
      migration.indexOf("function private.cancel_lead_cadence_impl"),
      migration.indexOf("K. Public wrappers")
    );
    assert.doesNotMatch(cancelImpl, /update public\.lead_follow_ups/);
    assert.match(cancelImpl, /'cancelled_by_user'/);
  });

  test("reassignment reuses the CRM 2A owner-aware activity transfer", () => {
    const migration = readSrc(MIGRATION);
    // CRM 2C adds no reassignment logic of its own.
    assert.doesNotMatch(
      migration,
      /create or replace function private\.(assign_lead_impl|sync_open_activities_on_assignment)/
    );
    assert.match(
      readSrc(PGTAP),
      /reassignment transfers the open cadence activity with the lead/
    );
  });

  test("cadence tables are select-only for authenticated callers", () => {
    const migration = readSrc(MIGRATION);
    for (const table of [
      "crm_cadence_templates",
      "crm_cadence_steps",
      "crm_lead_cadence_enrollments",
      "crm_cadence_enrollment_events",
    ]) {
      assert.match(
        migration,
        new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated;`)
      );
      assert.match(
        migration,
        new RegExp(`grant select on table public\\.${table} to authenticated;`)
      );
      assert.doesNotMatch(
        migration,
        new RegExp(`grant (insert|update|delete)[^;]*public\\.${table}`)
      );
    }
  });

  test("enrollment RLS never widens lead visibility", () => {
    const migration = readSrc(MIGRATION);
    assert.match(
      migration,
      /policy crm_lead_cadence_enrollments_select[\s\S]{0,400}crm_can_view_lead/
    );
    assert.match(
      migration,
      /policy crm_cadence_enrollment_events_select[\s\S]{0,400}crm_can_view_lead/
    );
  });

  test("no automatic transport: the cadence engine never calls WhatsApp send", () => {
    const migration = readSrc(MIGRATION);
    const cadenceEngine = migration.slice(
      migration.indexOf("H. Cadence engine helpers"),
      migration.indexOf("L. Canonical authorities")
    );
    assert.ok(cadenceEngine.length > 1000, "cadence engine slice must be found");

    for (const forbidden of [
      "create_whatsapp_service_send_intent",
      "create_quotation_whatsapp_service_send_intent",
      "claim_whatsapp_send_intent_for_dispatch",
      "bind_whatsapp_send_intent_dispatch",
      "record_whatsapp_dispatch_attempt_outcome",
    ]) {
      assert.ok(
        !cadenceEngine.includes(forbidden),
        `the cadence engine must never reference ${forbidden}`
      );
    }
    // `whatsapp` may appear only as a canonical activity_type — never as a
    // transport table, intent or dispatch identifier.
    assert.doesNotMatch(
      cadenceEngine,
      /whatsapp_(send|message|conversation|provider)/i
    );
    assert.doesNotMatch(cadenceEngine, /dispatch/i);
    assert.doesNotMatch(cadenceEngine, /consent_events/i);
    assert.doesNotMatch(migration, /insert into public\.consent_events/);

    // The single WhatsApp mention in the migration is the postcondition guard
    // that asserts the engine cannot reach transport.
    assert.match(
      migration,
      /cadence engine must not reference WhatsApp send authority/
    );

    for (const path of [
      CADENCE_ACTIONS,
      CADENCE_SERVICE,
      CADENCE_ADAPTERS,
      CADENCE_QUERIES,
      LEAD_CADENCE_PANEL,
      CADENCE_EDITOR,
    ]) {
      const source = readSrc(path);
      assert.doesNotMatch(source, /send_intent|sendIntent|graph\.facebook/i);
    }
  });

  test("no starter cadence is seeded and SLA stays inactive", () => {
    const migration = readSrc(MIGRATION);
    assert.match(migration, /cadence tables must ship empty/);
    assert.match(
      migration,
      /first_contact SLA policy must remain inactive\/unconfigured/
    );
    assert.doesNotMatch(migration, /business_hours_config\s*=\s*'\{/);
  });
});

// ---------------------------------------------------------------------------

describe("CRM 2C permissions", () => {
  test("crm.cadences.manage is granted to super_admin and sales_manager only", () => {
    assert.ok(CRM_PERMISSION_CODES.includes("crm.cadences.manage"));
    assert.ok(CRM_ROLE_PERMISSIONS.super_admin.includes("crm.cadences.manage"));
    assert.ok(CRM_ROLE_PERMISSIONS.sales_manager.includes("crm.cadences.manage"));
    assert.equal(
      CRM_ROLE_PERMISSIONS.sales_executive.includes("crm.cadences.manage"),
      false
    );
    assert.equal(
      CRM_ROLE_PERMISSIONS.project_manager.includes("crm.cadences.manage"),
      false
    );
    assert.equal(
      CRM_ROLE_PERMISSIONS.designer.includes("crm.cadences.manage"),
      false
    );

    const migration = readSrc(MIGRATION);
    assert.match(
      migration,
      /r\.code in \('super_admin', 'sales_manager'\)/
    );
  });

  test("enrollment reuses crm.follow_ups.manage rather than a new permission", () => {
    const service = readSrc(CADENCE_SERVICE);
    assert.match(service, /canManageLeadFollowUps/);
    assert.doesNotMatch(service, /cadences\.enroll/);

    const migration = readSrc(MIGRATION);
    assert.match(
      migration,
      /enroll_lead_in_cadence_impl[\s\S]{0,1200}authorize\('crm\.follow_ups\.manage'\)/
    );
    assert.match(
      migration,
      /enroll_lead_in_cadence_impl[\s\S]{0,1600}crm_can_mutate_lead/
    );
    assert.doesNotMatch(migration, /'crm\.cadences\.enroll'/);
  });

  test("template routes require crm.cadences.manage", () => {
    for (const page of [
      CADENCE_LIST_PAGE,
      CADENCE_NEW_PAGE,
      CADENCE_DETAIL_PAGE,
    ]) {
      assert.match(readSrc(page), /requireCrmCadenceAccess/);
    }
  });

  test("cadence contracts stay client-safe so the editor can import them", () => {
    const contracts = readSrc(CADENCE_CONTRACTS);
    assert.doesNotMatch(contracts, /server-only/);
    assert.doesNotMatch(contracts, /@\/lib\/supabase/);
  });

  test("cadence mutations never write cadence tables from the browser", () => {
    for (const path of [CADENCE_SERVICE, CADENCE_ADAPTERS]) {
      const source = readSrc(path);
      assert.doesNotMatch(source, /\.from\("crm_cadence/);
    }
    const actions = readSrc(CADENCE_ACTIONS);
    assert.match(actions, /^"use server";/);
    assert.doesNotMatch(actions, /createClient/);
  });
});

// ---------------------------------------------------------------------------

describe("CRM 2C UX surfaces", () => {
  test("Cadences is a permission-gated secondary CRM navigation entry", () => {
    const nav = readSrc(CRM_NAV);
    assert.match(nav, /showCadences/);
    assert.match(nav, /href: "\/admin\/crm\/cadences", label: "Cadences"/);
    // Primary daily nav is unchanged.
    const baseNav = nav.slice(
      nav.indexOf("BASE_NAV_ITEMS"),
      nav.indexOf("] as const;")
    );
    assert.doesNotMatch(baseNav, /cadences/);

    assert.match(
      readSrc(CRM_LAYOUT),
      /showCadences=\{resolution\.context\.canManageCadences\}/
    );
  });

  test("the cadence admin is a list plus a light usage count, not a dashboard", () => {
    const list = readSrc(CADENCE_LIST);
    assert.match(list, /Live enrollments/);
    assert.match(list, /crm-cadence-usage-count/);
    assert.doesNotMatch(list, /chart|Chart|funnel|conversion rate/);
  });

  test("the step editor supports keyboard reordering with no drag-only path", () => {
    const editor = readSrc(CADENCE_EDITOR);
    assert.match(editor, /crm-cadence-step-up/);
    assert.match(editor, /crm-cadence-step-down/);
    assert.match(editor, /crm-cadence-add-step/);
    assert.match(editor, /crm-cadence-step-remove/);
    assert.doesNotMatch(editor, /draggable|onDragStart|onDrop/);
    // Touch targets stay at the CRM minimum on mobile widths.
    assert.match(editor, /min-h-11/);
    assert.match(editor, /text-base sm:text-sm/);
  });

  test("publish and archive are explicit lifecycle actions", () => {
    const lifecycle = readSrc(CADENCE_LIFECYCLE);
    assert.match(lifecycle, /publishCadenceTemplateAction/);
    assert.match(lifecycle, /archiveCadenceTemplateAction/);
    assert.match(lifecycle, /duplicateCadenceTemplateAction/);
    assert.match(lifecycle, /Publishing freezes the steps/);

    const detail = readSrc(CADENCE_DETAIL_PAGE);
    assert.match(detail, /template\.status === "draft"/);
    assert.match(detail, /CadenceStepList/);
    assert.match(detail, /Published steps are frozen/);
  });

  test("lead detail shows cadence state and enroll/pause/resume/cancel", () => {
    const panel = readSrc(LEAD_CADENCE_PANEL);
    assert.match(panel, /crm-lead-cadence-enroll/);
    assert.match(panel, /crm-lead-cadence-pause/);
    assert.match(panel, /crm-lead-cadence-resume/);
    assert.match(panel, /crm-lead-cadence-cancel/);
    assert.match(panel, /crm-lead-cadence-progress/);
    assert.match(panel, /crm-lead-cadence-upcoming/);
    assert.match(panel, /crm-lead-cadence-history/);
    // Enrollment is only offered for an eligible, assigned, non-terminal lead.
    assert.match(panel, /isTerminalLeadStage\(leadStatus\)/);
    assert.match(panel, /leadStatus !== "on_hold"/);
    // The panel never re-implements the Activities workspace.
    assert.doesNotMatch(panel, /CompleteActivityDialog|CreateActivityForm/);

    assert.match(readSrc(LEAD_DETAIL_PAGE), /LeadCadencePanel/);
  });

  test("My Day and Calendar pick cadence activities up as ordinary activities", () => {
    const calendar = readSrc(CALENDAR_QUERIES);
    assert.match(calendar, /from\("lead_follow_ups"\)/);
    assert.doesNotMatch(calendar, /source/);

    const myDay = readSrc(MY_DAY_MIGRATION);
    assert.doesNotMatch(myDay, /source\s*=\s*'/);

    // No separate cadence task queue exists anywhere.
    assert.equal(existsSync(join(root, "src/app/admin/crm/cadence-tasks")), false);
  });

  test("Pipeline is not redesigned by CRM 2C", () => {
    const board = readSrc(PIPELINE_BOARD);
    assert.doesNotMatch(board, /cadence/i);
  });
});
