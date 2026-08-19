/**
 * Phase 9C-B — canonical campaign run lifecycle (ADR-0031).
 */

export const PAID_ADS_CHANNELS = ["meta_ads", "google_ads"] as const;
export type PaidAdsChannel = (typeof PAID_ADS_CHANNELS)[number];

export const DEFERRED_MARKETING_CHANNELS = ["email", "whatsapp"] as const;
export type DeferredMarketingChannel = (typeof DEFERRED_MARKETING_CHANNELS)[number];

export const CAMPAIGN_RUN_STATES = [
  "scheduled",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;

export type CampaignRunState = (typeof CAMPAIGN_RUN_STATES)[number];

export const CAMPAIGN_RUN_TERMINAL_STATES = ["completed", "failed", "cancelled"] as const;
export type CampaignRunTerminalState = (typeof CAMPAIGN_RUN_TERMINAL_STATES)[number];

export const CAMPAIGN_OPERATION_TYPES = [
  "create",
  "activate",
  "pause",
  "resume",
  "cancel",
  "sync",
] as const;

export type CampaignOperationType = (typeof CAMPAIGN_OPERATION_TYPES)[number];

export const CAMPAIGN_OPERATION_STATES = [
  "pending",
  "claimed",
  "succeeded",
  "failed",
  "needs_reconcile",
  "cancelled",
] as const;

export type CampaignOperationState = (typeof CAMPAIGN_OPERATION_STATES)[number];

export type CampaignRunTransitionResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

const ACK_TRANSITIONS: Readonly<Record<CampaignRunState, readonly CampaignRunState[]>> = {
  scheduled: ["running", "failed", "cancelled"],
  running: ["paused", "completed", "failed", "cancelled"],
  paused: ["running", "cancelled", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
};

export function isPaidAdsChannel(value: string): value is PaidAdsChannel {
  return (PAID_ADS_CHANNELS as readonly string[]).includes(value);
}

export function isCampaignRunTerminal(state: CampaignRunState): boolean {
  return (CAMPAIGN_RUN_TERMINAL_STATES as readonly string[]).includes(state);
}

export function validateCampaignRunTransition(
  from: CampaignRunState,
  to: CampaignRunState
): CampaignRunTransitionResult {
  const allowed = ACK_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason: `Transition from ${from} to ${to} is not permitted.`,
    };
  }
  return { allowed: true };
}

export function canRequestPause(state: CampaignRunState): boolean {
  return state === "running";
}

export function canRequestResume(state: CampaignRunState): boolean {
  return state === "paused";
}

export function canRequestCancel(state: CampaignRunState): boolean {
  return !isCampaignRunTerminal(state);
}
