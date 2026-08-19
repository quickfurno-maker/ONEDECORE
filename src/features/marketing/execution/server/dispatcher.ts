import "server-only";

import { createAdminClient } from "../../../../lib/supabase/service-role.ts";
import { resolveCampaignExecutionProvider } from "./provider-factory.ts";
import type { CampaignProviderCommand, CampaignProviderOutcome } from "./provider-port.ts";
import type { PaidAdsChannel } from "../contracts/run-lifecycle.ts";
import type { CampaignOperationType } from "../contracts/run-lifecycle.ts";

const DEFAULT_BATCH = 5;
const MAX_BATCH = 10;

export interface DispatchResult {
  readonly mode: string;
  readonly processed: number;
  readonly outcomes: readonly string[];
  readonly code?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export type CampaignExecutionAdmin = ReturnType<typeof createAdminClient>;

export async function dispatchCampaignRunOperations(options?: {
  readonly maxBatch?: number;
  readonly workerId?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly admin?: CampaignExecutionAdmin;
}): Promise<DispatchResult> {
  const env = options?.env ?? process.env;
  const resolved = resolveCampaignExecutionProvider(env);
  if (!resolved.ok) {
    return {
      mode: String(env.ONEDECORE_CAMPAIGN_EXECUTION_MODE ?? "disabled"),
      processed: 0,
      outcomes: [],
      code: resolved.code,
    };
  }

  const maxBatch = Math.max(1, Math.min(options?.maxBatch ?? DEFAULT_BATCH, MAX_BATCH));
  const workerId = (options?.workerId ?? "campaign-execution-worker").slice(0, 80);
  const admin = options?.admin ?? createAdminClient();
  const outcomes: string[] = [];
  let processed = 0;

  for (let i = 0; i < maxBatch; i += 1) {
    const { data, error } = await admin.rpc("claim_campaign_run_operation", {
      p_worker_id: workerId,
      p_claim_ttl_seconds: 120,
    });
    if (error) throw error;
    const claim = asRecord(data);
    const outcomeCode = String(claim.outcome_code ?? "none");
    if (outcomeCode === "none") break;
    if (outcomeCode === "needs_reconcile") {
      outcomes.push("needs_reconcile");
      processed += 1;
      continue;
    }

    const operationId = String(claim.operation_id);
    const operationType = String(claim.operation_type) as CampaignOperationType;
    const runId = String(claim.campaign_run_id);
    const targetId = String(claim.campaign_run_target_id);

    const { data: runRow } = await admin
      .from("campaign_runs")
      .select("run_reference, provider_channel")
      .eq("id", runId)
      .maybeSingle();
    const { data: targetRow } = await admin
      .from("campaign_run_targets")
      .select("run_target_reference, provider_campaign_id")
      .eq("id", targetId)
      .maybeSingle();

    const command: CampaignProviderCommand = {
      operationType,
      operationKey: String(claim.operation_key),
      providerChannel: String(runRow?.provider_channel) as PaidAdsChannel,
      runReference: String(runRow?.run_reference),
      runTargetReference: String(targetRow?.run_target_reference),
      boundProviderCampaignId: targetRow?.provider_campaign_id ?? null,
    };

    const provider = resolved.provider;
    let providerResult: CampaignProviderOutcome;
    if (operationType === "create") providerResult = await provider.create(command);
    else if (operationType === "activate") providerResult = await provider.activate(command);
    else if (operationType === "pause") providerResult = await provider.pause(command);
    else if (operationType === "resume") providerResult = await provider.resume(command);
    else if (operationType === "cancel") providerResult = await provider.cancel(command);
    else {
      const status = await provider.getStatus(command);
      providerResult =
        status.kind === "found"
          ? {
              kind: "success",
              providerCampaignId: status.providerCampaignId,
              providerStatus: status.providerStatus,
            }
          : { kind: "validation_failure", errorCode: status.errorCode };
    }

    if (providerResult.kind === "timeout_unknown") {
      await admin.rpc("mark_campaign_run_operation_needs_reconcile", {
        p_operation_id: operationId,
        p_error_code: providerResult.errorCode,
      });
      outcomes.push("needs_reconcile");
    } else if (providerResult.kind === "transient_failure") {
      await admin.rpc("fail_campaign_run_operation", {
        p_operation_id: operationId,
        p_error_code: providerResult.errorCode,
        p_retry: true,
      });
      outcomes.push("retry");
    } else if (providerResult.kind === "validation_failure") {
      await admin.rpc("fail_campaign_run_operation", {
        p_operation_id: operationId,
        p_error_code: providerResult.errorCode,
        p_retry: false,
      });
      outcomes.push("failed");
    } else if (providerResult.kind === "success") {
      if (operationType === "create" || operationType === "activate") {
        await admin.rpc("bind_campaign_run_operation", {
          p_operation_id: operationId,
          p_provider_campaign_id: providerResult.providerCampaignId,
          p_provider_ad_set_id: providerResult.providerAdSetId ?? null,
          p_provider_ad_group_id: providerResult.providerAdGroupId ?? null,
          p_provider_status: providerResult.providerStatus,
        });
      }
      await admin.rpc("complete_campaign_run_operation", {
        p_operation_id: operationId,
        p_outcome_code: "mock_ok",
        p_safe_metadata: { mock: true },
      });
      outcomes.push("succeeded");
    }
    processed += 1;
  }

  return {
    mode: "mock",
    processed,
    outcomes,
  };
}

export async function reconcileCampaignRunOperation(
  operationId: string,
  options?: {
    readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
    readonly admin?: CampaignExecutionAdmin;
  }
): Promise<string> {
  const env = options?.env ?? process.env;
  const resolved = resolveCampaignExecutionProvider(env);
  if (!resolved.ok) return resolved.code;
  const admin = options?.admin ?? createAdminClient();
  const { data, error } = await admin.rpc("get_campaign_run_operation_for_reconcile", {
    p_operation_id: operationId,
  });
  if (error) throw error;
  const row = asRecord(data);
  if (String(row.outcome_code) !== "found") {
    return String(row.outcome_code ?? "not_found");
  }
  if (String(row.operation_type) !== "create") {
    return "reconcile_not_found";
  }
  const status = await resolved.provider.getStatus({
    operationType: "create",
    operationKey: String(row.operation_key),
    providerChannel: String(row.provider_channel) as PaidAdsChannel,
    runReference: String(row.run_reference),
    runTargetReference: String(row.run_target_reference),
    boundProviderCampaignId: (row.provider_campaign_id as string | null) ?? null,
  });
  if (status.kind === "found") {
    const { error: resolveError } = await admin.rpc("resolve_campaign_run_create_reconcile_found", {
      p_operation_id: operationId,
      p_provider_campaign_id: status.providerCampaignId,
      p_provider_status: status.providerStatus,
    });
    if (resolveError) throw resolveError;
    return "reconcile_found";
  }
  return "reconcile_not_found";
}
