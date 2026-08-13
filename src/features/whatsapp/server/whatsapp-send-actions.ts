"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { WHATSAPP_SERVICE_PURPOSE_CODE } from "../contracts/inbox-permissions.ts";
import {
  INITIAL_WHATSAPP_SEND_ACTION_STATE,
  type WhatsappSendActionState,
} from "../contracts/send-action-state.ts";
import {
  normalizeWhatsappSendBody,
  rejectMarketingPurpose,
} from "./send-intent-normalization.ts";
import { getWhatsappInboxAccessContext } from "./whatsapp-auth.ts";
import {
  WhatsappInboxError,
  whatsappInboxErrorFromPostgresMessage,
} from "./whatsapp-inbox-errors.ts";
import { canCurrentUserAccessConversation } from "./whatsapp-inbox-queries.ts";
import { dispatchWhatsappSendIntent } from "./whatsapp-dispatch-service.ts";
import { getWhatsappOutboundMode } from "./whatsapp-outbound-env.ts";

function toSendActionState(error: unknown): WhatsappSendActionState {
  if (error instanceof WhatsappInboxError) {
    return {
      success: false,
      message: error.message,
      code: error.code,
    };
  }

  const mapped = whatsappInboxErrorFromPostgresMessage(
    error instanceof Error ? error.message : "Send intent request failed"
  );
  return {
    success: false,
    message: mapped.message,
    code: mapped.code,
  };
}

export async function createWhatsappServiceSendIntentAction(
  _previousState: WhatsappSendActionState,
  formData: FormData
): Promise<WhatsappSendActionState> {
  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();
  const bodyText = String(formData.get("bodyText") ?? "");

  if (!conversationId || !idempotencyKey) {
    return {
      success: false,
      message: "Missing conversation or idempotency key.",
      code: "VALIDATION",
    };
  }

  const context = await getWhatsappInboxAccessContext();
  if (!context?.canUse) {
    return {
      success: false,
      message: "You do not have permission to send service messages.",
      code: "ACCESS_DENIED",
    };
  }

  const canUse = await canCurrentUserAccessConversation(conversationId, "use");
  if (!canUse) {
    return {
      success: false,
      message: "Conversation is outside your authorized scope.",
      code: "ACCESS_DENIED",
    };
  }

  try {
    rejectMarketingPurpose(WHATSAPP_SERVICE_PURPOSE_CODE);
    const normalizedBody = normalizeWhatsappSendBody(bodyText);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "create_whatsapp_service_send_intent",
      {
        p_conversation_id: conversationId,
        p_idempotency_key: idempotencyKey,
        p_purpose_code: WHATSAPP_SERVICE_PURPOSE_CODE,
        p_body_text: normalizedBody,
        p_reply_to_message_id: undefined,
      }
    );

    if (error) {
      throw whatsappInboxErrorFromPostgresMessage(error.message);
    }

    revalidatePath(`/admin/whatsapp/inbox/${conversationId}`);
    revalidatePath("/admin/whatsapp/inbox");

    const intentId = data?.id ?? undefined;
    const outboundMode = getWhatsappOutboundMode();

    if (outboundMode === "disabled" || !intentId) {
      return {
        success: true,
        message:
          "Service send request recorded. Provider dispatch is disabled in this environment.",
        intentId,
        dispatchOutcome: "disabled",
      };
    }

    const dispatchResult = await dispatchWhatsappSendIntent(intentId);

    if (dispatchResult.outcome === "bound") {
      return {
        success: true,
        message: dispatchResult.message,
        intentId,
        dispatchOutcome: dispatchResult.outcome,
        providerMessageId: dispatchResult.providerMessageId,
      };
    }

    if (dispatchResult.outcome === "already_bound") {
      return {
        success: true,
        message: dispatchResult.message,
        intentId,
        dispatchOutcome: dispatchResult.outcome,
        providerMessageId: dispatchResult.providerMessageId,
      };
    }

    if (dispatchResult.outcome === "ambiguous") {
      return {
        success: false,
        message: dispatchResult.message,
        code: "DISPATCH_AMBIGUOUS",
        intentId,
        dispatchOutcome: dispatchResult.outcome,
      };
    }

    return {
      success: outboundMode === "local-test" ? false : true,
      message:
        dispatchResult.outcome === "failed"
          ? dispatchResult.message
          : "Service send request recorded. Provider dispatch is disabled in this environment.",
      code: dispatchResult.outcome === "failed" ? "DISPATCH_FAILED" : undefined,
      intentId,
      dispatchOutcome: dispatchResult.outcome,
    };
  } catch (error) {
    return toSendActionState(error);
  }
}

export async function createQuotationWhatsappSendIntentAction(params: {
  customerE164: string;
  bodyText: string;
  leadId: string;
  secureContentKind: string;
  secureContentRef: string;
}): Promise<{ success: boolean; sendIntentId?: string; message?: string }> {
  const { createAdminClient } = await import("@/lib/supabase/service-role");
  const admin = createAdminClient();

  // Find or create whatsapp conversation for this customer
  const { data: existingConv } = await admin
    .from("whatsapp_conversations")
    .select("id")
    .eq("customer_e164", params.customerE164)
    .single();

  let convId = existingConv?.id;

  if (!convId) {
    // Fetch default phone number
    const { data: phoneRow } = await admin
      .from("whatsapp_phone_numbers")
      .select("id")
      .limit(1)
      .single();

    const phoneId = phoneRow?.id || crypto.randomUUID();

    const { data: newConv, error: convErr } = await admin
      .from("whatsapp_conversations")
      .insert({
        customer_e164: params.customerE164,
        lead_id: params.leadId,
        phone_number_id: phoneId,
      })
      .select("id")
      .single();

    if (convErr || !newConv) {
      return { success: false, message: convErr?.message || "Could not initialize WhatsApp conversation." };
    }
    convId = newConv.id;
  }

  const { data: intentRow, error: insertErr } = await admin
    .from("whatsapp_send_intents")
    .insert({
      conversation_id: convId,
      idempotency_key: crypto.randomUUID(),
      purpose_code: WHATSAPP_SERVICE_PURPOSE_CODE,
      body_text: params.bodyText,
      eligibility_code: "PASSED",
      eligibility_snapshot: {},
      request_hash: crypto.createHash("sha256").update(params.bodyText).digest("hex"),
      requested_by: "00000000-0000-0000-0000-000000000000",
      secure_content_kind: params.secureContentKind,
      secure_content_ref: params.secureContentRef,
    })
    .select("id")
    .single();

  if (insertErr || !intentRow) {
    return { success: false, message: insertErr?.message || "Failed to create WhatsApp send intent." };
  }

  return {
    success: true,
    sendIntentId: intentRow.id,
  };
}

export { INITIAL_WHATSAPP_SEND_ACTION_STATE };
