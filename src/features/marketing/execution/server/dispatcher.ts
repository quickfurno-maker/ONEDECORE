import "server-only";

import { createAdminClient } from "../../../../lib/supabase/service-role.ts";
import { getCampaignExecutionMode } from "./execution-env.ts";
import { resolveCampaignExecutionProvider } from "./provider-factory.ts";
import type { CampaignConversionFeedbackCommand } from "../contracts/conversion-feedback.ts";
import type { CampaignProviderCommand, CampaignProviderOutcome } from "./provider-port.ts";
import type { PaidAdsChannel } from "../contracts/run-lifecycle.ts";
import type { CampaignOperationType } from "../contracts/run-lifecycle.ts";
import type { ConversionFeedbackType } from "../contracts/conversion-feedback.ts";

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
      .select("run_reference, provider_channel, targeting_mode")
      .eq("id", runId)
      .maybeSingle();
    const { data: targetRow } = await admin
      .from("campaign_run_targets")
      .select("run_target_reference, provider_campaign_id")
      .eq("id", targetId)
      .maybeSingle();

    const channel = String(runRow?.provider_channel) as PaidAdsChannel;
    const resolvedForChannel = resolveCampaignExecutionProvider(env, { channel });
    if (!resolvedForChannel.ok) {
      await admin.rpc("fail_campaign_run_operation", {
        p_operation_id: operationId,
        p_error_code: resolvedForChannel.code,
        p_retry: false,
      });
      outcomes.push("failed");
      processed += 1;
      continue;
    }

    if (
      (operationType === "create" || operationType === "activate") &&
      String(runRow?.targeting_mode) === "direct_or_custom"
    ) {
      await admin.rpc("fail_campaign_run_operation", {
        p_operation_id: operationId,
        p_error_code: "PROVIDER_CUSTOM_EXPORT_DISABLED",
        p_retry: false,
      });
      outcomes.push("failed");
      processed += 1;
      continue;
    }

    const command: CampaignProviderCommand = {
      operationType,
      operationKey: String(claim.operation_key),
      providerChannel: channel,
      runReference: String(runRow?.run_reference),
      runTargetReference: String(targetRow?.run_target_reference),
      boundProviderCampaignId: targetRow?.provider_campaign_id ?? null,
    };

    const provider = resolvedForChannel.provider;

    if (operationType === "metrics_sync") {
      const windowEnd = new Date();
      const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);
      const metrics = await provider.fetchMetrics(command, {
        windowStartIso: windowStart.toISOString(),
        windowEndIso: windowEnd.toISOString(),
      });
      if (metrics.kind === "success") {
        await admin.rpc("upsert_campaign_metric_snapshot", {
          p_campaign_run_target_id: targetId,
          p_window_start: windowStart.toISOString(),
          p_window_end: windowEnd.toISOString(),
          p_currency: metrics.snapshot.currency,
          p_spend_minor: metrics.snapshot.spendMinor,
          p_impressions: metrics.snapshot.impressions,
          p_clicks: metrics.snapshot.clicks,
          p_provider_conversions: metrics.snapshot.providerConversions,
          p_provider_revision: metrics.snapshot.providerRevision ?? undefined,
        });
        await admin.rpc("complete_campaign_run_operation", {
          p_operation_id: operationId,
          p_outcome_code: "metrics_ok",
          p_safe_metadata: { mock: provider.code === "mock" },
        });
        outcomes.push("succeeded");
      } else if (metrics.kind === "transient_failure") {
        await admin.rpc("fail_campaign_run_operation", {
          p_operation_id: operationId,
          p_error_code: metrics.errorCode,
          p_retry: true,
        });
        outcomes.push("retry");
      } else if (metrics.kind === "timeout_unknown") {
        await admin.rpc("mark_campaign_run_operation_needs_reconcile", {
          p_operation_id: operationId,
          p_error_code: metrics.errorCode,
        });
        outcomes.push("needs_reconcile");
      } else {
        await admin.rpc("fail_campaign_run_operation", {
          p_operation_id: operationId,
          p_error_code: metrics.errorCode,
          p_retry: false,
        });
        outcomes.push("failed");
      }
      processed += 1;
      continue;
    }

    if (operationType === "conversion_feedback") {
      const eventId = String(claim.operation_key).startsWith("conversion_feedback:")
        ? String(claim.operation_key).slice("conversion_feedback:".length)
        : "";
      const { data: eventRow } = await admin
        .from("campaign_conversion_feedback_events")
        .select(
          "event_reference, conversion_type, conversion_occurred_at, attribution_state, value_minor, currency, provider_channel"
        )
        .eq("id", eventId)
        .maybeSingle();
      const event = asRecord(eventRow);
      if (String(event.attribution_state) !== "attributable") {
        await admin.rpc("fail_campaign_run_operation", {
          p_operation_id: operationId,
          p_error_code: "CAMPAIGN_FEEDBACK_NOT_ATTRIBUTABLE",
          p_retry: false,
        });
        outcomes.push("failed");
        processed += 1;
        continue;
      }
      const command: CampaignConversionFeedbackCommand = {
        eventReference: String(event.event_reference),
        conversionType: String(event.conversion_type) as ConversionFeedbackType,
        occurredAt: String(event.conversion_occurred_at),
        runReference: String(runRow?.run_reference),
        runTargetReference: String(targetRow?.run_target_reference),
        providerChannel: channel,
        clickId: null,
        valueMinor: event.value_minor == null ? null : Number(event.value_minor),
        currency: event.currency == null ? null : String(event.currency),
      };
      const feedback = await provider.submitConversionFeedback(command);
      if (feedback.kind === "blocked") {
        await admin.rpc("mark_campaign_conversion_feedback_state", {
          p_event_id: eventId,
          p_provider_submission_state: "blocked",
          p_provider_error_code: feedback.errorCode,
        });
        await admin.rpc("complete_campaign_run_operation", {
          p_operation_id: operationId,
          p_outcome_code: "feedback_blocked",
          p_safe_metadata: { blocked: true },
        });
        outcomes.push("succeeded");
      } else if (feedback.kind === "transient_failure") {
        await admin.rpc("fail_campaign_run_operation", {
          p_operation_id: operationId,
          p_error_code: feedback.errorCode,
          p_retry: true,
        });
        outcomes.push("retry");
      } else if (feedback.kind === "timeout_unknown") {
        await admin.rpc("mark_campaign_run_operation_needs_reconcile", {
          p_operation_id: operationId,
          p_error_code: feedback.errorCode,
        });
        outcomes.push("needs_reconcile");
      } else if (feedback.kind === "rejected") {
        await admin.rpc("mark_campaign_conversion_feedback_state", {
          p_event_id: eventId,
          p_provider_submission_state: "rejected",
          p_provider_error_code: feedback.errorCode,
        });
        await admin.rpc("complete_campaign_run_operation", {
          p_operation_id: operationId,
          p_outcome_code: "feedback_rejected",
          p_safe_metadata: { rejected: true },
        });
        outcomes.push("succeeded");
      } else {
        await admin.rpc("mark_campaign_conversion_feedback_state", {
          p_event_id: eventId,
          p_provider_submission_state: "submitted",
          p_provider_submission_id: feedback.providerSubmissionId,
        });
        await admin.rpc("complete_campaign_run_operation", {
          p_operation_id: operationId,
          p_outcome_code: "feedback_submitted",
          p_safe_metadata: { submitted: true },
        });
        outcomes.push("succeeded");
      }
      processed += 1;
      continue;
    }

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
    } else if (providerResult.kind === "validation_failure" || providerResult.kind === "policy_denied") {
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
        p_safe_metadata: { mock: provider.code === "mock" },
      });
      outcomes.push("succeeded");
    }
    processed += 1;
  }

  return {
    mode: getCampaignExecutionMode(env),
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
