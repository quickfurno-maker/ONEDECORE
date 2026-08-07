import type { WhatsappOutboundServerEnv } from "./whatsapp-outbound-env.ts";
import type { WhatsappProviderAdapter } from "./whatsapp-provider-adapter.ts";
import type {
  WhatsappProviderDispatchRequest,
  WhatsappProviderDispatchResult,
} from "../contracts/provider-dispatch.ts";
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

export function createMetaWhatsappProviderAdapter(
  env: WhatsappOutboundServerEnv
): WhatsappProviderAdapter {
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

  return {
    providerCode: "meta",
    async dispatchTextMessage(
      request: WhatsappProviderDispatchRequest
    ): Promise<WhatsappProviderDispatchResult> {
      const endpoint = `https://graph.facebook.com/${env.graphApiVersion}/${request.phoneNumberId}/messages`;
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

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        return {
          kind: "failed",
          errorClass: "transient",
          code: "network_error",
          message:
            error instanceof Error ? error.message : "Meta network request failed",
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
      if (classification === "ambiguous") {
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
    },
  };
}
