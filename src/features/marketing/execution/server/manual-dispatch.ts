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
  if (mode === "live") {
    return {
      success: false,
      message: "Live campaign execution remains fail-closed until Phase 10 production activation.",
      code: "CAMPAIGN_PRODUCTION_GATE_OFF",
    };
  }
  if (mode === "sandbox") {
    return {
      success: false,
      message: "Sandbox Ads transport is unavailable without an explicit sandbox transport gate.",
      code: "CAMPAIGN_SANDBOX_TRANSPORT_UNAVAILABLE",
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
