/**
 * Phase 6C formal — task availability, inbox context assembly, error contracts.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { InboxConversationDetail } from "@/features/whatsapp/contracts/conversation-dtos.ts";
import { KRITI_ERROR_CODES } from "../contracts/errors.ts";
import { buildInboxKritiContext } from "../server/build-inbox-kriti-context.ts";
import { resolveInboxKritiTaskAvailability } from "../server/kriti-audit-and-availability.ts";

function sampleConversationDetail(): InboxConversationDetail {
  return {
    id: "c1111111-1111-1111-1111-111111111111",
    customerE164: "+919876543210",
    displayNameSnapshot: "Sample Lead",
    leadId: "l1111111-1111-1111-1111-111111111111",
    contactId: null,
    lastMessageAt: "2026-08-08T10:00:00Z",
    lastInboundAt: "2026-08-08T10:00:00Z",
    previewText: "Need pricing",
    isLinked: true,
    linkedLeadName: "Sample Lead",
    linkedLeadAssignedTo: null,
    messagePage: 1,
    messagePageSize: 20,
    messageTotalCount: 1,
    messages: [
      {
        id: "m1",
        direction: "inbound",
        normalizedMessageType: "text",
        bodyText: "Need pricing for modular kitchen",
        providerTimestamp: "2026-08-08T10:00:00Z",
        latestStatus: null,
      },
    ],
  };
}

describe("Phase 6C formal runtime", () => {
  test("availability marks inbox tasks available when authorized and provider enabled", () => {
    const entries = resolveInboxKritiTaskAvailability(true, false);
    const activatable = entries.filter((entry) =>
      [
        "conversation_summary",
        "missing_information",
        "objection_suggestions",
        "next_action_suggestions",
        "service_reply_draft",
      ].includes(entry.taskType)
    );
    assert.equal(activatable.length, 5);
    assert.ok(activatable.every((entry) => entry.status === "available"));
  });

  test("availability is disabled when provider mode is disabled", () => {
    const entries = resolveInboxKritiTaskAvailability(true, true);
    const inboxTasks = entries.filter((entry) => entry.taskType === "service_reply_draft");
    assert.equal(inboxTasks[0]?.status, "disabled");
  });

  test("availability is unauthorized without conversation read scope", () => {
    const entries = resolveInboxKritiTaskAvailability(false, false);
    const inboxTasks = entries.filter((entry) => entry.taskType === "service_reply_draft");
    assert.equal(inboxTasks[0]?.status, "unauthorized");
  });

  test("future dependency tasks remain unavailable_dependency", () => {
    const entries = resolveInboxKritiTaskAvailability(true, false);
    const future = entries.find((entry) => entry.taskType === "quotation_wording_draft");
    assert.equal(future?.status, "unavailable_dependency");
  });

  test("inbox context assembly bounds and minimizes customer content", () => {
    const context = buildInboxKritiContext(
      "service_reply_draft",
      sampleConversationDetail(),
      "sales_executive",
      "staff@example.test"
    );
    assert.equal(context.taskType, "service_reply_draft");
    assert.equal(context.authorizedBusiness.conversationReference, "c1111111-1111-1111-1111-111111111111");
    assert.equal(context.untrustedCustomer.messages.length, 1);
    assert.match(context.untrustedCustomer.messages[0]?.body ?? "", /modular kitchen/);
  });

  test("KRITI_UNAVAILABLE is a frozen error code", () => {
    assert.equal(KRITI_ERROR_CODES.includes("KRITI_UNAVAILABLE"), true);
  });
});
