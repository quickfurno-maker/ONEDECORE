/**
 * Phase 9 migration-independent — immutable creative execution snapshot.
 */

import type { CampaignBudgetConfig } from "./budget.ts";
import type { CampaignTargetingMode } from "./targeting.ts";
import type { CampaignVersionRef } from "./campaign-ref.ts";

export interface CampaignCreativeSnapshot {
  readonly campaignVersion: CampaignVersionRef;
  readonly headline: string;
  readonly primaryText: string;
  readonly callToAction: string;
  readonly mediaPlaceholderRefs: readonly string[];
  readonly landingPublicationRef: string;
  readonly landingPageVersionRef: string;
  readonly audienceVersionId: string;
  readonly audienceRuleHash: string;
  readonly targetingMode: CampaignTargetingMode;
  readonly budgetConfig: CampaignBudgetConfig;
  readonly humanAuthorizationPlaceholder: string | null;
  readonly capturedAt: string;
}

export function validateCampaignCreativeSnapshot(
  snapshot: CampaignCreativeSnapshot
): string | null {
  if (!snapshot.headline.trim()) return "Headline is required.";
  if (!snapshot.primaryText.trim()) return "Primary text is required.";
  if (!snapshot.callToAction.trim()) return "Call to action is required.";
  if (!snapshot.landingPublicationRef.trim()) {
    return "Exact landing publication reference is required.";
  }
  if (!snapshot.audienceRuleHash.trim()) return "Audience rule hash is required.";
  return null;
}
