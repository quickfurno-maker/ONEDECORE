export type CommerceActionCode =
  | "COMMERCE_UNAUTHORIZED"
  | "COMMERCE_VALIDATION"
  | "COMMERCE_MEDIA_OBJECT_MISSING"
  | "COMMERCE_NOT_FOUND"
  | "COMMERCE_PUBLISH_NOT_READY"
  | "COMMERCE_INVENTORY_UNDERFLOW"
  | "IDEMPOTENCY_KEY_REUSED"
  | "COMMERCE_UNKNOWN_ERROR";

export class CommerceActionError extends Error {
  public readonly code: CommerceActionCode;

  constructor(code: CommerceActionCode, message: string) {
    super(message);
    this.name = "CommerceActionError";
    this.code = code;
  }
}

export interface CommerceActionResult<T = Record<string, unknown>> {
  readonly success: boolean;
  readonly message: string;
  readonly code?: CommerceActionCode;
  readonly data?: T;
}

export function commerceErrorFromUnknown(error: unknown): CommerceActionError {
  if (error instanceof CommerceActionError) return error;

  let messageStr = "";
  let codeStr = "";
  if (error instanceof Error) {
    messageStr = error.message;
  } else if (error && typeof error === "object") {
    const errObj = error as Record<string, unknown>;
    codeStr = typeof errObj.code === "string" ? errObj.code : "";
    messageStr = typeof errObj.message === "string" ? errObj.message : "";
  }

  const combined = `${codeStr} ${messageStr}`;
  if (combined.includes("IDEMPOTENCY_KEY_REUSED")) {
    return new CommerceActionError(
      "IDEMPOTENCY_KEY_REUSED",
      "The same request key was reused with a different payload."
    );
  }
  if (combined.includes("COMMERCE_PUBLISH_NOT_READY")) {
    return new CommerceActionError(
      "COMMERCE_PUBLISH_NOT_READY",
      "This product is not ready to publish. Add an active category, priced variant, required tax, and primary media."
    );
  }
  if (combined.includes("COMMERCE_INVENTORY_UNDERFLOW")) {
    return new CommerceActionError(
      "COMMERCE_INVENTORY_UNDERFLOW",
      "That adjustment would take stock below reserved quantity."
    );
  }
  if (combined.includes("COMMERCE_NOT_FOUND")) {
    return new CommerceActionError("COMMERCE_NOT_FOUND", "The commerce record was not found.");
  }
  if (combined.includes("COMMERCE_MEDIA_OBJECT_MISSING")) {
    return new CommerceActionError(
      "COMMERCE_MEDIA_OBJECT_MISSING",
      "The original and public derivative storage objects must both exist before media can be finalized."
    );
  }
  if (combined.includes("COMMERCE_VALIDATION")) {
    return new CommerceActionError("COMMERCE_VALIDATION", "The commerce request is invalid.");
  }
  if (combined.includes("COMMERCE_UNAUTHORIZED") || combined.includes("42501") || codeStr === "42501") {
    return new CommerceActionError(
      "COMMERCE_UNAUTHORIZED",
      "You do not have commerce authority for this action."
    );
  }
  return new CommerceActionError("COMMERCE_UNKNOWN_ERROR", "The commerce request could not be completed.");
}
