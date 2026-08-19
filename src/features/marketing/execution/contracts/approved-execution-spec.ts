import type { PaidAdsChannel } from "./run-lifecycle.ts";

export const CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE =
  "CAMPAIGN_APPROVED_SNAPSHOT_PROVIDER_INCOMPATIBLE";

export interface CampaignApprovedBudget {
  readonly currency: string;
  readonly dailyBudgetPaise: number;
  readonly totalBudgetPaise: number | null;
}

export interface CampaignApprovedCreative {
  readonly headline: string;
  readonly primaryText: string;
  readonly callToAction: string;
  readonly mediaReferences: readonly string[];
  readonly headlines: readonly string[];
  readonly descriptions: readonly string[];
  readonly keywords: readonly string[];
  readonly geoCountryCodes: readonly string[];
}

export interface CampaignApprovedWindow {
  readonly startDate: string;
  readonly endDate: string | null;
}

export interface CampaignApprovedDestination {
  readonly reference: string;
  readonly finalHttpsUrl: string | null;
}

export interface CampaignApprovedExecutionSpec {
  readonly campaignVersionId: string;
  readonly configurationHash: string;
  readonly providerChannel: PaidAdsChannel;
  readonly targetingMode: string;
  readonly budget: CampaignApprovedBudget;
  readonly creative: CampaignApprovedCreative;
  readonly intendedWindow: CampaignApprovedWindow;
  readonly destination: CampaignApprovedDestination;
}

export const APPROVED_SPEC_HASH_PATTERN = /^[0-9a-f]{64}$/;
export const HTTPS_URL_PATTERN = /^https:\/\/[^\s]+$/i;
