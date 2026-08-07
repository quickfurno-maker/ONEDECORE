/**
 * Phase 9 migration-independent — campaign targeting mode contracts.
 */

export const CAMPAIGN_TARGETING_MODES = [
  "broad_public",
  "direct_or_custom",
] as const;

export type CampaignTargetingMode = (typeof CAMPAIGN_TARGETING_MODES)[number];

export const TARGETING_MODE_LABELS: Record<CampaignTargetingMode, string> = {
  broad_public: "Broad public (no CRM member export)",
  direct_or_custom: "Direct/custom (MARKETING consent + DNC required)",
};

export function requiresMarketingConsent(mode: CampaignTargetingMode): boolean {
  return mode === "direct_or_custom";
}

export function allowsCrmMemberExport(mode: CampaignTargetingMode): boolean {
  return mode === "direct_or_custom";
}
