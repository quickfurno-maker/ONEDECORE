import type { CrmRoleCode } from "../../../crm/contracts/permissions.ts";
import type { CampaignRunState } from "../contracts/run-lifecycle.ts";
import {
  canRequestCancel,
  canRequestPause,
  canRequestResume,
} from "../contracts/run-lifecycle.ts";

export interface CampaignExecutionCapabilities {
  readonly canExecuteCampaign: boolean;
  readonly canPauseCampaign: boolean;
  readonly canCancelCampaign: boolean;
  readonly canReadCampaignMetrics: boolean;
}

export function resolveCampaignExecutionCapabilities(
  role: CrmRoleCode
): CampaignExecutionCapabilities {
  const staff = role === "super_admin" || role === "sales_manager";
  return {
    canExecuteCampaign: staff,
    canPauseCampaign: staff,
    canCancelCampaign: role === "super_admin",
    canReadCampaignMetrics: staff,
  };
}

export function visibleRunControls(
  role: CrmRoleCode,
  state: CampaignRunState
): {
  readonly showPause: boolean;
  readonly showResume: boolean;
  readonly showCancel: boolean;
} {
  const caps = resolveCampaignExecutionCapabilities(role);
  return {
    showPause: caps.canPauseCampaign && canRequestPause(state),
    showResume: caps.canPauseCampaign && canRequestResume(state),
    showCancel: caps.canCancelCampaign && canRequestCancel(state),
  };
}
