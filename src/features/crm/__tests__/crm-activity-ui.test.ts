/**
 * CRM 2A-5 — activity UX tests (lead detail workspace).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { filterOutcomeOptionsForActivityType } from "../components/activities/activity-ui-utils.ts";
import {
  appendAbsoluteTimestampsFromLocalFields,
  isValidDatetimeLocalValue,
  localDatetimeToIso,
} from "../lib/local-datetime-to-iso.ts";

const root = process.cwd();

function readSrc(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("CRM 2A-5 local datetime boundary", () => {
  test("converts valid datetime-local to absolute ISO with Z", () => {
    const iso = localDatetimeToIso("2026-08-27T15:30");
    assert.ok(iso);
    assert.match(iso!, /Z$/);
    assert.doesNotMatch(iso!, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  test("rejects raw timezone-less strings without offset", () => {
    assert.equal(isValidDatetimeLocalValue("2026-08-27T15:30:00"), false);
    assert.equal(localDatetimeToIso("not-a-date"), null);
  });

  test("FormData mapping never leaves raw local values on absolute fields", () => {
    const formData = new FormData();
    formData.set("dueAtLocal", "2026-09-01T10:00");
    const ok = appendAbsoluteTimestampsFromLocalFields(formData, [
      { local: "dueAtLocal", absolute: "dueAt", required: true },
    ]);
    assert.equal(ok, true);
    assert.ok(formData.get("dueAt"));
    assert.match(String(formData.get("dueAt")), /Z$/);
    assert.equal(formData.get("dueAtLocal"), null);
  });
});

describe("CRM 2A-5 outcome filtering", () => {
  test("filters outcome catalogue by activity type", () => {
    const options = [
      {
        code: "connected",
        displayName: "Connected",
        activityTypes: ["call"],
        closesContactAttempt: true,
        displayOrder: 1,
      },
      {
        code: "whatsapp_sent",
        displayName: "WhatsApp sent",
        activityTypes: ["whatsapp"],
        closesContactAttempt: true,
        displayOrder: 2,
      },
      {
        code: "general",
        displayName: "General",
        activityTypes: [],
        closesContactAttempt: false,
        displayOrder: 3,
      },
    ] as const;

    const callOutcomes = filterOutcomeOptionsForActivityType(options, "call");
    assert.deepEqual(callOutcomes.map((entry) => entry.code), [
      "connected",
      "general",
    ]);
  });
});

describe("CRM 2A-5 lead detail architecture", () => {
  test("lead detail page wires activity workspace and 2A-4 fetches", () => {
    const pageSrc = readSrc("src/app/admin/crm/leads/[leadId]/page.tsx");
    assert.doesNotMatch(pageSrc, /"use client"/);
    assert.match(pageSrc, /LeadActivityWorkspace/);
    assert.match(pageSrc, /listActivityOutcomeOptionsForCurrentUser/);
    assert.match(pageSrc, /fetchGovernedWhatsappSendIntentsForLead/);
    assert.doesNotMatch(pageSrc, /LeadDetailFollowUps/);
    assert.match(pageSrc, /LeadStatusTransitionPanel/);
    assert.match(pageSrc, /LeadDetailAssignmentPanel/);
  });

  test("create form uses createLeadActivityAction not legacy follow-up action", () => {
    const src = readSrc(
      "src/features/crm/components/activities/CreateActivityForm.tsx"
    );
    assert.match(src, /createLeadActivityAction/);
    assert.match(src, /appendAbsoluteTimestampsFromLocalFields/);
    assert.match(src, /dueAtLocal/);
    assert.doesNotMatch(src, /createLeadFollowUpAction/);
    assert.doesNotMatch(src, /createClient/);
    assert.doesNotMatch(src, /\.from\(/);
  });

  test("complete dialog never offers CLOSED_WON resolution", () => {
    const src = readSrc(
      "src/features/crm/components/activities/CompleteActivityDialog.tsx"
    );
    assert.match(src, /completeLeadActivityAction/);
    assert.match(src, /NEXT_PRIMARY/);
    assert.match(src, /ON_HOLD/);
    assert.match(src, /CLOSED_LOST/);
    assert.doesNotMatch(src, /CLOSED_WON/);
    assert.match(src, /whatsappSendIntentId/);
    assert.match(src, /crm-closed-won-absent/);
  });

  test("primary card omits transfer and make-primary controls", () => {
    const primarySrc = readSrc(
      "src/features/crm/components/activities/PrimaryNextActionCard.tsx"
    );
    assert.match(primarySrc, /crm-primary-next-action-card/);
    assert.doesNotMatch(primarySrc, /Transfer/);
    assert.doesNotMatch(primarySrc, /Make Primary/);
    assert.match(primarySrc, /Complete/);
    assert.match(primarySrc, /Reschedule/);
  });

  test("secondary open row exposes Make Primary and conditional transfer", () => {
    const src = readSrc("src/features/crm/components/activities/OpenActivityRow.tsx");
    assert.match(src, /Make Primary/);
    assert.match(src, /designatePrimaryNextActionAction/);
    assert.match(src, /canTransfer/);
    assert.match(src, /Transfer Owner/);
  });

  test("reschedule dialog exposes keep, set, and clear reminder modes", () => {
    const src = readSrc(
      "src/features/crm/components/activities/RescheduleActivityDialog.tsx"
    );
    assert.match(src, /rescheduleLeadActivityAction/);
    assert.match(src, /Keep reminder unchanged/);
    assert.match(src, /Set reminder/);
    assert.match(src, /Clear reminder/);
    assert.match(src, /crm-reschedule-reminder-\$\{mode\}/);
    assert.match(src, /clearReminder/);
    assert.match(src, /appendAbsoluteTimestampsFromLocalFields/);
  });

  test("no-next-action banner renders risk CTA", () => {
    const src = readSrc(
      "src/features/crm/components/activities/NoNextActionBanner.tsx"
    );
    assert.match(src, /crm-no-next-action-banner/);
    assert.match(src, /Create next action/);
  });

  test("whatsapp evidence query reuses inbox tables without CRM migration", () => {
    const src = readSrc("src/features/crm/server/crm-whatsapp-evidence-queries.ts");
    assert.match(src, /whatsapp_conversations/);
    assert.match(src, /whatsapp_send_intents/);
    assert.match(src, /dispatch_bound/);
    assert.doesNotMatch(src, /service role/i);
  });

  test("workspace and forms use mobile-friendly layout classes", () => {
    const workspace = readSrc(
      "src/features/crm/components/activities/LeadActivityWorkspace.tsx"
    );
    const createForm = readSrc(
      "src/features/crm/components/activities/CreateActivityForm.tsx"
    );
    assert.match(workspace, /crm-activity-workspace/);
    assert.match(createForm, /w-full/);
    assert.match(createForm, /sm:grid-cols-2/);
  });
});
