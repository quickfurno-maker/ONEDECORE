/**
 * Phase 9A — campaign version lifecycle (ADR-0027). Execution states belong to 9C.
 */

export const CAMPAIGN_LIFECYCLE_STATES = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
] as const;

export type CampaignLifecycleState = (typeof CAMPAIGN_LIFECYCLE_STATES)[number];

export const CAMPAIGN_TERMINAL_STATES = ["approved", "rejected"] as const;

export type CampaignTerminalState = (typeof CAMPAIGN_TERMINAL_STATES)[number];

export function isCampaignTerminalState(
  state: CampaignLifecycleState
): state is CampaignTerminalState {
  return (CAMPAIGN_TERMINAL_STATES as readonly string[]).includes(state);
}
