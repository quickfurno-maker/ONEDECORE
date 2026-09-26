import type { WhatsappOutboundServerEnv } from "./whatsapp-outbound-env.ts";
import type { WhatsappProviderAdapter } from "./whatsapp-provider-adapter.ts";
import type { WhatsappTemplateMessageAdapter } from "./whatsapp-template-provider-adapter.ts";
import type {
  WhatsappProviderDispatchRequest,
  WhatsappProviderDispatchResult,
  WhatsappProviderMediaDispatchRequest,
} from "../contracts/provider-dispatch.ts";
import type { WhatsappTemplateMessageDispatchRequest } from "../contracts/template-studio.ts";
import { classifyMetaDispatchHttpStatus } from "./whatsapp-dispatch-errors.ts";

type MetaSendMessageResponse = {
  messages?: Array<{ id?: string }>;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

function requireEnabledEnv(env: WhatsappOutboundServerEnv): string {
  if (env.mode !== "enabled") {
    throw new Error(
      "[ONEDECORE Meta WhatsApp Adapter] enabled mode required for Meta adapter."
    );
  }

  if (!env.accessToken) {
    throw new Error(
      "[ONEDECORE Meta WhatsApp Adapter] Missing Meta outbound credentials."
    );
  }
  return env.accessToken;
}

/**
 * The single Cloud API `/messages` call site. Text and template dispatch both
 * come through here, so the endpoint, credential handling and response
 * classification cannot diverge between the two lanes.
 *
 * `networkFailure` is the one thing the lanes decide differently: a thrown
 * fetch on the text lane stays the historical transient failure, while the
 * template lane treats it as ambiguous, because a timeout after the request
 * left this process may already have produced a message.
 */
async function postMetaWhatsappMessage(
  env: WhatsappOutboundServerEnv,
  accessToken: string,
  phoneNumberId: string,
  payload: Record<string, unknown>,
  networkFailure: "transient" | "ambiguous"
): Promise<WhatsappProviderDispatchResult> {
  if (!/^[0-9]{1,64}$/.test(phoneNumberId)) {
    return {
      kind: "failed",
      errorClass: "terminal",
      code: "invalid_phone_number_id",
      message: "Phone number id is not a Meta id.",
      httpStatus: null,
      responseSnapshot: { provider: "meta" },
    };
  }

  const endpoint = `https://graph.facebook.com/${env.graphApiVersion}/${phoneNumberId}/messages`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta network request failed";
    return networkFailure === "ambiguous"
      ? {
          kind: "ambiguous",
          code: "network_error",
          message,
          httpStatus: null,
          responseSnapshot: { provider: "meta" },
        }
      : {
          kind: "failed",
          errorClass: "transient",
          code: "network_error",
          message,
          httpStatus: null,
          responseSnapshot: { provider: "meta" },
        };
  }

  const responseText = await response.text();
  let parsed: MetaSendMessageResponse = {};
  try {
    parsed = JSON.parse(responseText) as MetaSendMessageResponse;
  } catch {
    parsed = {};
  }

  const responseSnapshot: Record<string, unknown> = {
    provider: "meta",
    httpStatus: response.status,
    errorType: parsed.error?.type ?? null,
    errorCode: parsed.error?.code ?? null,
  };

  if (response.ok) {
    const providerMessageId = parsed.messages?.[0]?.id;
    if (!providerMessageId) {
      return {
        kind: "ambiguous",
        code: "missing_provider_message_id",
        message: "Meta accepted the request without a message id.",
        httpStatus: response.status,
        responseSnapshot,
      };
    }

    return {
      kind: "success",
      providerMessageId,
      providerTimestamp: new Date().toISOString(),
      httpStatus: response.status,
      responseSnapshot,
    };
  }

  const classification = classifyMetaDispatchHttpStatus(response.status);
  if (classification === "ambiguous" || (networkFailure === "ambiguous" && response.status >= 500)) {
    return {
      kind: "ambiguous",
      code: parsed.error?.type ?? "meta_ambiguous",
      message: parsed.error?.message ?? "Meta dispatch result ambiguous.",
      httpStatus: response.status,
      responseSnapshot,
    };
  }

  return {
    kind: "failed",
    errorClass: classification,
    code: parsed.error?.type ?? "meta_dispatch_failed",
    message: parsed.error?.message ?? "Meta dispatch failed.",
    httpStatus: response.status,
    responseSnapshot,
  };
}

type MetaMediaUploadResponse = {
  id?: string;
  error?: MetaSendMessageResponse["error"];
};

type MetaMediaUploadResult =
  | {
      readonly kind: "success";
      readonly mediaId: string;
      readonly httpStatus: number;
      readonly responseSnapshot: Record<string, unknown>;
    }
  | Exclude<WhatsappProviderDispatchResult, { readonly kind: "success" }>;

