/**
 * Phase 9A — in-memory campaign fixtures (no provider execution).
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
  title: "Diwali interiors",
  targetingMode: "direct_or_custom",
  intendedChannels: ["email", "whatsapp"],
  destinationReference: "opaque-dest-001",
  budgetSnapshot: {
    currency: "INR",
    dailyBudgetPaise: 500000,
    totalBudgetPaise: 15000000,
  },
  intendedWindow: {
    startDate: "2026-09-01",
    endDate: "2026-09-30",
  },
  creative: {
    headline: "Complete home interiors",
    primaryText: "Book a consultation for Diwali-ready interiors.",
    callToAction: "Enquire",
    mediaReferences: ["media-opaque-1"],
  },
  ruleGroup: {
    logic: "and",
    rules: [{ field: "lead_stage", operator: "in", values: ["qualified", "proposal"] }],
  },
};
