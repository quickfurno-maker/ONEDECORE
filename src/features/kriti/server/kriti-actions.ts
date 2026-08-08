"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { KritiRequest } from "../contracts/context.ts";
import type { KritiResult } from "../contracts/result.ts";
import { isKritiTaskType } from "../contracts/task-types.ts";
import { getKritiServerEnv } from "./kriti-env.ts";
import { buildInboxKritiContext } from "./build-inbox-kriti-context.ts";
import {
  createSupabaseKritiAuditSink,
  resolveInboxKritiTaskAvailability,
  type KritiTaskAvailabilityEntry,
} from "./kriti-audit-and-availability.ts";
import { runKritiTask } from "./run-kriti-task.ts";
import { buildKritiPrompts } from "../safety/build-kriti-prompts.ts";
import { getWhatsappInboxAccessContext } from "@/features/whatsapp/server/whatsapp-auth.ts";
import { canCurrentUserAccessConversation } from "@/features/whatsapp/server/whatsapp-inbox-queries.ts";
import { getInboxConversationDetailForCurrentUser } from "@/features/whatsapp/server/whatsapp-inbox-repository.ts";
import { parseInboxMessageListQuery } from "@/features/whatsapp/contracts/inbox-list-query.ts";
import { createKritiInferenceProvider } from "./create-kriti-provider.ts";
import { createKritiError } from "../contracts/errors.ts";

export async function getInboxKritiAvailabilityAction(
  conversationId: string
): Promise<{
  readonly providerMode: string;
  readonly tasks: readonly KritiTaskAvailabilityEntry[];
}> {
  const env = getKritiServerEnv();
  const canRead = await canCurrentUserAccessConversation(conversationId, "read");
  return {
    providerMode: env.mode,
    tasks: resolveInboxKritiTaskAvailability(canRead, env.mode === "disabled"),
  };
}

export async function runInboxKritiTaskAction(input: {
  readonly conversationId: string;
  readonly taskType: string;
}): Promise<KritiResult> {
  if (!isKritiTaskType(input.taskType)) {
    return {
      ok: false,
      requestId: randomUUID(),
      error: createKritiError("KRITI_INVALID_OUTPUT", "Unsupported Kriti task.", false),
    };
  }

  const access = await getWhatsappInboxAccessContext();
  if (!access?.canRead) {
    return {
      ok: false,
      requestId: randomUUID(),
      error: createKritiError("KRITI_UNAVAILABLE", "Authentication required.", false),
    };
  }

  const canRead = await canCurrentUserAccessConversation(input.conversationId, "read");
  if (!canRead) {
    return {
      ok: false,
      requestId: randomUUID(),
      error: createKritiError(
        "KRITI_UNAVAILABLE",
        "Conversation outside authorized scope.",
        false
      ),
    };
  }

  const availability = resolveInboxKritiTaskAvailability(
    canRead,
    getKritiServerEnv().mode === "disabled"
  );
  const taskEntry = availability.find((entry) => entry.taskType === input.taskType);
  if (!taskEntry || taskEntry.status !== "available") {
    return {
      ok: false,
      requestId: randomUUID(),
      error: createKritiError(
        "KRITI_UNAVAILABLE",
        taskEntry?.reason ?? "Task unavailable.",
        false
      ),
    };
  }

  const messageQuery = parseInboxMessageListQuery(input.conversationId, {});
  const detail = await getInboxConversationDetailForCurrentUser(
    input.conversationId,
    messageQuery
  );
  if (!detail) {
    return {
      ok: false,
      requestId: randomUUID(),
      error: createKritiError("KRITI_UNAVAILABLE", "Conversation not found.", false),
    };
  }

  const requestId = randomUUID();
  const context = buildInboxKritiContext(
    input.taskType,
    detail,
    access.canManage ? "sales_manager" : "sales_executive",
    access.email
  );
  const request: KritiRequest = {
    requestId,
    taskType: input.taskType,
    requestedAt: new Date().toISOString(),
    context,
  };

  const env = getKritiServerEnv();
  const supabase = await createClient();
  const auditSink = createSupabaseKritiAuditSink({
    supabase,
    providerMode: env.mode,
    providerCode: env.mode === "local-test" ? "fake" : env.mode === "enabled" ? "groq" : null,
    modelName: env.groqModel,
    targetType: "whatsapp_conversation",
    targetId: input.conversationId,
    contextProvenance: {
      sources: ["whatsapp_messages"],
      message_count: detail.messages.length,
      truncated: detail.messages.length >= 20,
    },
  });

  return runKritiTask(request, {
    env,
    provider: createKritiInferenceProvider(env),
    buildPrompts: buildKritiPrompts,
    auditSink,
  });
}

export async function recordKritiHumanUseAction(input: {
  readonly requestId: string;
  readonly action: "copy" | "insert_draft" | "dismiss" | "retry";
}): Promise<{ readonly ok: boolean; readonly message?: string }> {
  const supabase = await createClient();
  const eventType =
    input.action === "dismiss"
      ? "kriti.dismiss"
      : input.action === "retry"
        ? "kriti.retry"
        : "kriti.human_use";

  const details =
    eventType === "kriti.human_use"
      ? { action: input.action === "copy" ? "copy" : "insert_draft" }
      : {};

  const { error } = await supabase.rpc("append_kriti_audit_event", {
    p_run_id: input.requestId,
    p_event_type: eventType,
    p_details: details,
  });

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
