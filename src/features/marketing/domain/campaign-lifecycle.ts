/**
 * Phase 9A migration-independent — campaign version lifecycle transitions.
 */

import type { CampaignLifecycleState } from "../contracts/lifecycle.ts";
import type { CampaignPermissionCapabilities } from "./campaign-capabilities.ts";

export interface CampaignLifecycleTransitionInput {
  readonly from: CampaignLifecycleState;
  readonly to: CampaignLifecycleState;
  readonly capabilities: CampaignPermissionCapabilities;
}

export type CampaignLifecycleTransitionResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

const TRANSITIONS: Readonly<Record<CampaignLifecycleState, readonly CampaignLifecycleState[]>> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "rejected", "draft"],
  approved: ["scheduled", "cancelled"],
  rejected: ["draft", "cancelled"],
  scheduled: ["paused", "completed", "cancelled"],
  paused: ["scheduled", "cancelled"],
  completed: [],
  cancelled: [],
};

export function validateCampaignLifecycleTransition(
  input: CampaignLifecycleTransitionInput
): CampaignLifecycleTransitionResult {
  const allowedTargets = TRANSITIONS[input.from] ?? [];
  if (!allowedTargets.includes(input.to)) {
    return {
      allowed: false,
      reason: `Transition from ${input.from} to ${input.to} is not permitted.`,
    };
  }

  if (input.to === "pending_approval" && !input.capabilities.canRequestCampaignApproval) {
    return { allowed: false, reason: "Actor cannot request campaign approval." };
  }

  if (input.to === "approved" && !input.capabilities.canApproveCampaign) {
    return { allowed: false, reason: "Actor cannot approve campaign versions." };
  }

  if (
    (input.to === "scheduled" || input.to === "paused") &&
    !input.capabilities.canPublishLater
  ) {
    return { allowed: false, reason: "Actor cannot schedule or pause campaigns." };
  }

  return { allowed: true };
}
