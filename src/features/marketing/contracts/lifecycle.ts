/**
 * Phase 9 migration-independent — campaign version lifecycle (no provider execution).
 */

export const CAMPAIGN_LIFECYCLE_STATES = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "scheduled",
  "paused",
  "completed",
  "cancelled",
] as const;

export type CampaignLifecycleState = (typeof CAMPAIGN_LIFECYCLE_STATES)[number];

export const CAMPAIGN_TERMINAL_STATES = [
  "rejected",
  "completed",
  "cancelled",
] as const;

export type CampaignTerminalState = (typeof CAMPAIGN_TERMINAL_STATES)[number];

export function isCampaignTerminalState(
  state: CampaignLifecycleState
): state is CampaignTerminalState {
  return (CAMPAIGN_TERMINAL_STATES as readonly string[]).includes(state);
}
