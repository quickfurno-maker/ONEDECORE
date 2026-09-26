import type {
  WhatsappProviderDispatchRequest,
  WhatsappProviderDispatchResult,
  WhatsappProviderMediaDispatchRequest,
} from "../contracts/provider-dispatch.ts";

export interface WhatsappProviderAdapter {
  readonly providerCode: "fake" | "meta";
  dispatchTextMessage(
    request: WhatsappProviderDispatchRequest
  ): Promise<WhatsappProviderDispatchResult>;
  dispatchMediaMessage(
    request: WhatsappProviderMediaDispatchRequest
  ): Promise<WhatsappProviderDispatchResult>;
}
