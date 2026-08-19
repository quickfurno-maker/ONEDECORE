export type CampaignActionCode =
  | "CAMPAIGN_UNAUTHORIZED"
  | "CAMPAIGN_NOT_FOUND_OR_FORBIDDEN"
  | "CAMPAIGN_DRAFT_CONFLICT"
  | "CAMPAIGN_SELF_APPROVAL_DENIED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "CAMPAIGN_VALIDATION"
  | "CONSENT_VALIDATION"
  | "CAMPAIGN_UNKNOWN_ERROR"
  | "MULTI_PROVIDER_EXECUTION_REQUIRES_SEPARATE_APPROVED_VERSIONS"
  | "CAMPAIGN_VERSION_NOT_APPROVED"
  | "CAMPAIGN_CANCEL_SUPER_ADMIN_ONLY"
  | "CAMPAIGN_RUN_INVALID_TRANSITION"
  | "CAMPAIGN_NO_PAID_ADS_CHANNEL"
  | "CAMPAIGN_PROVIDER_ADAPTER_NOT_IMPLEMENTED";

export class CampaignActionError extends Error {
  public readonly code: CampaignActionCode;

  constructor(code: CampaignActionCode, message: string) {
    super(message);
    this.name = "CampaignActionError";
    this.code = code;
  }
}

export function campaignErrorFromUnknown(error: unknown): CampaignActionError {
  if (error instanceof CampaignActionError) return error;

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
  if (combined.includes("CAMPAIGN_SELF_APPROVAL_DENIED")) {
    return new CampaignActionError(
      "CAMPAIGN_SELF_APPROVAL_DENIED",
      "Sales Managers cannot approve a campaign version they created or submitted."
    );
  }
  if (combined.includes("CAMPAIGN_DRAFT_CONFLICT") || codeStr === "P0002") {
    return new CampaignActionError(
      "CAMPAIGN_DRAFT_CONFLICT",
      "This draft was modified in another session. Reload and try again."
    );
  }
  if (combined.includes("IDEMPOTENCY_KEY_REUSED")) {
    return new CampaignActionError(
      "IDEMPOTENCY_KEY_REUSED",
      "The same request key was reused with a different payload."
    );
  }
  if (combined.includes("CAMPAIGN_UNAUTHORIZED") || codeStr === "42501") {
    return new CampaignActionError(
      "CAMPAIGN_UNAUTHORIZED",
      "You do not have Phase 9A campaign authority for this action."
    );
  }
  if (combined.includes("MULTI_PROVIDER_EXECUTION_REQUIRES_SEPARATE_APPROVED_VERSIONS")) {
    return new CampaignActionError(
      "MULTI_PROVIDER_EXECUTION_REQUIRES_SEPARATE_APPROVED_VERSIONS",
      "Both Meta Ads and Google Ads require separate approved versions. One run executes one Ads provider."
    );
  }
  if (combined.includes("CAMPAIGN_VERSION_NOT_APPROVED")) {
    return new CampaignActionError(
      "CAMPAIGN_VERSION_NOT_APPROVED",
      "Only an approved campaign version can be executed."
    );
  }
  if (combined.includes("CAMPAIGN_CANCEL_SUPER_ADMIN_ONLY")) {
    return new CampaignActionError(
      "CAMPAIGN_CANCEL_SUPER_ADMIN_ONLY",
      "Only Super Admin may cancel a campaign run."
    );
  }
  if (combined.includes("CAMPAIGN_RUN_INVALID_TRANSITION")) {
    return new CampaignActionError(
      "CAMPAIGN_RUN_INVALID_TRANSITION",
      "That run state change is not allowed."
    );
  }
  if (combined.includes("CAMPAIGN_NO_PAID_ADS_CHANNEL")) {
    return new CampaignActionError(
      "CAMPAIGN_NO_PAID_ADS_CHANNEL",
      "This approved version has no paid Ads channel to execute."
    );
  }
  if (combined.includes("CAMPAIGN_PROVIDER_ADAPTER_NOT_IMPLEMENTED")) {
    return new CampaignActionError(
      "CAMPAIGN_PROVIDER_ADAPTER_NOT_IMPLEMENTED",
      "Sandbox/live Ads adapters are not implemented in Phase 9C-B."
    );
  }
  if (combined.includes("CONSENT_VALIDATION") || combined.includes("CAMPAIGN_VALIDATION")) {
    return new CampaignActionError("CAMPAIGN_VALIDATION", "The campaign or consent request is invalid.");
  }
  return new CampaignActionError("CAMPAIGN_UNKNOWN_ERROR", "The campaign request could not be completed.");
}
