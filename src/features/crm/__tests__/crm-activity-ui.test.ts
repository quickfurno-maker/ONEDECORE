/**
 * CRM 2A-5 — activity UX tests (lead detail workspace).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  parseCompleteLeadActivityForm,
  parseCreateLeadActivityForm,
} from "../contracts/activity-contracts.ts";
import {
  filterOutcomeOptionsForActivityType,
  getCompletionResolutionOptions,
  getDefaultCompletionResolution,
} from "../components/activities/activity-ui-utils.ts";
import {
  appendAbsoluteTimestampsFromLocalFields,
  isValidDatetimeLocalValue,
  localDatetimeToIso,
} from "../lib/local-datetime-to-iso.ts";

const root = process.cwd();
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const ACTIVITY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEAD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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

describe("CRM 2A-5 create owner default", () => {
  test("create form default owner option is empty, not self", () => {
    const src = readSrc(
      "src/features/crm/components/activities/CreateActivityForm.tsx"
    );
    assert.match(src, /defaultValue=""/);
    assert.match(src, /<option value="">Assign to me<\/option>/);
    assert.doesNotMatch(src, /value="self"/);
    assert.doesNotMatch(src, /defaultValue="self"/);
  });

  test("empty ownerId passes strict create parser as null", () => {
    const parsed = parseCreateLeadActivityForm({
      leadId: LEAD_ID,
      activityType: "call",
      title: "Follow-up call",
      dueAt: FUTURE,
      priority: "normal",
      ownerId: "",
      isPrimary: "true",
      durationMinutes: "15",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.input.ownerId, null);
    }
  });

  test("selected owner UUID still parses", () => {
    const parsed = parseCreateLeadActivityForm({
      leadId: LEAD_ID,
      activityType: "call",
      title: "Follow-up call",
      dueAt: FUTURE,
      priority: "normal",
      ownerId: OWNER_UUID,
      isPrimary: "false",
      durationMinutes: "15",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.input.ownerId, OWNER_UUID);
    }
  });

  test("self string still fails strict parser (2A-4 unchanged)", () => {
    const parsed = parseCreateLeadActivityForm({
      leadId: LEAD_ID,
      activityType: "call",
      title: "Follow-up call",
      dueAt: FUTURE,
      ownerId: "self",
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.ok(parsed.fieldErrors.ownerId);
    }
  });
});

describe("CRM 2A-5 completion resolution matrix", () => {
  test("active primary has no NONE", () => {
    const options = getCompletionResolutionOptions({
      leadStatus: "contacted",
      isPrimary: true,
      hasOtherOpenPrimary: false,
    });
    assert.deepEqual(options, ["NEXT_PRIMARY", "ON_HOLD", "CLOSED_LOST"]);
    assert.equal(getDefaultCompletionResolution(options), "NEXT_PRIMARY");
  });

  test("active secondary + other primary has all four valid options", () => {
    const options = getCompletionResolutionOptions({
      leadStatus: "qualified",
      isPrimary: false,
      hasOtherOpenPrimary: true,
    });
    assert.deepEqual(options, [
      "NONE",
      "NEXT_PRIMARY",
      "ON_HOLD",
      "CLOSED_LOST",
    ]);
    assert.equal(getDefaultCompletionResolution(options), "NONE");
  });

  test("active secondary without primary has no NONE", () => {
    const options = getCompletionResolutionOptions({
      leadStatus: "assigned",
      isPrimary: false,
      hasOtherOpenPrimary: false,
    });
    assert.deepEqual(options, ["NEXT_PRIMARY", "ON_HOLD", "CLOSED_LOST"]);
    assert.equal(getDefaultCompletionResolution(options), "NEXT_PRIMARY");
  });

  test("terminal primary and secondary are NONE only", () => {
    for (const status of ["closed_won", "closed_lost"] as const) {
      for (const isPrimary of [true, false]) {
        const options = getCompletionResolutionOptions({
          leadStatus: status,
          isPrimary,
          hasOtherOpenPrimary: !isPrimary,
        });
        assert.deepEqual(options, ["NONE"]);
        assert.equal(getDefaultCompletionResolution(options), "NONE");
      }
    }
  });

  test("on_hold omits ON_HOLD resolution", () => {
    const primary = getCompletionResolutionOptions({
      leadStatus: "on_hold",
      isPrimary: true,
      hasOtherOpenPrimary: false,
    });
    assert.deepEqual(primary, ["NEXT_PRIMARY", "CLOSED_LOST"]);
    assert.equal(primary.includes("ON_HOLD"), false);

    const secondary = getCompletionResolutionOptions({
      leadStatus: "on_hold",
      isPrimary: false,
      hasOtherOpenPrimary: true,
    });
    assert.deepEqual(secondary, ["NONE", "NEXT_PRIMARY", "CLOSED_LOST"]);
  });

  test("CLOSED_WON absent from every matrix result", () => {
    const samples = [
      getCompletionResolutionOptions({
        leadStatus: "contacted",
        isPrimary: true,
        hasOtherOpenPrimary: false,
      }),
      getCompletionResolutionOptions({
        leadStatus: "contacted",
        isPrimary: false,
        hasOtherOpenPrimary: true,
      }),
      getCompletionResolutionOptions({
        leadStatus: "closed_lost",
        isPrimary: true,
        hasOtherOpenPrimary: false,
      }),
    ];
    for (const options of samples) {
      assert.equal(
        (options as readonly string[]).includes("CLOSED_WON"),
        false
      );
    }
  });
});

describe("CRM 2A-5 complete FormData / parser payloads", () => {
  test("NONE parses with no next / on-hold / closed-lost fields", () => {
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

  test("ON_HOLD parses with on-hold fields only", () => {
    const parsed = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "ON_HOLD",
      onHoldReason: "Customer travelling",
      onHoldReviewAt: FUTURE,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.input.resolution, "ON_HOLD");
    }
  });

  test("CLOSED_LOST parses with closed-lost fields only", () => {
    const parsed = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "CLOSED_LOST",
      closedLostReason: "Budget too low",
      closureReasonCode: "budget",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.input.resolution, "CLOSED_LOST");
    }
  });

  test("NEXT_PRIMARY parses with required next fields", () => {
    const parsed = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NEXT_PRIMARY",
      nextActivityType: "call",
      nextTitle: "Next call",
      nextDueAt: FUTURE,
      nextPriority: "normal",
      nextDurationMinutes: "15",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.input.resolution, "NEXT_PRIMARY");
    }
  });

  test("NONE with nextActivityType still fails cross-resolution guard", () => {
    const parsed = parseCompleteLeadActivityForm({
      activityId: ACTIVITY_ID,
      outcomeCode: "connected",
      resolution: "NONE",
      nextActivityType: "call",
    });
    assert.equal(parsed.success, false);
  });

  test("CLOSED_WON still rejected", () => {
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
    assert.deepEqual(
      callOutcomes.map((entry) => entry.code),
      ["connected", "general"]
    );
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

  test("lead-detail does not blindly catch all WhatsApp evidence errors", () => {
    const pageSrc = readSrc("src/app/admin/crm/leads/[leadId]/page.tsx");
    assert.doesNotMatch(
      pageSrc,
      /fetchGovernedWhatsappSendIntentsForLead\([^)]*\)\.catch\(\s*\(\)\s*=>\s*\[\]\s*\)/
    );
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

  test("complete dialog never offers CLOSED_WON and scopes next fields", () => {
    const src = readSrc(
      "src/features/crm/components/activities/CompleteActivityDialog.tsx"
    );
    assert.match(src, /completeLeadActivityAction/);
    assert.match(src, /getCompletionResolutionOptions/);
    assert.match(src, /name="nextActivityType"/);
    assert.match(src, /showNextPrimaryFields/);
    assert.doesNotMatch(src, /CLOSED_WON/);
    assert.match(src, /whatsappSendIntentId/);
    assert.match(src, /crm-closed-won-absent/);
    // nextActivityType must only appear inside the NEXT_PRIMARY branch, not as a global hidden.
    assert.doesNotMatch(
      src,
      /<input type="hidden" name="nextActivityType"/
    );
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
    const src = readSrc(
      "src/features/crm/components/activities/OpenActivityRow.tsx"
    );
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
    const src = readSrc(
      "src/features/crm/server/crm-whatsapp-evidence-queries.ts"
    );
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
    assert.match(workspace, /leadStatus=\{leadStatus\}/);
    assert.match(createForm, /w-full/);
    assert.match(createForm, /sm:grid-cols-2/);
  });
});
