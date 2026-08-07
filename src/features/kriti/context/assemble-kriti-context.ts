import type { KritiContext, KritiUntrustedCustomerContent } from "../contracts/context.ts";

export const KRITI_MAX_MESSAGES = 20;
export const KRITI_MAX_MESSAGE_CHARS = 2_000;
export const KRITI_MAX_NOTES = 10;
export const KRITI_MAX_NOTE_CHARS = 1_000;
export const KRITI_MAX_SUPPLEMENTAL_FACTS = 20;
export const KRITI_MAX_SUPPLEMENTAL_FACT_CHARS = 500;
export const KRITI_MAX_TOTAL_CONTEXT_CHARS = 12_000;

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

export function boundUntrustedCustomerContent(
  content: KritiUntrustedCustomerContent
): KritiUntrustedCustomerContent {
  return {
    messages: content.messages.slice(0, KRITI_MAX_MESSAGES).map((message) => ({
      ...message,
      body: truncate(message.body, KRITI_MAX_MESSAGE_CHARS),
    })),
    notes: content.notes.slice(0, KRITI_MAX_NOTES).map((note) => truncate(note, KRITI_MAX_NOTE_CHARS)),
  };
}

export function assembleKritiContext(context: KritiContext): KritiContext {
  const boundedCustomer = boundUntrustedCustomerContent(context.untrustedCustomer);
  const supplementalFacts = context.supplementalFacts
    .slice(0, KRITI_MAX_SUPPLEMENTAL_FACTS)
    .map((fact) => truncate(fact, KRITI_MAX_SUPPLEMENTAL_FACT_CHARS));

  const totalChars =
    JSON.stringify(boundedCustomer).length +
    JSON.stringify(supplementalFacts).length +
    JSON.stringify(context.authorizedBusiness).length;

  if (totalChars > KRITI_MAX_TOTAL_CONTEXT_CHARS) {
    throw new Error("KRITI_CONTEXT_TOO_LARGE");
  }

  return {
    ...context,
    untrustedCustomer: boundedCustomer,
    supplementalFacts,
  };
}
