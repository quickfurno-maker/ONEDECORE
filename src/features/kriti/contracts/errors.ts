/**
 * Kriti normalized error contracts — never expose raw provider payloads.
 */

export const KRITI_ERROR_CODES = [
  "KRITI_DISABLED",
  "KRITI_UNAVAILABLE",
  "KRITI_PROVIDER_UNAVAILABLE",
  "KRITI_RATE_LIMITED",
  "KRITI_TIMEOUT",
  "KRITI_INVALID_OUTPUT",
  "KRITI_CONTEXT_TOO_LARGE",
  "KRITI_SAFETY_REFUSAL",
  "KRITI_CONFIGURATION_ERROR",
] as const;

export type KritiErrorCode = (typeof KRITI_ERROR_CODES)[number];

export interface KritiError {
  readonly code: KritiErrorCode;
  readonly message: string;
  readonly retryable: boolean;
}

export function createKritiError(
  code: KritiErrorCode,
  message: string,
  retryable = false
): KritiError {
  return { code, message, retryable };
}
