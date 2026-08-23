import "server-only";

export const COMMERCE_ORDER_ERROR_CODES = [
  "COMMERCE_ORDER_VALIDATION",
  "COMMERCE_ORDER_UNAVAILABLE",
  "COMMERCE_ORDER_NOT_SERVICEABLE",
  "COMMERCE_COD_UNAVAILABLE",
  "COMMERCE_INVENTORY_UNAVAILABLE",
  "COMMERCE_ORDER_NOT_FOUND",
  "COMMERCE_ORDER_TRANSITION_INVALID",
  "IDEMPOTENCY_KEY_REUSED",
  "COMMERCE_RATE_LIMITED",
  "COMMERCE_UNAUTHORIZED",
] as const;

export type CommerceOrderErrorCode = (typeof COMMERCE_ORDER_ERROR_CODES)[number];

export class CommerceOrderError extends Error {
  readonly code: CommerceOrderErrorCode;

  constructor(code: CommerceOrderErrorCode, message = "Commerce order request failed") {
    super(message);
    this.name = "CommerceOrderError";
    this.code = code;
  }
}

export class CommerceOrderParseError extends Error {
  readonly context: string;

  constructor(context: string) {
    super("Commerce order payload was malformed");
    this.name = "CommerceOrderParseError";
    this.context = context;
  }
}

const CODE_SET = new Set<string>(COMMERCE_ORDER_ERROR_CODES);

export function normalizeCommerceOrderError(error: unknown): CommerceOrderError {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  for (const code of COMMERCE_ORDER_ERROR_CODES) {
    if (message.includes(code)) {
      return new CommerceOrderError(code);
    }
  }
  if (CODE_SET.has(message)) {
    return new CommerceOrderError(message as CommerceOrderErrorCode);
  }
  return new CommerceOrderError("COMMERCE_ORDER_VALIDATION");
}
