/**
 * CRM 2A-4 — activity adapter / service tests (mocked Supabase).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  completeInputToRpcArgs,
  normalizeCompleteLeadActivityInput,
  normalizeCreateLeadActivityInput,
} from "../contracts/activity-contracts.ts";
import {
  callCompleteLeadActivity,
  callCreateLeadActivity,
  callDesignatePrimaryNextAction,
  callRescheduleLeadActivity,
  callTransferActivityOwnership,
} from "../server/crm-activity-adapters.ts";

const root = process.cwd();
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTIVITY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVITY_ID,
    lead_id: LEAD_ID,
    owner_id: OWNER_ID,
    due_at: FUTURE,
    status: "open",
    activity_type: "call",
    title: "Call",
    priority: "normal",
    is_primary_next_action: false,
    outcome_code: null,
    outcome: null,
    duration_minutes: null,
    reminder_at: null,
    completion_note: null,
    quotation_id: null,
    source: "manual",
    created_at: FUTURE,
    updated_at: FUTURE,
    created_by: OWNER_ID,
    completed_at: null,
    completed_by: null,
    cancelled_at: null,
    cancelled_by: null,
    ...overrides,
  };
}

function mockClient(handler: (fn: string, args: Record<string, unknown>) => unknown) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      try {
        const data = await handler(fn, args);
        return { data, error: null };
      } catch (error: unknown) {
        return {
          data: null,
          error: {
            message: error instanceof Error ? error.message : "RPC failed",
          },
        };
      }
    },
  } as never;
}

describe("CRM 2A-4 adapters", () => {
  test("create adapter sends exact p_* args", async () => {
    let seen: { fn: string; args: Record<string, unknown> } | null = null;
    const client = mockClient((fn, args) => {
      seen = { fn, args };
      return sampleRow();
    });

    const input = normalizeCreateLeadActivityInput({
      leadId: LEAD_ID,
      activityType: "whatsapp",
      title: "WA follow-up",
      dueAt: FUTURE,
      priority: "high",
      ownerId: OWNER_ID,
      isPrimary: true,
      durationMinutes: 15,
      reminderAt: null,
      quotationId: null,
    });

    const result = await callCreateLeadActivity(client, input);
    assert.ok(seen);
    const createCall = seen as { fn: string; args: Record<string, unknown> };
    assert.equal(createCall.fn, "create_lead_activity");
    assert.equal(createCall.args.p_lead_id, LEAD_ID);
    assert.equal(createCall.args.p_activity_type, "whatsapp");
    assert.equal(createCall.args.p_title, "WA follow-up");
    assert.equal(createCall.args.p_due_at, FUTURE);
    assert.equal(createCall.args.p_priority, "high");
    assert.equal(createCall.args.p_owner_id, OWNER_ID);
    assert.equal(createCall.args.p_is_primary, true);
    assert.equal(createCall.args.p_duration_minutes, 15);
    assert.equal(result.leadId, LEAD_ID);
    assert.equal(result.id, ACTIVITY_ID);
  });

  test("reschedule / transfer / designate adapters use correct RPCs", async () => {
    const calls: string[] = [];
    const client = mockClient((fn, args) => {
      calls.push(fn);
      if (fn === "reschedule_lead_activity") {
        assert.equal(args.p_clear_reminder, true);
        assert.equal(args.p_activity_id, ACTIVITY_ID);
      }
      if (fn === "transfer_activity_ownership") {
        assert.equal(args.p_new_owner_id, OWNER_ID);
      }
      if (fn === "designate_primary_next_action") {
        assert.equal(args.p_activity_id, ACTIVITY_ID);
      }
      return sampleRow();
    });

    await callRescheduleLeadActivity(client, {
      activityId: ACTIVITY_ID,
      dueAt: FUTURE,
      reminderAt: null,
      clearReminder: true,
    });
    await callTransferActivityOwnership(client, {
      activityId: ACTIVITY_ID,
      newOwnerId: OWNER_ID,
    });
    await callDesignatePrimaryNextAction(client, { activityId: ACTIVITY_ID });

    assert.deepEqual(calls, [
      "reschedule_lead_activity",
      "transfer_activity_ownership",
      "designate_primary_next_action",
    ]);
  });

  test("complete adapter sends all 16 p_* keys and nulls irrelevant fields", async () => {
    let seenArgs: Record<string, unknown> | null = null;
    const client = mockClient((fn, args) => {
      assert.equal(fn, "complete_lead_activity");
      seenArgs = args;
      return sampleRow({ status: "completed", outcome_code: "connected" });
    });

    const input = normalizeCompleteLeadActivityInput({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NONE",
      whatsappSendIntentId: null,
    });

    await callCompleteLeadActivity(client, input);

    const requiredKeys = [
      "p_activity_id",
      "p_outcome_code",
      "p_completion_note",
      "p_resolution",
      "p_next_activity_type",
      "p_next_title",
      "p_next_due_at",
      "p_next_priority",
      "p_next_duration_minutes",
      "p_next_reminder_at",
      "p_next_quotation_id",
      "p_on_hold_reason",
      "p_on_hold_review_at",
      "p_closed_lost_reason",
      "p_closure_reason_code",
      "p_whatsapp_send_intent_id",
    ];
    assert.ok(seenArgs);
    const completeArgs = seenArgs as Record<string, unknown>;
    for (const key of requiredKeys) {
      assert.ok(key in completeArgs, `missing ${key}`);
    }
    assert.equal(completeArgs.p_resolution, "NONE");
    assert.equal(completeArgs.p_next_activity_type, null);
    assert.equal(completeArgs.p_on_hold_reason, null);
    assert.equal(completeArgs.p_closed_lost_reason, null);
    assert.notEqual(completeArgs.p_resolution, "CLOSED_WON");
  });

  test("complete NEXT_PRIMARY fills next fields only", () => {
    const args = completeInputToRpcArgs(
      normalizeCompleteLeadActivityInput({
        activityId: ACTIVITY_ID,
        outcomeCode: "connected",
        resolution: "NEXT_PRIMARY",
        nextActivityType: "call",
        nextTitle: "Next",
        nextDueAt: FUTURE,
        nextPriority: "normal",
      })
    );
    assert.equal(args.p_next_title, "Next");
    assert.equal(args.p_on_hold_reason, null);
    assert.equal(args.p_closed_lost_reason, null);
    assert.notEqual(args.p_resolution, "CLOSED_WON");
  });

  test("complete maps RPC error tokens", async () => {
    const client = mockClient(() => {
      throw new Error("WHATSAPP_SEND_EVIDENCE_REQUIRED");
    });
    await assert.rejects(
      () =>
        callCompleteLeadActivity(
          client,
          normalizeCompleteLeadActivityInput({
            activityId: ACTIVITY_ID,
            outcomeCode: "whatsapp_sent",
            resolution: "NONE",
            whatsappSendIntentId: null,
          })
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(
          (error as { code?: string }).code,
          "WHATSAPP_SEND_EVIDENCE_REQUIRED"
        );
        assert.notEqual(error.message, "WHATSAPP_SEND_EVIDENCE_REQUIRED");
        return true;
      }
    );
  });
});

describe("CRM 2A-4 service architecture (static)", () => {
  test("service uses canManageLeadFollowUps and createClient only", () => {
    const src = readFileSync(
      join(root, "src/features/crm/server/crm-activity-service.ts"),
      "utf8"
    );
    assert.match(src, /canManageLeadFollowUps/);
    assert.match(src, /createClient/);
    assert.doesNotMatch(src, /service_role/i);
    assert.doesNotMatch(src, /\.from\(["']lead_follow_ups["']\)\s*\.update/);
    assert.doesNotMatch(src, /\.from\(["']crm_sla_clocks["']\)/);
    assert.match(src, /listActivityOutcomeOptionsForCurrentUser/);
    assert.match(src, /lead_activity_outcome_codes/);
    assert.match(src, /is_active/);
    assert.match(src, /display_order/);
  });

  test("adapters never send CLOSED_WON resolution", () => {
    const src = readFileSync(
      join(root, "src/features/crm/server/crm-activity-adapters.ts"),
      "utf8"
    );
    assert.match(src, /CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE/);
    assert.doesNotMatch(src, /p_resolution:\s*["']CLOSED_WON["']/);
  });

  test("whatsapp contract accepts only send intent id", () => {
    const contracts = readFileSync(
      join(root, "src/features/crm/contracts/activity-contracts.ts"),
      "utf8"
    );
    assert.match(contracts, /whatsappSendIntentId/);
    assert.doesNotMatch(contracts, /providerTimestamp/);
    assert.doesNotMatch(contracts, /providerMessageId/);
    assert.doesNotMatch(contracts, /outboundMessageId/);
  });

  test("lead-detail repository selects enriched activity columns", () => {
    const src = readFileSync(
      join(root, "src/features/crm/server/crm-lead-repository.ts"),
      "utf8"
    );
    assert.match(src, /activity_type/);
    assert.match(src, /is_primary_next_action/);
    assert.match(src, /outcome_code/);
    assert.match(src, /completion_note/);
    assert.match(src, /quotation_id/);
    assert.match(src, /activityType: followUp\.activity_type/);
    assert.match(src, /isPrimaryNextAction: followUp\.is_primary_next_action/);
    assert.match(src, /createdAt: followUp\.created_at/);
    assert.match(src, /updatedAt: followUp\.updated_at/);
  });
});
