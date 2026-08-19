export const CAMPAIGN_EXECUTION_MODES = [
  "disabled",
  "mock",
  "sandbox",
  "live",
] as const;

export type CampaignExecutionMode = (typeof CAMPAIGN_EXECUTION_MODES)[number];
