import type {
  WhatsappTemplateCreateRequest,
  WhatsappTemplateCreateResult,
  WhatsappTemplateGetResult,
  WhatsappTemplateListResult,
  WhatsappTemplateMessageDispatchRequest,
} from "../contracts/template-studio.ts";
import type { WhatsappProviderDispatchResult } from "../contracts/provider-dispatch.ts";

/**
 * WM-2 provider ports for templates.
 *
 * Kept apart from `whatsapp-provider-adapter.ts`, whose port stays text-only:
 * the service text lane and the template lane are different governed paths
 * and a component that can send one does not thereby get the other.
 */

/** Official WhatsApp Business Management API: the WABA's message templates. */
export interface WhatsappTemplateManagementAdapter {
  readonly providerCode: "fake" | "meta";
  listTemplates(request: { readonly wabaId: string }): Promise<WhatsappTemplateListResult>;
  getTemplate(request: { readonly providerTemplateId: string }): Promise<WhatsappTemplateGetResult>;
  createTemplate(request: WhatsappTemplateCreateRequest): Promise<WhatsappTemplateCreateResult>;
}

/** Official Cloud API `/messages` with `type: "template"`. */
export interface WhatsappTemplateMessageAdapter {
  readonly providerCode: "fake" | "meta";
  dispatchTemplateMessage(
    request: WhatsappTemplateMessageDispatchRequest
  ): Promise<WhatsappProviderDispatchResult>;
}
