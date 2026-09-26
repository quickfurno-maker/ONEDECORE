"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { WHATSAPP_SERVICE_PURPOSE_CODE } from "../contracts/inbox-permissions.ts";
import {
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
import {
  buildWhatsappOutboundMediaObjectPath,
  deleteWhatsappOutboundMediaBestEffort,
  hashWhatsappOutboundMedia,
  uploadWhatsappOutboundMedia,
  validateWhatsappOutboundMedia,
} from "./whatsapp-outbound-media.ts";
import { WHATSAPP_OUTBOUND_MEDIA_CAPTION_MAX } from "../contracts/outbound-media.ts";

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
  const replyToMessageIdRaw = String(
    formData.get("replyToMessageId") ?? ""
  ).trim();
  const replyToMessageId = replyToMessageIdRaw || null;

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
        p_reply_to_message_id: replyToMessageId ?? undefined,
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


export async function createWhatsappServiceMediaSendIntentAction(
  _previousState: WhatsappSendActionState,
  formData: FormData
): Promise<WhatsappSendActionState> {
  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const replyToMessageIdRaw = String(
    formData.get("replyToMessageId") ?? ""
  ).trim();
  const replyToMessageId = replyToMessageIdRaw || null;
  const fileEntry = formData.get("mediaFile");

  if (!conversationId || !idempotencyKey) {
    return {
      success: false,
      message: "Missing conversation or idempotency key.",
      code: "VALIDATION",
    };
  }

  if (!(fileEntry instanceof File)) {
    return {
      success: false,
      message: "Choose an attachment.",
      code: "VALIDATION",
    };
  }

  if (caption.length > WHATSAPP_OUTBOUND_MEDIA_CAPTION_MAX) {
    return {
      success: false,
      message: "Attachment caption is too long.",
      code: "VALIDATION",
    };
  }

  const validation = validateWhatsappOutboundMedia({
    fileName: fileEntry.name,
    mimeType: fileEntry.type,
    sizeBytes: fileEntry.size,
  });
  if (!validation.ok) {
    return {
      success: false,
      message: validation.message,
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

  let objectPath: string | null = null;
  try {
    rejectMarketingPurpose(WHATSAPP_SERVICE_PURPOSE_CODE);

    const bytes = Buffer.from(await fileEntry.arrayBuffer());
    if (bytes.byteLength !== fileEntry.size) {
      return {
        success: false,
        message: "Attachment size changed while reading the upload.",
        code: "VALIDATION",
      };
    }

    objectPath = buildWhatsappOutboundMediaObjectPath(conversationId);
    const sha256 = hashWhatsappOutboundMedia(bytes);
    const upload = await uploadWhatsappOutboundMedia({
      objectPath,
      bytes,
      mimeType: fileEntry.type,
    });
    if (!upload.success) {
      return {
        success: false,
        message: upload.message ?? "Attachment could not be stored securely.",
        code: "UPLOAD_FAILED",
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "create_whatsapp_service_media_send_intent",
      {
        p_conversation_id: conversationId,
        p_idempotency_key: idempotencyKey,
        p_purpose_code: WHATSAPP_SERVICE_PURPOSE_CODE,
        p_message_kind: validation.kind,
        p_caption: caption,
        p_reply_to_message_id: replyToMessageId,
        p_media_object_path: objectPath,
        p_media_file_name: validation.fileName,
        p_media_mime_type: fileEntry.type.toLowerCase(),
        p_media_size_bytes: bytes.byteLength,
        p_media_sha256: sha256,
      }
    );

    if (error) {
      await deleteWhatsappOutboundMediaBestEffort(objectPath);
      objectPath = null;
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
          "Attachment send request recorded. Provider dispatch is disabled in this environment.",
        intentId,
        dispatchOutcome: "disabled",
      };
    }

    const dispatchResult = await dispatchWhatsappSendIntent(intentId);
    if (
      dispatchResult.outcome === "bound" ||
      dispatchResult.outcome === "already_bound"
    ) {
      return {
        success: true,
        message: dispatchResult.message,
        intentId,
        dispatchOutcome: dispatchResult.outcome,
        providerMessageId: dispatchResult.providerMessageId,
      };
    }

    return {
      success: false,
      message: dispatchResult.message,
      code:
        dispatchResult.outcome === "ambiguous"
          ? "DISPATCH_AMBIGUOUS"
          : "DISPATCH_FAILED",
      intentId,
      dispatchOutcome: dispatchResult.outcome,
    };
  } catch (error) {
    if (objectPath) {
      await deleteWhatsappOutboundMediaBestEffort(objectPath);
    }
    return toSendActionState(error);
  }
}
