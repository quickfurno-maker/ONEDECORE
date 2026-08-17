/**
 * Phase 9A — campaign draft validators (no provider mutation, no landing FK).
 */

import type { CampaignBudgetSnapshot, CampaignIntendedWindowSnapshot } from "../contracts/budget.ts";
import { validateCampaignBudgetSnapshot, validateCampaignIntendedWindowSnapshot } from "../contracts/budget.ts";
import type { CampaignCreativeSnapshot } from "../contracts/creative-snapshot.ts";
import { validateCampaignCreativeSnapshot } from "../contracts/creative-snapshot.ts";
import type { CampaignTargetingMode } from "../contracts/targeting.ts";
import type { MarketingChannel } from "../contracts/channel.ts";
import { MARKETING_CHANNELS } from "../contracts/channel.ts";
import type { AudienceRuleGroup } from "../contracts/audience-rule.ts";
import { validateAudienceRuleGroup } from "./audience-rule-engine.ts";

export interface CampaignDraftConfig {
  readonly name?: string;
  readonly title: string;
  readonly targetingMode: CampaignTargetingMode;
  readonly intendedChannels: readonly MarketingChannel[];
  readonly destinationReference: string | null;
  readonly budgetSnapshot: CampaignBudgetSnapshot;
  readonly creative: CampaignCreativeSnapshot;
  readonly intendedWindow: CampaignIntendedWindowSnapshot;
  readonly ruleGroup: AudienceRuleGroup;
}

export function validateCampaignDraftConfig(
  config: CampaignDraftConfig
): string | null {
  if (config.title.trim().length < 2 || config.title.trim().length > 160) {
    return "Title must be between 2 and 160 characters.";
  }
  if (config.intendedChannels.length < 1 || config.intendedChannels.length > 4) {
    return "Intended channels must contain 1 to 4 unique values.";
  }
  const unique = new Set(config.intendedChannels);
  if (unique.size !== config.intendedChannels.length) {
    return "Intended channels must be unique.";
  }
  for (const channel of config.intendedChannels) {
    if (!(MARKETING_CHANNELS as readonly string[]).includes(channel)) {
      return "Intended channel is not in the Phase 9A allowlist.";
    }
  }
  if (config.destinationReference != null) {
    const dest = config.destinationReference.trim();
    if (dest.length > 500 || /[\u0000-\u001f]/.test(dest)) {
      return "Destination reference must be an opaque string up to 500 characters.";
    }
  }

  const budgetError = validateCampaignBudgetSnapshot(config.budgetSnapshot);
  if (budgetError) return budgetError;
  const windowError = validateCampaignIntendedWindowSnapshot(config.intendedWindow);
  if (windowError) return windowError;
  const creativeError = validateCampaignCreativeSnapshot(config.creative);
  if (creativeError) return creativeError;
  return validateAudienceRuleGroup(config.ruleGroup);
}
