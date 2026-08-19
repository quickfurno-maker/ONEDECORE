import "server-only";

import { getStaffClaims } from "@/server/auth/session";
import { probeCampaignPermissions } from "../../server/campaign-permissions.ts";
import {
  evaluateManualCampaignDispatchAuth,
  type ManualDispatchAuthResult,
} from "../domain/manual-dispatch-auth.ts";

export async function authorizeManualCampaignDispatch(): Promise<ManualDispatchAuthResult> {
  const session = await getStaffClaims();
  if (!session) {
    return evaluateManualCampaignDispatchAuth({
      hasActiveStaffSession: false,
      canExecuteCampaigns: false,
    });
  }
  const probe = await probeCampaignPermissions();
  return evaluateManualCampaignDispatchAuth({
    hasActiveStaffSession: true,
    canExecuteCampaigns: probe.canExecuteCampaigns,
  });
}
