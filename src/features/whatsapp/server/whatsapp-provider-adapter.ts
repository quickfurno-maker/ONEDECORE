import type {
  WhatsappProviderDispatchRequest,
  WhatsappProviderDispatchResult,
} from "../contracts/provider-dispatch.ts";

export interface WhatsappProviderAdapter {
  readonly providerCode: "fake" | "meta";
  dispatchTextMessage(
    request: WhatsappProviderDispatchRequest
  ): Promise<WhatsappProviderDispatchResult>;
}
