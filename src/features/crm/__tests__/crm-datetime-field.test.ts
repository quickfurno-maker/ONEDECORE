/**
 * CRM date/time field — contract-preserving picker wiring.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("CrmDateTimeField wiring", () => {
  test("picker component exists without third-party calendar dependency", () => {
    const src = readSrc(
      "src/features/crm/components/ui/CrmDateTimeField.tsx"
    );
    assert.match(src, /CrmDateTimeField/);
    assert.match(src, /role="dialog"/);
    assert.match(src, /Previous month/);
    assert.match(src, /Next month/);
    assert.match(src, /type="hidden"/);
    assert.doesNotMatch(src, /react-day-picker|@radix-ui\/react-calendar|flatpickr/i);
  });

  test("create activity form uses CrmDateTimeField and keeps dueAtLocal contract", () => {
    const src = readSrc(
      "src/features/crm/components/activities/CreateActivityForm.tsx"
    );
    assert.match(src, /CrmDateTimeField/);
    assert.match(src, /dueAtLocal/);
    assert.match(src, /reminderAtLocal/);
    assert.match(src, /appendAbsoluteTimestampsFromLocalFields/);
    assert.doesNotMatch(src, /type="datetime-local"/);
  });

  test("reschedule and complete dialogs reuse the premium picker", () => {
    const reschedule = readSrc(
      "src/features/crm/components/activities/RescheduleActivityDialog.tsx"
    );
    const complete = readSrc(
      "src/features/crm/components/activities/CompleteActivityDialog.tsx"
    );
    assert.match(reschedule, /CrmDateTimeField/);
    assert.match(reschedule, /dueAtLocal/);
    assert.match(complete, /CrmDateTimeField/);
    assert.match(complete, /nextDueAtLocal/);
    assert.match(complete, /onHoldReviewAtLocal/);
  });
});
