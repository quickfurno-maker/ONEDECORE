"use server";

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

    return {
      success: true,
      message:
        "Service send request recorded. Provider dispatch is not active in this phase.",
      intentId: data?.id ?? undefined,
    };
  } catch (error) {
    return toSendActionState(error);
  }
}

export { INITIAL_WHATSAPP_SEND_ACTION_STATE };
