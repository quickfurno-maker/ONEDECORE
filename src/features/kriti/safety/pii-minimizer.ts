import type { KritiContext } from "../contracts/context.ts";

const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /service[_-]?role/i,
  /bearer\s+[a-z0-9._-]+/i,
  /sk-[a-z0-9]+/i,
];

const PII_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PII_PHONE = /\b\+?\d[\d\s-]{8,}\d\b/g;

export function redactLikelySecrets(value: string): string {
  let redacted = value;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[redacted-secret]");
  }
  return redacted;
}

export function maskEmail(value: string): string {
  return value.replace(PII_EMAIL, "[masked-email]");
}

export function maskPhone(value: string): string {
  return value.replace(PII_PHONE, "[masked-phone]");
}

export function minimizeKritiContextForTask(context: KritiContext): KritiContext {
  return {
    ...context,
    untrustedCustomer: {
      messages: context.untrustedCustomer.messages.map((message) => ({
        ...message,
        body: maskPhone(maskEmail(redactLikelySecrets(message.body))),
      })),
      notes: context.untrustedCustomer.notes.map((note) =>
        maskPhone(maskEmail(redactLikelySecrets(note)))
      ),
    },
    supplementalFacts: context.supplementalFacts.map((fact) =>
      maskPhone(maskEmail(redactLikelySecrets(fact)))
    ),
  };
}
