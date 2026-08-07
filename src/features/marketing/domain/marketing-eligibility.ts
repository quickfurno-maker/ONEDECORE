/**
 * Phase 9A migration-independent — pure marketing eligibility evaluation.
 * Uses supplied consent/DNC flags only; WHATSAPP_SERVICE does not imply MARKETING.
 */

import type {
  AudienceEligibilityDecision,
  MarketingEligibilityInput,
} from "../contracts/eligibility.ts";
import { requiresMarketingConsent } from "../contracts/targeting.ts";

export function evaluateMarketingEligibility(
  input: MarketingEligibilityInput
): AudienceEligibilityDecision {
  if (input.targetingMode === "broad_public" && input.includesCrmPiiExport) {
    return {
      eligible: false,
      code: "DENIED_BROAD_PUBLIC_CRM_EXPORT",
      reason: "Broad public targeting cannot include CRM member export.",
    };
  }

  if (input.targetingMode === "direct_or_custom") {
    if (input.onDoNotContactList) {
      return {
        eligible: false,
        code: "DENIED_DNC",
        reason: "Contact is on the do-not-contact list.",
      };
    }

    if (input.suppressed) {
      return {
        eligible: false,
        code: "DENIED_SUPPRESSION",
        reason: "Contact or channel is suppressed.",
      };
    }

    if (!input.channelEligible) {
      return {
        eligible: false,
        code: "DENIED_CHANNEL_INELIGIBLE",
        reason: "Channel is not eligible for marketing outreach.",
      };
    }

    const hasCurrentMarketingConsent =
      input.marketingConsentGranted && !input.marketingConsentWithdrawn;

    if (!hasCurrentMarketingConsent) {
      return {
        eligible: false,
        code: "DENIED_NO_MARKETING_CONSENT",
        reason: "Explicit current MARKETING consent is required.",
      };
    }
  }

  if (
    input.targetingMode === "broad_public" &&
    requiresMarketingConsent(input.targetingMode)
  ) {
    return {
      eligible: false,
      code: "DENIED_TARGETING_MODE",
      reason: "Targeting mode configuration is inconsistent.",
    };
  }

  return {
    eligible: true,
    code: "ELIGIBLE",
    reason: "Recipient meets marketing eligibility rules for the targeting mode.",
  };
}
