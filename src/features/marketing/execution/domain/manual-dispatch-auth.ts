import type { CampaignActionCode } from "../../server/campaign-errors.ts";

export interface ManualDispatchAuthInput {
  readonly hasActiveStaffSession: boolean;
  readonly canExecuteCampaigns: boolean;
}

export type ManualDispatchAuthResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: CampaignActionCode; readonly message: string };

export function evaluateManualCampaignDispatchAuth(
  input: ManualDispatchAuthInput
): ManualDispatchAuthResult {
  if (!input.hasActiveStaffSession || !input.canExecuteCampaigns) {
    return {
      ok: false,
      code: "CAMPAIGN_UNAUTHORIZED",
      message: "Active staff with campaigns.execute is required for manual mock dispatch.",
    };
  }
  return { ok: true };
}
