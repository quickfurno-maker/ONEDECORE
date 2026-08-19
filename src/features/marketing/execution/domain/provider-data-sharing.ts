import type { CampaignTargetingMode } from "../../contracts/targeting.ts";
import type { CampaignExecutionMode } from "../contracts/execution-mode.ts";
import type { PaidAdsChannel } from "../contracts/run-lifecycle.ts";

export type ProviderDataSharingPurpose =
  | "custom_audience"
  | "hashed_match"
  | "conversion_identifier";

export interface ProviderDataSharingInput {
  readonly provider: PaidAdsChannel;
  readonly purpose: ProviderDataSharingPurpose;
  readonly targetingMode: CampaignTargetingMode;
  readonly executionMode: CampaignExecutionMode;
  readonly productionSharingEnabled: boolean;
  readonly marketingConsentGranted: boolean;
}

export type ProviderDataSharingDecision = {
  readonly allowed: false;
  readonly code: string;
  readonly reason: string;
};

/**
 * OD9C-C fail-closed policy. MARKETING consent is not Ads sharing permission.
 * Phase 9C-B never returns allowed=true for customer-identifier sharing.
 */
export function canShareProviderCustomerData(
  input: ProviderDataSharingInput
): ProviderDataSharingDecision {
  void input.provider;
  void input.executionMode;

  if (input.targetingMode === "direct_or_custom" && !input.productionSharingEnabled) {
    return {
      allowed: false,
      code: "PROVIDER_CUSTOM_EXPORT_DISABLED",
      reason:
        "direct_or_custom provider export is disabled while the production sharing gate is OFF. This does not silently switch to broad_public.",
    };
  }

  if (input.marketingConsentGranted && !input.productionSharingEnabled) {
    return {
      allowed: false,
      code: "MARKETING_CONSENT_NOT_PROVIDER_SHARING",
      reason: "MARKETING consent alone does not authorize Ads identifier sharing.",
    };
  }

  if (!input.productionSharingEnabled) {
    return {
      allowed: false,
      code: "PROVIDER_DATA_SHARING_GATE_OFF",
      reason: "Provider customer-data sharing remains fail-closed (Phase 10 gate).",
    };
  }

  return {
    allowed: false,
    code: "PROVIDER_CUSTOMER_DATA_TRANSPORT_BLOCKED_IN_9C_C",
    reason:
      "Phase 9C-C implements adapters but still blocks outbound CRM identifier transport until Phase 10 production/privacy gates.",
  };
}
