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
  parseCreateLeadActivityForm,
  parseRescheduleLeadActivityForm,
  parseCompleteLeadActivityForm,
  validateCreateLeadActivityInput,
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
      "CADENCE_NEXT",
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
    assert.equal(parseIsoTimestamp("2026-08-27T10:00"), null);
    assert.equal(parseIsoTimestamp("2026-08-27T10:00:00"), null);
    assert.equal(parseIsoTimestamp("2026-08-27"), null);
    assert.equal(parseIsoTimestamp("2026-08-27T10:00:00Z"), "2026-08-27T10:00:00.000Z");
    assert.equal(
      parseIsoTimestamp("2026-08-27T10:00:00+05:30"),
      "2026-08-27T04:30:00.000Z"
    );
    assert.equal(parseIsoTimestamp("2026-08-27T10:00:00+99:99"), null);
  });
});

describe("CRM 2A-4 create validation", () => {
  test("accepts valid create input", () => {
    const parsed = parseCreateLeadActivityForm({
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
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.input.title, "Call back");
    }
  });

  test("omitted priority defaults to normal and omitted isPrimary defaults false", () => {
    const parsed = parseCreateLeadActivityForm({
      leadId: LEAD_ID,
      activityType: "call",
      title: "Call",
      dueAt: FUTURE,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.input.priority, "normal");
      assert.equal(parsed.input.isPrimary, false);
      assert.equal(parsed.input.ownerId, null);
      assert.equal(parsed.input.durationMinutes, null);
      assert.equal(parsed.input.reminderAt, null);
      assert.equal(parsed.input.quotationId, null);
    }
  });

  test("rejects malformed explicit create fields instead of coercing", () => {
    const base = {
      leadId: LEAD_ID,
      title: "Call",
      dueAt: FUTURE,
    };

    const activityType = parseCreateLeadActivityForm({
      ...base,
      activityType: "CALL",
    });
    assert.equal(activityType.success, false);
    if (!activityType.success) {
      assert.equal(activityType.code, "VALIDATION_FAILED");
      assert.ok(activityType.fieldErrors.activityType);
    }

    const priority = parseCreateLeadActivityForm({
      ...base,
      activityType: "call",
      priority: "medium",
    });
    assert.equal(priority.success, false);
    if (!priority.success) {
      assert.ok(priority.fieldErrors.priority);
    }

    const isPrimary = parseCreateLeadActivityForm({
      ...base,
      activityType: "call",
      isPrimary: "yes",
    });
    assert.equal(isPrimary.success, false);
    if (!isPrimary.success) {
      assert.ok(isPrimary.fieldErrors.isPrimary);
    }

    const duration = parseCreateLeadActivityForm({
      ...base,
      activityType: "call",
      durationMinutes: "abc",
    });
    assert.equal(duration.success, false);
    if (!duration.success) {
      assert.ok(duration.fieldErrors.durationMinutes);
    }

    const ownerId = parseCreateLeadActivityForm({
      ...base,
      activityType: "call",
      ownerId: "bad",
    });
    assert.equal(ownerId.success, false);
    if (!ownerId.success) {
      assert.ok(ownerId.fieldErrors.ownerId);
    }

    const quotationId = parseCreateLeadActivityForm({
      ...base,
      activityType: "call",
      quotationId: "bad",
    });
    assert.equal(quotationId.success, false);
    if (!quotationId.success) {
      assert.ok(quotationId.fieldErrors.quotationId);
    }

    const reminderAt = parseCreateLeadActivityForm({
      ...base,
      activityType: "call",
      reminderAt: "bad",
    });
    assert.equal(reminderAt.success, false);
    if (!reminderAt.success) {
      assert.ok(reminderAt.fieldErrors.reminderAt);
    }
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
    const pastDue = parseRescheduleLeadActivityForm({
      activityId: ACTIVITY_ID,
      dueAt: PAST,
      clearReminder: false,
    });
    assert.equal(pastDue.success, false);
    if (!pastDue.success) {
      assert.ok(pastDue.fieldErrors.dueAt);
    }

    const unchanged = parseRescheduleLeadActivityForm({
      activityId: ACTIVITY_ID,
      dueAt: FUTURE,
      clearReminder: false,
    });
    assert.equal(unchanged.success, true);
    if (unchanged.success) {
      assert.equal(unchanged.input.clearReminder, false);
      assert.equal(unchanged.input.reminderAt, null);
    }

    const cleared = parseRescheduleLeadActivityForm({
      activityId: ACTIVITY_ID,
      dueAt: FUTURE,
      clearReminder: true,
      reminderAt: PAST,
    });
    assert.equal(cleared.success, true);
    if (cleared.success) {
      assert.equal(cleared.input.clearReminder, true);
      assert.equal(cleared.input.reminderAt, null);
    }

    const set = parseRescheduleLeadActivityForm({
      activityId: ACTIVITY_ID,
      dueAt: FUTURE,
      reminderAt: PAST,
      clearReminder: false,
    });
    assert.equal(set.success, true);
    if (set.success) {
      assert.equal(set.input.reminderAt, PAST);
    }
  });

  test("rejects malformed explicit reschedule fields", () => {
    const clearReminder = parseRescheduleLeadActivityForm({
      activityId: ACTIVITY_ID,
      dueAt: FUTURE,
      clearReminder: "yes",
    });
    assert.equal(clearReminder.success, false);
    if (!clearReminder.success) {
      assert.ok(clearReminder.fieldErrors.clearReminder);
    }

    const reminderAt = parseRescheduleLeadActivityForm({
      activityId: ACTIVITY_ID,
      dueAt: FUTURE,
      reminderAt: "bad",
      clearReminder: false,
    });
    assert.equal(reminderAt.success, false);
    if (!reminderAt.success) {
      assert.ok(reminderAt.fieldErrors.reminderAt);
    }
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
    const parsed = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NONE",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.input.resolution, "NONE");
    }
  });

  test("CLOSED_WON returns dedicated business code", () => {
    const parsed = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "CLOSED_WON",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.code, "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE");
    }
  });

  test("unknown resolution is VALIDATION_FAILED on resolution", () => {
    const parsed = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "garbage",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.code, "VALIDATION_FAILED");
      assert.ok(parsed.fieldErrors.resolution);
    }
  });

  test("rejects cross-resolution payload fields", () => {
    const noneWithNext = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NONE",
      nextTitle: "Follow up",
    });
    assert.equal(noneWithNext.success, false);
    if (!noneWithNext.success) {
      assert.ok(noneWithNext.fieldErrors.resolution);
    }

    const nextWithOnHold = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NEXT_PRIMARY",
      nextActivityType: "call",
      nextTitle: "Next",
      nextDueAt: FUTURE,
      onHoldReason: "Waiting",
    });
    assert.equal(nextWithOnHold.success, false);
    if (!nextWithOnHold.success) {
      assert.ok(nextWithOnHold.fieldErrors.resolution);
    }

    const onHoldWithClosedLost = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "needs_manager",
      resolution: "ON_HOLD",
      onHoldReason: "Budget",
      onHoldReviewAt: FUTURE,
      closedLostReason: "No budget",
    });
    assert.equal(onHoldWithClosedLost.success, false);
    if (!onHoldWithClosedLost.success) {
      assert.ok(onHoldWithClosedLost.fieldErrors.resolution);
    }

    const closedLostWithNext = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "not_interested",
      resolution: "CLOSED_LOST",
      closedLostReason: "No budget",
      nextDueAt: FUTURE,
    });
    assert.equal(closedLostWithNext.success, false);
    if (!closedLostWithNext.success) {
      assert.ok(closedLostWithNext.fieldErrors.resolution);
    }
  });

  test("rejects malformed explicit complete/next fields", () => {
    const whatsapp = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NONE",
      whatsappSendIntentId: "bad",
    });
    assert.equal(whatsapp.success, false);
    if (!whatsapp.success) {
      assert.ok(whatsapp.fieldErrors.whatsappSendIntentId);
    }

    const nextBase = {
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NEXT_PRIMARY" as const,
      nextTitle: "Next",
      nextDueAt: FUTURE,
    };

    const nextActivityType = parseCompleteLeadActivityForm({
      ...nextBase,
      nextActivityType: "CALL",
    });
    assert.equal(nextActivityType.success, false);
    if (!nextActivityType.success) {
      assert.ok(nextActivityType.fieldErrors.nextActivityType);
    }

    const nextPriority = parseCompleteLeadActivityForm({
      ...nextBase,
      nextActivityType: "call",
      nextPriority: "medium",
    });
    assert.equal(nextPriority.success, false);
    if (!nextPriority.success) {
      assert.ok(nextPriority.fieldErrors.nextPriority);
    }

    const nextDuration = parseCompleteLeadActivityForm({
      ...nextBase,
      nextActivityType: "call",
      nextDurationMinutes: "abc",
    });
    assert.equal(nextDuration.success, false);
    if (!nextDuration.success) {
      assert.ok(nextDuration.fieldErrors.nextDurationMinutes);
    }

    const nextQuotationId = parseCompleteLeadActivityForm({
      ...nextBase,
      nextActivityType: "call",
      nextQuotationId: "bad",
    });
    assert.equal(nextQuotationId.success, false);
    if (!nextQuotationId.success) {
      assert.ok(nextQuotationId.fieldErrors.nextQuotationId);
    }

    const nextReminderAt = parseCompleteLeadActivityForm({
      ...nextBase,
      nextActivityType: "call",
      nextReminderAt: "bad",
    });
    assert.equal(nextReminderAt.success, false);
    if (!nextReminderAt.success) {
      assert.ok(nextReminderAt.fieldErrors.nextReminderAt);
    }
  });

  test("NEXT_PRIMARY requires next fields and future due", () => {
    const bad = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NEXT_PRIMARY",
      nextActivityType: "call",
      nextTitle: "",
      nextDueAt: PAST,
    });
    assert.equal(bad.success, false);
    if (!bad.success) {
      assert.ok(bad.fieldErrors.nextTitle);
      assert.ok(bad.fieldErrors.nextDueAt);
    }

    const good = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NEXT_PRIMARY",
      nextActivityType: "call",
      nextTitle: "Next call",
      nextDueAt: FUTURE,
      nextPriority: "normal",
      nextDurationMinutes: 45,
    });
    assert.equal(good.success, true);
  });

  test("ON_HOLD requires reason and future review", () => {
    const bad = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "needs_manager",
      resolution: "ON_HOLD",
      onHoldReason: "",
      onHoldReviewAt: PAST,
    });
    assert.equal(bad.success, false);
    if (!bad.success) {
      assert.ok(bad.fieldErrors.onHoldReason);
      assert.ok(bad.fieldErrors.onHoldReviewAt);
    }
  });

  test("CLOSED_LOST requires reason", () => {
    const bad = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "not_interested",
      resolution: "CLOSED_LOST",
      closedLostReason: "  ",
    });
    assert.equal(bad.success, false);
    if (!bad.success) {
      assert.ok(bad.fieldErrors.closedLostReason);
    }
  });

  test("completion note max 1000", () => {
    const parsed = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NONE",
      completionNote: "x".repeat(1001),
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.ok(parsed.fieldErrors.completionNote);
    }
  });

  test("legacy normalize still builds typed complete payloads for service callers", () => {
    const input = normalizeCompleteLeadActivityInput({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NEXT_PRIMARY",
      nextActivityType: "call",
      nextTitle: "Next call",
      nextDueAt: FUTURE,
      nextPriority: "normal",
      nextDurationMinutes: 45,
    });
    assert.equal(validateCompleteLeadActivityInput(input).length, 0);
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
