import { createHash } from "node:crypto";
import type { WhatsappProviderTemplateRecord } from "../contracts/template-studio.ts";
import type {
  WhatsappTemplateManagementAdapter,
  WhatsappTemplateMessageAdapter,
} from "./whatsapp-template-provider-adapter.ts";

/**
 * WM-2 local-test adapters. No network, and nothing that could pass for
 * provider approval.
 *
 * The fake management provider accepts a created template as PENDING and
 * reports exactly what it has been given, still PENDING. It never approves:
 * approval is Meta's decision, and a local environment that could mint an
 * APPROVED template would make the "approved snapshot required" rule
 * meaningless in the place it is tested. Certification seeds approved
 * templates through the service-role RPC, as evidence, not through this fake.
 */

function digest(value: string, length: number): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

export function createFakeWhatsappTemplateManagementAdapter(
  store: Map<string, WhatsappProviderTemplateRecord> = new Map()
): WhatsappTemplateManagementAdapter {
  return {
    providerCode: "fake",
    async listTemplates() {
      return { kind: "success", templates: [...store.values()], skipped: 0, truncated: false };
    },
    async getTemplate({ providerTemplateId }) {
      const template = [...store.values()].find((t) => t.providerTemplateId === providerTemplateId);
      return template
        ? { kind: "success", template }
        : { kind: "failed", errorClass: "terminal", code: "fake_template_not_found", message: "Template not found.", httpStatus: 404 };
    },
    async createTemplate(request) {
      const key = `${request.name}:${request.language}`;
      if (store.has(key)) {
        return { kind: "failed", errorClass: "terminal", code: "fake_template_exists", message: "Template already exists.", httpStatus: 400 };
      }
      const providerTemplateId = String(BigInt(`0x${digest(`fake-template:${request.wabaId}:${key}`, 12)}`));
      store.set(key, {
        providerTemplateId,
        name: request.name,
        language: request.language,
        rawStatus: "PENDING",
        rawCategory: request.category,
        rawQualityRating: null,
        parameterFormat: request.parameterFormat,
        components: request.components,
        rejectedReason: null,
      });
      return { kind: "success", providerTemplateId, rawStatus: "PENDING", rawCategory: request.category, httpStatus: 200 };
    },
  };
}

export function createFakeWhatsappTemplateMessageAdapter(): WhatsappTemplateMessageAdapter {
  return {
    providerCode: "fake",
    async dispatchTemplateMessage(request) {
      if (!request.templateName || !request.templateLanguage || !Array.isArray(request.components)) {
        return {
          kind: "failed",
          errorClass: "terminal",
          code: "validation_template_request",
          message: "Template name, language and components are required.",
          httpStatus: null,
          responseSnapshot: {},
        };
      }
      return {
        kind: "success",
        providerMessageId: `wamid.fake.${digest(`fake-template:${request.providerAttemptKey}`, 24)}`,
        providerTimestamp: new Date().toISOString(),
        httpStatus: 200,
        responseSnapshot: { messaging_product: "whatsapp", provider: "fake", type: "template" },
      };
    },
  };
}
