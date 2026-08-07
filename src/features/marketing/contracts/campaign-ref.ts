/**
 * Phase 9 migration-independent — campaign reference contracts.
 */

const CAMPAIGN_REF_PATTERN = /^OD-C-[A-Z0-9-]{6,40}$/;

export interface CampaignRef {
  readonly campaignReference: string;
}

export interface CampaignVersionRef {
  readonly campaignReference: string;
  readonly versionNumber: number;
}

export function validateCampaignReference(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 10) return "Campaign reference must be at least 10 characters.";
  if (!CAMPAIGN_REF_PATTERN.test(trimmed)) {
    return "Campaign reference must match OD-C-* pattern.";
  }
  return null;
}

export function createCampaignVersionRef(input: CampaignVersionRef): CampaignVersionRef {
  const refError = validateCampaignReference(input.campaignReference);
  if (refError) throw new Error(refError);
  if (input.versionNumber < 1 || input.versionNumber > 9999) {
    throw new Error("Campaign version number must be between 1 and 9999.");
  }
  return input;
}
