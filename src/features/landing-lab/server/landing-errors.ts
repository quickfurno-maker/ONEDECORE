export type LandingLabActionCode =
  | "LANDING_LAB_UNAUTHORIZED"
  | "LANDING_LAB_NOT_FOUND"
  | "LANDING_VERSION_FROZEN"
  | "LANDING_VERSION_NOT_FROZEN"
  | "LANDING_PUBLICATION_INVALID_TRANSITION"
  | "LANDING_EXPERIMENT_INVALID"
  | "IDEMPOTENCY_KEY_REUSED"
  | "LANDING_LAB_UNKNOWN_ERROR";

export class LandingLabActionError extends Error {
  public readonly code: LandingLabActionCode;
  constructor(code: LandingLabActionCode, message: string) {
    super(message);
    this.name = "LandingLabActionError";
    this.code = code;
  }
}

export function landingLabErrorFromUnknown(error: unknown): LandingLabActionError {
  if (error instanceof LandingLabActionError) return error;
  let combined = "";
  if (error instanceof Error) combined = error.message;
  else if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    combined = `${obj.code ?? ""} ${obj.message ?? ""}`;
  }
  if (combined.includes("IDEMPOTENCY_KEY_REUSED")) {
    return new LandingLabActionError("IDEMPOTENCY_KEY_REUSED", "The same request key was reused with a different payload.");
  }
  if (combined.includes("LANDING_VERSION_FROZEN")) {
    return new LandingLabActionError("LANDING_VERSION_FROZEN", "Frozen landing versions cannot be edited.");
  }
  if (combined.includes("LANDING_VERSION_NOT_FROZEN")) {
    return new LandingLabActionError("LANDING_VERSION_NOT_FROZEN", "A frozen version is required.");
  }
  if (combined.includes("LANDING_PUBLICATION_INVALID_TRANSITION") || combined.includes("LANDING_PUBLICATION_ARCHIVED")) {
    return new LandingLabActionError("LANDING_PUBLICATION_INVALID_TRANSITION", "That publication transition is not allowed.");
  }
  if (combined.includes("LANDING_EXPERIMENT")) {
    return new LandingLabActionError("LANDING_EXPERIMENT_INVALID", "The experiment configuration is invalid.");
  }
  if (combined.includes("LANDING_LAB_UNAUTHORIZED") || combined.includes("42501")) {
    return new LandingLabActionError("LANDING_LAB_UNAUTHORIZED", "You do not have Landing Lab authority for this action.");
  }
  return new LandingLabActionError("LANDING_LAB_UNKNOWN_ERROR", "The Landing Lab request could not be completed.");
}
