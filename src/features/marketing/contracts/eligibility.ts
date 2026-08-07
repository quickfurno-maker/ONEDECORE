/**
 * Phase 9 migration-independent — marketing eligibility decision contracts.
 */

export const AUDIENCE_ELIGIBILITY_CODES = [
  "ELIGIBLE",
  "DENIED_NO_MARKETING_CONSENT",
  "DENIED_DNC",
  "DENIED_SUPPRESSION",
  "DENIED_CHANNEL_INELIGIBLE",
  "DENIED_TARGETING_MODE",
  "DENIED_BROAD_PUBLIC_CRM_EXPORT",
] as const;

export type AudienceEligibilityCode = (typeof AUDIENCE_ELIGIBILITY_CODES)[number];

export interface AudienceEligibilityDecision {
  readonly eligible: boolean;
  readonly code: AudienceEligibilityCode;
  readonly reason: string;
}

export interface MarketingEligibilityInput {
  readonly targetingMode: import("./targeting.ts").CampaignTargetingMode;
  readonly marketingConsentGranted: boolean;
  readonly marketingConsentWithdrawn: boolean;
  readonly onDoNotContactList: boolean;
  readonly suppressed: boolean;
  readonly channelEligible: boolean;
  readonly includesCrmPiiExport: boolean;
}