async function uploadMetaWhatsappMedia(
  env: WhatsappOutboundServerEnv,
  accessToken: string,
  request: WhatsappProviderMediaDispatchRequest
): Promise<MetaMediaUploadResult> {
  if (!/^[0-9]{1,64}$/.test(request.phoneNumberId)) {
    return {
      kind: "failed",
      errorClass: "terminal",
      code: "invalid_phone_number_id",
      message: "Phone number id is not a Meta id.",
      httpStatus: null,
      responseSnapshot: { provider: "meta" },
    };
  }

  const endpoint =
    `https://graph.facebook.com/${env.graphApiVersion}/${request.phoneNumberId}/media`;
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", request.mimeType);
  form.set(
    "file",
    new Blob([new Uint8Array(request.bytes)], { type: request.mimeType }),
    request.fileName
  );

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    });
  } catch (error) {
    return {
      kind: "failed",
      errorClass: "transient",
      code: "media_upload_network_error",
      message:
        error instanceof Error
          ? error.message
          : "Meta media upload request failed.",
      httpStatus: null,
      responseSnapshot: { provider: "meta", operation: "media_upload" },
    };
  }

  const responseText = await response.text();
  let parsed: MetaMediaUploadResponse = {};
  try {
    parsed = JSON.parse(responseText) as MetaMediaUploadResponse;
  } catch {
    parsed = {};
  }

  const responseSnapshot: Record<string, unknown> = {
    provider: "meta",
    operation: "media_upload",
    httpStatus: response.status,
    errorType: parsed.error?.type ?? null,
    errorCode: parsed.error?.code ?? null,
  };

  if (response.ok) {
    if (!parsed.id) {
      return {
        kind: "failed",
        errorClass: "transient",
        code: "media_upload_missing_id",
        message: "Meta accepted the media upload without returning a media id.",
        httpStatus: response.status,
        responseSnapshot,
      };
    }
    return {
      kind: "success",
      mediaId: parsed.id,
      httpStatus: response.status,
      responseSnapshot,
    };
  }

  const classification = classifyMetaDispatchHttpStatus(response.status);
  if (classification === "ambiguous") {
    return {
      kind: "ambiguous",
      code: parsed.error?.type ?? "meta_media_upload_ambiguous",
      message: parsed.error?.message ?? "Meta media upload result is ambiguous.",
      httpStatus: response.status,
      responseSnapshot,
    };
  }

  return {
    kind: "failed",
    errorClass: classification,
    code: parsed.error?.type ?? "meta_media_upload_failed",
    message: parsed.error?.message ?? "Meta media upload failed.",
    httpStatus: response.status,
    responseSnapshot,
  };
}

export function createMetaWhatsappProviderAdapter(
  env: WhatsappOutboundServerEnv
): WhatsappProviderAdapter {
  const accessToken = requireEnabledEnv(env);

  return {
    providerCode: "meta",
    async dispatchTextMessage(
      request: WhatsappProviderDispatchRequest
    ): Promise<WhatsappProviderDispatchResult> {
      const to = request.customerE164.replace(/^\+/, "");
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        ...(request.replyToProviderMessageId
          ? { context: { message_id: request.replyToProviderMessageId } }
          : {}),
        type: "text",
        text: {
          preview_url: false,
          body: request.bodyText,
        },
      };

      return postMetaWhatsappMessage(
        env,
        accessToken,
        request.phoneNumberId,
        payload,
        "transient"
      );
    },
    async dispatchMediaMessage(
      request: WhatsappProviderMediaDispatchRequest
    ): Promise<WhatsappProviderDispatchResult> {
      const uploaded = await uploadMetaWhatsappMedia(env, accessToken, request);
      if (uploaded.kind !== "success") {
        return uploaded;
      }

      const media: Record<string, unknown> = {
        id: uploaded.mediaId,
        ...(request.caption ? { caption: request.caption } : {}),
        ...(request.mediaKind === "document"
          ? { filename: request.fileName }
          : {}),
      };

      const payload: Record<string, unknown> = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: request.customerE164.replace(/^\+/, ""),
        ...(request.replyToProviderMessageId
          ? { context: { message_id: request.replyToProviderMessageId } }
          : {}),
        type: request.mediaKind,
        [request.mediaKind]: media,
      };

      const result = await postMetaWhatsappMessage(
        env,
        accessToken,
        request.phoneNumberId,
        payload,
        "ambiguous"
      );

      return {
        ...result,
        responseSnapshot: {
          ...result.responseSnapshot,
          mediaUploadId: uploaded.mediaId,
          mediaKind: request.mediaKind,
        },
      };
    },
  };
}

/** The official Cloud API template payload. Parameters, never substituted text. */
export function buildMetaWhatsappTemplateMessagePayload(
  request: WhatsappTemplateMessageDispatchRequest
): Record<string, unknown> {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: request.customerE164.replace(/^\+/, ""),
    type: "template",
    template: {
      name: request.templateName,
      language: { code: request.templateLanguage },
      ...(request.components.length > 0 ? { components: request.components } : {}),
    },
  };
}

/**
 * WM-2 template message adapter. A 5xx or a network failure is AMBIGUOUS
 * here: the template lane never retries, so an unclear result goes to
 * reconciliation rather than being reported as safe to resend.
 */
export function createMetaWhatsappTemplateMessageAdapter(
  env: WhatsappOutboundServerEnv
): WhatsappTemplateMessageAdapter {
  const accessToken = requireEnabledEnv(env);

  return {
    providerCode: "meta",
    async dispatchTemplateMessage(request) {
      return postMetaWhatsappMessage(
        env,
        accessToken,
        request.phoneNumberId,
        buildMetaWhatsappTemplateMessagePayload(request),
        "ambiguous"
      );
    },
  };
}
