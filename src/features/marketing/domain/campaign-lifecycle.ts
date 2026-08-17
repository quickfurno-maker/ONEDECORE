/**
 * Phase 9A — campaign version lifecycle transitions (ADR-0027).
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
  draft: ["pending_approval"],
  pending_approval: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

export function validateCampaignLifecycleTransition(
  input: CampaignLifecycleTransitionInput
): CampaignLifecycleTransitionResult {
  const allowedTargets = TRANSITIONS[input.from] ?? [];
  if (!allowedTargets.includes(input.to)) {
    return {
      allowed: false,
      reason: `Transition from ${input.from} to ${input.to} is not permitted in Phase 9A.`,
    };
  }

  if (input.to === "pending_approval" && !input.capabilities.canRequestCampaignApproval) {
    return { allowed: false, reason: "Actor cannot request campaign approval." };
  }

  if (
    (input.to === "approved" || input.to === "rejected") &&
    !input.capabilities.canApproveCampaign
  ) {
    return { allowed: false, reason: "Actor cannot decide this campaign version." };
  }

  return { allowed: true };
}
