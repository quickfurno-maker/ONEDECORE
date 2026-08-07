import type { KritiRequest } from "../contracts/context.ts";
import { KRITI_TASK_SCHEMA_NAMES } from "../contracts/task-schemas.ts";
import { assembleKritiContext } from "../context/assemble-kriti-context.ts";
import { assessPromptInjection, buildInjectionDefenseNote } from "./injection-guard.ts";
import { minimizeKritiContextForTask } from "./pii-minimizer.ts";

export interface KritiPromptBundle {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly responseSchemaName: string;
}

export function buildKritiPrompts(request: KritiRequest): KritiPromptBundle {
  const bounded = assembleKritiContext(request.context);
  const minimized = minimizeKritiContextForTask(bounded);
  const untrustedText = minimized.untrustedCustomer.messages.map((message) => message.body).join("\n");
  const injection = assessPromptInjection(untrustedText);
  const injectionNote = buildInjectionDefenseNote(injection);

  const systemPrompt = [
    "TRUSTED SYSTEM POLICY:",
    minimized.trustedPolicy.assistanceScope,
    `Prohibited: ${minimized.trustedPolicy.prohibitedActions.join(", ")}.`,
    "Never send messages, mutate assignments, approve quotations, change prices/discounts, close leads, or reveal secrets.",
    "Return JSON only for the requested schema.",
    injectionNote,
  ]
    .filter(Boolean)
    .join(" ");

  const userPrompt = JSON.stringify({
    taskType: request.taskType,
    trustedAuthorizedBusiness: minimized.authorizedBusiness,
    trustedSupplementalFacts: minimized.supplementalFacts,
    untrustedCustomerContent: minimized.untrustedCustomer,
  });

  return {
    systemPrompt,
    userPrompt,
    responseSchemaName: KRITI_TASK_SCHEMA_NAMES[request.taskType],
  };
}
