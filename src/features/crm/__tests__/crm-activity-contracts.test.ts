/**
 * CRM 2A-4 — activity contract validation tests.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CRM_ACTIVITY_PRIORITIES,
  CRM_ACTIVITY_RESOLUTIONS,
  CRM_ACTIVITY_TYPES,
  normalizeCreateLeadActivityInput,
  normalizeRescheduleLeadActivityInput,
  normalizeTransferActivityOwnershipInput,
  normalizeDesignatePrimaryNextActionInput,
  normalizeCompleteLeadActivityInput,
  parseActivityType,
  parseActivityPriority,
  parseActivityResolution,
  parseBooleanFormValue,
  parseIntegerFormValue,
  parseIsoTimestamp,
  parseNullableUuid,
  parseRequiredUuid,
  validateCreateLeadActivityInput,
  validateRescheduleLeadActivityInput,
  validateTransferActivityOwnershipInput,
  validateDesignatePrimaryNextActionInput,
  validateCompleteLeadActivityInput,
} from "../contracts/activity-contracts.ts";
import { crmErrorFromPostgresMessage } from "../server/crm-errors.ts";

const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACTIVITY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();

describe("CRM 2A-4 activity enums", () => {
  test("activity types match DB domain", () => {
    assert.deepEqual([...CRM_ACTIVITY_TYPES], [
      "call",
      "whatsapp",
      "consultation",
      "site_visit",
      "quotation_follow_up",
      "internal_task",
    ]);
  });

  test("priorities match DB domain", () => {
    assert.deepEqual([...CRM_ACTIVITY_PRIORITIES], [
      "low",
      "normal",
      "high",
      "urgent",
    ]);
  });

  test("resolutions exclude CLOSED_WON", () => {
    assert.deepEqual([...CRM_ACTIVITY_RESOLUTIONS], [
      "NONE",
      "NEXT_PRIMARY",
      "ON_HOLD",
      "CLOSED_LOST",
    ]);
    assert.equal(parseActivityResolution("CLOSED_WON"), null);
    assert.equal(parseActivityResolution("closed_won"), null);
  });

  test("parsers accept valid type/priority", () => {
    assert.equal(parseActivityType("call"), "call");
    assert.equal(parseActivityType("CALL"), null);
    assert.equal(parseActivityPriority("urgent"), "urgent");
    assert.equal(parseActivityPriority("medium"), null);
  });
});

describe("CRM 2A-4 form parsers", () => {
  test("UUID parsing", () => {
    assert.equal(parseRequiredUuid(LEAD_ID), LEAD_ID);
    assert.equal(parseRequiredUuid("not-a-uuid"), null);
    assert.equal(parseNullableUuid(""), null);
    assert.equal(parseNullableUuid("null"), null);
    assert.equal(parseNullableUuid(OWNER_ID), OWNER_ID);
  });

  test("boolean / integer / ISO parsing", () => {
    assert.equal(parseBooleanFormValue("true"), true);
    assert.equal(parseBooleanFormValue("false"), false);
    assert.equal(parseBooleanFormValue("1"), true);
    assert.equal(parseBooleanFormValue("0"), false);
    assert.equal(parseBooleanFormValue("yes"), null);

    assert.equal(parseIntegerFormValue("30"), 30);
    assert.equal(parseIntegerFormValue("30.5"), null);
    assert.equal(parseIntegerFormValue("abc"), null);

    assert.equal(parseIsoTimestamp(FUTURE), FUTURE);
    assert.equal(parseIsoTimestamp("not-a-date"), null);
    assert.equal(parseIsoTimestamp("01/02/2026"), null);
  });
});

describe("CRM 2A-4 create validation", () => {
  test("accepts valid create input", () => {
    const input = normalizeCreateLeadActivityInput({
      leadId: LEAD_ID,
      activityType: "call",
      title: "  Call back  ",
      dueAt: FUTURE,
      priority: "high",
      ownerId: OWNER_ID,
      isPrimary: true,
      durationMinutes: 30,
      reminderAt: PAST,
      quotationId: null,
    });
    assert.equal(input.title, "Call back");
    assert.equal(validateCreateLeadActivityInput(input).length, 0);
  });

  test("rejects invalid title / duration / reminder / type", () => {
    const base = {
      leadId: LEAD_ID,
      activityType: "call" as const,
      title: "x",
      dueAt: FUTURE,
      priority: "normal" as const,
      ownerId: null,
      isPrimary: false,
      durationMinutes: null,
      reminderAt: null,
      quotationId: null,
    };

    assert.ok(
      validateCreateLeadActivityInput({ ...base, title: "" }).some(
        (e) => e.field === "title"
      )
    );
    assert.ok(
      validateCreateLeadActivityInput({
        ...base,
        title: "x".repeat(121),
      }).some((e) => e.field === "title")
    );
    assert.ok(
      validateCreateLeadActivityInput({ ...base, durationMinutes: 0 }).some(
        (e) => e.field === "durationMinutes"
      )
    );
    assert.ok(
      validateCreateLeadActivityInput({
        ...base,
        durationMinutes: 1441,
      }).some((e) => e.field === "durationMinutes")
    );
    assert.ok(
      validateCreateLeadActivityInput({
        ...base,
        reminderAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      }).some((e) => e.field === "reminderAt")
    );
  });

  test("create does not require future due (DB only requires non-null)", () => {
    const errors = validateCreateLeadActivityInput(
      normalizeCreateLeadActivityInput({
        leadId: LEAD_ID,
        activityType: "call",
        title: "Past due ok",
        dueAt: PAST,
        priority: "normal",
      })
    );
    assert.equal(errors.some((e) => e.field === "dueAt"), false);
  });
});

describe("CRM 2A-4 reschedule validation", () => {
  test("requires future due and distinct reminder modes", () => {
    assert.ok(
      validateRescheduleLeadActivityInput(
        normalizeRescheduleLeadActivityInput({
          activityId: ACTIVITY_ID,
          dueAt: PAST,
          clearReminder: false,
        })
      ).some((e) => e.field === "dueAt")
    );

    const unchanged = normalizeRescheduleLeadActivityInput({
      activityId: ACTIVITY_ID,
      dueAt: FUTURE,
      clearReminder: false,
    });
    assert.equal(unchanged.clearReminder, false);
    assert.equal(unchanged.reminderAt, null);
    assert.equal(validateRescheduleLeadActivityInput(unchanged).length, 0);

    const cleared = normalizeRescheduleLeadActivityInput({
      activityId: ACTIVITY_ID,
      dueAt: FUTURE,
      clearReminder: true,
      reminderAt: PAST,
    });
    assert.equal(cleared.clearReminder, true);
    assert.equal(cleared.reminderAt, null);

    const set = normalizeRescheduleLeadActivityInput({
      activityId: ACTIVITY_ID,
      dueAt: FUTURE,
      reminderAt: PAST,
      clearReminder: false,
    });
    assert.equal(set.reminderAt, PAST);
    assert.equal(validateRescheduleLeadActivityInput(set).length, 0);
  });
});

describe("CRM 2A-4 transfer / designate validation", () => {
  test("transfer requires activity and new owner UUIDs", () => {
    const ok = normalizeTransferActivityOwnershipInput({
      activityId: ACTIVITY_ID,
      newOwnerId: OWNER_ID,
    });
    assert.equal(validateTransferActivityOwnershipInput(ok).length, 0);
    assert.ok(
      validateTransferActivityOwnershipInput({
        activityId: "bad",
        newOwnerId: OWNER_ID,
      }).some((e) => e.field === "activityId")
    );
  });

  test("designate requires activity UUID", () => {
    assert.equal(
      validateDesignatePrimaryNextActionInput(
        normalizeDesignatePrimaryNextActionInput({ activityId: ACTIVITY_ID })
      ).length,
      0
    );
  });
});

describe("CRM 2A-4 complete discriminated union", () => {
  test("NONE accepts minimal payload", () => {
    const input = normalizeCompleteLeadActivityInput({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NONE",
    });
    assert.equal(input.resolution, "NONE");
    assert.equal(validateCompleteLeadActivityInput(input).length, 0);
  });

  test("CLOSED_WON cannot normalize", () => {
    assert.throws(() =>
      normalizeCompleteLeadActivityInput({
        activityId: ACTIVITY_ID,
        outcomeCode: "connected",
        resolution: "CLOSED_WON",
      })
    );
  });

  test("NEXT_PRIMARY requires next fields and future due", () => {
    const bad = normalizeCompleteLeadActivityInput({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NEXT_PRIMARY",
      nextActivityType: "call",
      nextTitle: "",
      nextDueAt: PAST,
    });
    const errors = validateCompleteLeadActivityInput(bad);
    assert.ok(errors.some((e) => e.field === "nextTitle"));
    assert.ok(errors.some((e) => e.field === "nextDueAt"));

    const good = normalizeCompleteLeadActivityInput({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NEXT_PRIMARY",
      nextActivityType: "call",
      nextTitle: "Next call",
      nextDueAt: FUTURE,
      nextPriority: "normal",
      nextDurationMinutes: 45,
    });
    assert.equal(validateCompleteLeadActivityInput(good).length, 0);
  });

  test("ON_HOLD requires reason and future review", () => {
    const bad = normalizeCompleteLeadActivityInput({
      activityId: ACTIVITY_ID,
      outcomeCode: "needs_manager",
      resolution: "ON_HOLD",
      onHoldReason: "",
      onHoldReviewAt: PAST,
    });
    const errors = validateCompleteLeadActivityInput(bad);
    assert.ok(errors.some((e) => e.field === "onHoldReason"));
    assert.ok(errors.some((e) => e.field === "onHoldReviewAt"));
  });

  test("CLOSED_LOST requires reason", () => {
    const bad = normalizeCompleteLeadActivityInput({
      activityId: ACTIVITY_ID,
      outcomeCode: "not_interested",
      resolution: "CLOSED_LOST",
      closedLostReason: "  ",
    });
    assert.ok(
      validateCompleteLeadActivityInput(bad).some(
        (e) => e.field === "closedLostReason"
      )
    );
  });

  test("completion note max 1000", () => {
    const input = normalizeCompleteLeadActivityInput({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NONE",
      completionNote: "x".repeat(1001),
    });
    assert.ok(
      validateCompleteLeadActivityInput(input).some(
        (e) => e.field === "completionNote"
      )
    );
  });
});

describe("CRM 2A-4 error mapping order", () => {
  const cases: Array<{ token: string; code: string; status: number }> = [
    { token: "ACTIVITY_NOT_FOUND", code: "ACTIVITY_NOT_FOUND", status: 404 },
    {
      token: "ACTIVITY_OWNER_NOT_AUTHORIZED",
      code: "ACTIVITY_OWNER_NOT_AUTHORIZED",
      status: 403,
    },
    { token: "ACTIVITY_NOT_OPEN", code: "ACTIVITY_NOT_OPEN", status: 422 },
    {
      token: "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE",
      code: "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE",
      status: 422,
    },
    {
      token: "WHATSAPP_SEND_EVIDENCE_REQUIRED",
      code: "WHATSAPP_SEND_EVIDENCE_REQUIRED",
      status: 422,
    },
    {
      token: "WHATSAPP_SEND_EVIDENCE_INVALID",
      code: "WHATSAPP_SEND_EVIDENCE_INVALID",
      status: 422,
    },
    { token: "NEXT_ACTION_REQUIRED", code: "NEXT_ACTION_REQUIRED", status: 422 },
    { token: "NEXT_PRIMARY_INVALID", code: "NEXT_PRIMARY_INVALID", status: 422 },
    {
      token: "ON_HOLD_REVIEW_REQUIRED",
      code: "ON_HOLD_REVIEW_REQUIRED",
      status: 422,
    },
    {
      token: "PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT",
      code: "PRIMARY_TRANSFER_REQUIRES_LEAD_REASSIGNMENT",
      status: 422,
    },
    {
      token: "ACTIVITY_TITLE_INVALID",
      code: "ACTIVITY_TITLE_INVALID",
      status: 422,
    },
    {
      token: "ACTIVITY_DUE_MUST_BE_FUTURE",
      code: "ACTIVITY_DUE_MUST_BE_FUTURE",
      status: 422,
    },
  ];

  for (const entry of cases) {
    test(`maps ${entry.token}`, () => {
      const error = crmErrorFromPostgresMessage(entry.token);
      assert.equal(error.code, entry.code);
      assert.equal(error.httpStatus, entry.status);
      assert.notEqual(error.message, entry.token);
      assert.doesNotMatch(error.message, /private\.|public\.|lead_follow_ups/i);
    });
  }

  test("ACTIVITY_NOT_FOUND is not swallowed by generic lead not found", () => {
    const error = crmErrorFromPostgresMessage("ACTIVITY_NOT_FOUND");
    assert.equal(error.code, "ACTIVITY_NOT_FOUND");
    assert.notEqual(error.code, "LEAD_NOT_FOUND");
    assert.notEqual(error.code, "FOLLOW_UP_NOT_FOUND");
  });
});
