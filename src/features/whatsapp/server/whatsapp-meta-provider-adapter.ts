import type { WhatsappOutboundServerEnv } from "./whatsapp-outbound-env.ts";
import type { WhatsappProviderAdapter } from "./whatsapp-provider-adapter.ts";
import type { WhatsappTemplateMessageAdapter } from "./whatsapp-template-provider-adapter.ts";
import type {
  WhatsappProviderDispatchRequest,
  WhatsappProviderDispatchResult,
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
        type: "text",
        text: {
          preview_url: false,
          body: request.bodyText,
        },
      };

      return postMetaWhatsappMessage(env, accessToken, request.phoneNumberId, payload, "transient");
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
