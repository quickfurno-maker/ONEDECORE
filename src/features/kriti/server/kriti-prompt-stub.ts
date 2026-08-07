import type { KritiRequest } from "../contracts/context.ts";
import { KRITI_TASK_SCHEMA_NAMES } from "../contracts/task-schemas.ts";

export interface KritiPromptBundle {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly responseSchemaName: string;
}

/**
 * Minimal K1 prompt stub — replaced by K2 policy builder at integration time.
 */
export function buildKritiPromptStub(request: KritiRequest): KritiPromptBundle {
  const schemaName = KRITI_TASK_SCHEMA_NAMES[request.taskType];
  return {
    responseSchemaName: schemaName,
    systemPrompt: [
      "You are Kriti, a human-controlled ONEDECORE staff copilot.",
      "Return JSON only matching the requested schema.",
      "Never send messages, mutate CRM data, approve quotations, or reveal secrets.",
      "Distinguish facts from suggestions.",
      "All drafts require human review.",
    ].join(" "),
    userPrompt: JSON.stringify({
      taskType: request.taskType,
      authorizedBusiness: request.context.authorizedBusiness,
      supplementalFacts: request.context.supplementalFacts,
      customerMessages: request.context.untrustedCustomer.messages.map((message) => ({
        direction: message.direction,
        body: message.body,
      })),
    }),
  };
}
