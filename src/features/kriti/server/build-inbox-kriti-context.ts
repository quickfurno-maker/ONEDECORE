import "server-only";

import type { KritiContext } from "../contracts/context.ts";
import type { InboxConversationDetail } from "@/features/whatsapp/contracts/conversation-dtos.ts";
import { assembleKritiContext } from "../context/assemble-kriti-context.ts";
import { minimizeKritiContextForTask } from "../safety/pii-minimizer.ts";
import type { KritiTaskType } from "../contracts/task-types.ts";

export function buildInboxKritiContext(
  taskType: KritiTaskType,
  detail: InboxConversationDetail,
  staffRole: string,
  staffDisplayName: string | null
): KritiContext {
  const raw: KritiContext = {
    taskType,
    trustedPolicy: {
      brandName: "ONEDECORE",
      assistanceScope: "staff_assist_only",
      prohibitedActions: [
        "auto_send",
        "assign_lead",
        "mutate_consent",
        "change_price",
        "execute_tools",
      ],
    },
    authorizedBusiness: {
      leadReference: detail.leadId,
      conversationReference: detail.id,
      quotationReference: null,
      projectReference: null,
      staffRole,
      staffDisplayName: staffDisplayName,
    },
    untrustedCustomer: {
      messages: detail.messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        body: message.bodyText ?? "",
        sentAt: message.providerTimestamp,
      })),
      notes: [],
    },
    supplementalFacts: detail.isLinked
      ? [`Linked lead: ${detail.linkedLeadName ?? "unknown"}`]
      : ["Unlinked triage conversation"],
  };

  const minimized = minimizeKritiContextForTask(raw);
  return assembleKritiContext(minimized);
}
