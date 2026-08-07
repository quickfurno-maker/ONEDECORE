/**
 * Phase 9A migration-independent — in-memory campaign fixtures (no provider execution).
 */

import type { CampaignDraftConfig } from "../domain/campaign-validators.ts";
import { freezeAudienceVersion } from "../domain/audience-version.ts";

export const SAMPLE_AUDIENCE_VERSION = freezeAudienceVersion({
  audienceVersionId: "aud-v-0001",
  ruleGroup: {
    logic: "and",
    rules: [
      { field: "lead_stage", operator: "in", values: ["qualified", "proposal"] },
    ],
  },
  frozenByProfileId: "sm-001",
  frozenAt: "2026-08-07T10:00:00.000Z",
});

export const SAMPLE_CAMPAIGN_DRAFT: CampaignDraftConfig = {
  targetingMode: "direct_or_custom",
  budgetConfig: {
    currency: "INR",
    dailyBudgetPaise: 500000,
    totalBudgetPaise: 15000000,
    startDate: "2026-09-01",
    endDate: "2026-09-30",
  },
  landingPublicationRef: "OD-LP-PUB-2026-0001",
  creative: null,
};
