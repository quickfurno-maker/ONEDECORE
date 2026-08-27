/**
 * CRM 2A-4 — activity server action tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  INITIAL_CRM_ACTIVITY_ACTION_STATE,
  parseCompleteLeadActivityForm,
  parseCreateLeadActivityForm,
  parseRescheduleLeadActivityForm,
} from "../contracts/activity-contracts.ts";
import { crmErrorFromPostgresMessage } from "../server/crm-errors.ts";

const root = process.cwd();
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const ACTIVITY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function assertAsyncOnlyServerActions(
  relativePath: string,
  expectedActions: string[]
) {
  const actionsSrc = readFileSync(join(root, relativePath), "utf8");
  assert.match(actionsSrc, /"use server"/);
  assert.doesNotMatch(actionsSrc, /export\s*\{/);
  const runtimeValueExports = [
    ...actionsSrc.matchAll(
      /export\s+(?:const|let|var|class|enum|type(?!\s+\w+\s*=)|function(?!\s+async))\s+/g
    ),
  ];
  assert.equal(runtimeValueExports.length, 0);
  const asyncActionExports =
    actionsSrc.match(/export\s+async\s+function\s+(\w+)/g) ?? [];
  assert.deepEqual(
    new Set(
      asyncActionExports.map((entry) =>
        entry.replace(/export\s+async\s+function\s+/, "")
      )
    ),
    new Set(expectedActions)
  );
}

describe("CRM 2A-4 activity actions (static architecture)", () => {
  test("exports the five mutation actions only as async server functions", () => {
    assertAsyncOnlyServerActions(
      "src/features/crm/server/crm-activity-actions.ts",
      [
        "createLeadActivityAction",
        "rescheduleLeadActivityAction",
        "transferActivityOwnershipAction",
        "designatePrimaryNextActionAction",
        "completeLeadActivityAction",
      ]
    );
  });

  test("revalidates authoritative lead paths only", () => {
    const src = readFileSync(
      join(root, "src/features/crm/server/crm-activity-actions.ts"),
      "utf8"
    );
    assert.match(src, /revalidatePath\("\/admin\/crm\/leads"\)/);
    assert.match(
      src,
      /revalidatePath\(`\/admin\/crm\/leads\/\$\{leadId\}`\)/
    );
    assert.match(src, /revalidateActivityPaths\(result\.leadId\)/);
    assert.doesNotMatch(src, /\/admin\/crm\/my-day/);
  });

  test("stable success messages and CrmError mapping path", () => {
    const src = readFileSync(
      join(root, "src/features/crm/server/crm-activity-actions.ts"),
      "utf8"
    );
    assert.match(src, /Activity created\./);
    assert.match(src, /Activity rescheduled\./);
    assert.match(src, /Activity owner updated\./);
    assert.match(src, /Primary next action updated\./);
    assert.match(src, /Activity completed\./);
    assert.match(src, /Activity completed and lead placed on hold\./);
    assert.match(src, /Activity completed and lead closed lost\./);
    assert.match(src, /toActivityActionState/);
    assert.match(src, /VALIDATION_FAILED/);
    assert.match(src, /RPC_FAILED/);
    assert.match(src, /crmErrorFromPostgresMessage/);
  });

  test("initial action state is failure-safe", () => {
    assert.equal(INITIAL_CRM_ACTIVITY_ACTION_STATE.success, false);
    assert.equal(INITIAL_CRM_ACTIVITY_ACTION_STATE.message, "");
  });

  test("CLOSED_WON form resolution maps to dedicated safe error", () => {
    const parsed = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "CLOSED_WON",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.code, "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE");
    }
    const mapped = crmErrorFromPostgresMessage(
      "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE"
    );
    assert.equal(mapped.code, "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE");
    assert.doesNotMatch(mapped.message, /CLOSED_WON_REQUIRES/);
    assert.match(mapped.message, /Closed Won/i);
  });

  test("create FormData-shaped input yields deterministic fieldErrors", () => {
    const parsed = parseCreateLeadActivityForm({
      leadId: "not-a-uuid",
      activityType: "call",
      title: "Call",
      dueAt: FUTURE,
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.code, "VALIDATION_FAILED");
      assert.ok(parsed.fieldErrors.leadId);
    }
  });

  test("malformed ownerId fails validation without reaching service layer", () => {
    const parsed = parseCreateLeadActivityForm({
      leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      activityType: "call",
      title: "Call",
      dueAt: FUTURE,
      ownerId: "bad",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.ok(parsed.fieldErrors.ownerId);
    }
  });

  test("reschedule FormData-shaped input requires future due", () => {
    const parsed = parseRescheduleLeadActivityForm({
      activityId: ACTIVITY_ID,
      dueAt: new Date(Date.now() - 60_000).toISOString(),
      clearReminder: "false",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.ok(parsed.fieldErrors.dueAt);
    }
  });

  test("action module uses strict form parsers before service calls", () => {
    const src = readFileSync(
      join(root, "src/features/crm/server/crm-activity-actions.ts"),
      "utf8"
    );
    assert.match(src, /parseCreateLeadActivityForm/);
    assert.match(src, /parseRescheduleLeadActivityForm/);
    assert.match(src, /parseCompleteLeadActivityForm/);
    assert.match(src, /if \(!parsed\.success\)/);
    assert.match(
      src,
      /const result = await createLeadActivityForCurrentUser\(parsed\.input\);/
    );
    assert.match(
      src,
      /const result = await rescheduleLeadActivityForCurrentUser\(parsed\.input\);/
    );
    assert.match(
      src,
      /const result = await completeLeadActivityForCurrentUser\(parsed\.input\);/
    );
    assert.doesNotMatch(src, /normalizeCreateLeadActivityInput/);
    assert.doesNotMatch(src, /normalizeRescheduleLeadActivityInput/);
    assert.doesNotMatch(src, /normalizeCompleteLeadActivityInput/);
  });

  test("action module maps CLOSED_WON parse code via crmErrorFromPostgresMessage", () => {
    const src = readFileSync(
      join(root, "src/features/crm/server/crm-activity-actions.ts"),
      "utf8"
    );
    assert.match(src, /CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE/);
    assert.match(src, /parseCompleteLeadActivityForm/);
  });
});

describe("CRM 2A-4 containment", () => {
  test("package.json test:app includes the three new CRM 2A-4 tests", () => {
    const pkg = readFileSync(join(root, "package.json"), "utf8");
    assert.match(pkg, /crm-activity-contracts\.test\.ts/);
    assert.match(pkg, /crm-activity-service\.test\.ts/);
    assert.match(pkg, /crm-activity-actions\.test\.ts/);
  });
});
