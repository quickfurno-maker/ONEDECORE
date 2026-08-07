/**
 * Phase 9A migration-independent — campaign draft validators (no provider mutation).
 */

import type { CampaignBudgetConfig } from "../contracts/budget.ts";
import { validateCampaignBudgetConfig } from "../contracts/budget.ts";
import type { CampaignCreativeSnapshot } from "../contracts/creative-snapshot.ts";
import { validateCampaignCreativeSnapshot } from "../contracts/creative-snapshot.ts";
import type { CampaignTargetingMode } from "../contracts/targeting.ts";

export interface CampaignDraftConfig {
  readonly targetingMode: CampaignTargetingMode;
  readonly budgetConfig: CampaignBudgetConfig;
  readonly landingPublicationRef: string;
  readonly creative: CampaignCreativeSnapshot | null;
}

export function validateCampaignDraftConfig(
  config: CampaignDraftConfig
): string | null {
  const budgetError = validateCampaignBudgetConfig(config.budgetConfig);
  if (budgetError) return budgetError;

  if (!config.landingPublicationRef.trim()) {
    return "Exact landing publication destination is required.";
  }

  if (!config.creative) return "Creative snapshot is required before approval.";

  const creativeError = validateCampaignCreativeSnapshot(config.creative);
  if (creativeError) return creativeError;

  if (config.creative.targetingMode !== config.targetingMode) {
    return "Creative snapshot targeting mode must match campaign draft.";
  }

  return null;
}
