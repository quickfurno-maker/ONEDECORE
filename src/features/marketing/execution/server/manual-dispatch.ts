import "server-only";

import type { CampaignActionCode } from "../../server/campaign-errors.ts";
import { getCampaignExecutionMode } from "./execution-env.ts";
import { dispatchCampaignRunOperations, type DispatchResult } from "./dispatcher.ts";
import type { ManualDispatchAuthResult } from "../domain/manual-dispatch-auth.ts";
import type { CampaignExecutionMode } from "../contracts/execution-mode.ts";

export interface ManualMockDispatchResult {
  readonly success: boolean;
  readonly message: string;
  readonly code?: CampaignActionCode;
}

export interface ManualMockDispatchDeps {
  readonly authorize?: () => Promise<ManualDispatchAuthResult>;
  readonly getMode?: () => CampaignExecutionMode;
  readonly dispatch?: () => Promise<DispatchResult>;
}

export async function executeAuthorizedManualMockDispatch(
  deps: ManualMockDispatchDeps = {}
): Promise<ManualMockDispatchResult> {
  const authorize =
    deps.authorize ??
    (await import("./manual-dispatch-auth.ts")).authorizeManualCampaignDispatch;
  const auth = await authorize();
  if (!auth.ok) {
    return { success: false, message: auth.message, code: auth.code };
  }

  const getMode = deps.getMode ?? getCampaignExecutionMode;
  const mode = getMode();
  if (mode === "sandbox" || mode === "live") {
    return {
      success: false,
      message: "Sandbox/live Ads adapters are not implemented in Phase 9C-B.",
      code: "CAMPAIGN_PROVIDER_ADAPTER_NOT_IMPLEMENTED",
    };
  }
  if (mode === "disabled") {
    return { success: true, message: "Execution mode is DISABLED. No dispatch." };
  }

  const dispatch =
    deps.dispatch ?? (() => dispatchCampaignRunOperations({ maxBatch: 5, workerId: "admin-manual" }));
  const result = await dispatch();
  return {
    success: true,
    message: `Mock dispatch processed ${result.processed} operation(s). No live provider writes.`,
  };
}
