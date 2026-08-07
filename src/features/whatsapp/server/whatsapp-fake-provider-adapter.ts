import { createHash } from "node:crypto";
import type { WhatsappProviderAdapter } from "./whatsapp-provider-adapter.ts";
import type {
  WhatsappProviderDispatchRequest,
  WhatsappProviderDispatchResult,
} from "../contracts/provider-dispatch.ts";

function deterministicFakeProviderMessageId(providerAttemptKey: string): string {
  const digest = createHash("sha256")
    .update(`fake:${providerAttemptKey}`)
    .digest("hex")
    .slice(0, 24);
  return `wamid.fake.${digest}`;
}

export function createFakeWhatsappProviderAdapter(): WhatsappProviderAdapter {
  return {
    providerCode: "fake",
    async dispatchTextMessage(
      request: WhatsappProviderDispatchRequest
    ): Promise<WhatsappProviderDispatchResult> {
      if (!request.bodyText.trim()) {
        return {
          kind: "failed",
          errorClass: "terminal",
          code: "validation_empty_body",
          message: "Body text is required.",
          httpStatus: null,
          responseSnapshot: {},
        };
      }

      return {
        kind: "success",
        providerMessageId: deterministicFakeProviderMessageId(
          request.providerAttemptKey
        ),
        providerTimestamp: new Date().toISOString(),
        httpStatus: 200,
        responseSnapshot: {
          messaging_product: "whatsapp",
          provider: "fake",
        },
      };
    },
  };
}
