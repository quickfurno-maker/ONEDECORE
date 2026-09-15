import "server-only";

import { createAdminClient } from "@/lib/supabase/service-role";
import { isCommerceAutomationEnabled } from "./automation-env";

const DEFAULT_BATCH = 20;
const MAX_BATCH = 100;

type AutomationAdminClient = ReturnType<typeof createAdminClient>;

export interface CommerceAutomationDispatchResult {
  readonly enabled: boolean;
  readonly processed: number;
  readonly succeeded: number;
  readonly retried: number;
  readonly dead: number;
  readonly outcomes: readonly string[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function dispatchCommerceAutomationJobs(options?: {
  readonly maxBatch?: number;
  readonly workerId?: string;
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly admin?: AutomationAdminClient;
}): Promise<CommerceAutomationDispatchResult> {  const env = options?.env ?? process.env;
  if (!isCommerceAutomationEnabled(env)) {
    return { enabled: false, processed: 0, succeeded: 0, retried: 0, dead: 0, outcomes: [] };
  }

  const maxBatch = Math.max(1, Math.min(options?.maxBatch ?? DEFAULT_BATCH, MAX_BATCH));
  const workerId = (options?.workerId ?? "commerce-automation-worker").slice(0, 80);
  const admin = options?.admin ?? createAdminClient();
  const outcomes: string[] = [];
  let processed = 0;
  let succeeded = 0;
  let retried = 0;
  let dead = 0;

  for (let index = 0; index < maxBatch; index += 1) {
    const { data: claimData, error: claimError } = await admin.rpc("claim_commerce_automation_job", {
      p_worker_id: workerId,
      p_lease_seconds: 120,
    });
    if (claimError) throw claimError;
    const claim = asRecord(claimData);
    const outcomeCode = String(claim.outcome_code ?? "none");
    if (outcomeCode === "none") break;
    if (outcomeCode === "paused") {
      outcomes.push("paused");
      break;
    }
    if (outcomeCode === "dead") {
      dead += 1; processed += 1; outcomes.push("dead"); continue;
    }
    const jobId = String(claim.job_id ?? "");
    const claimToken = String(claim.claim_token ?? "");
    if (!jobId || !claimToken) {
      outcomes.push("invalid_claim");
      processed += 1;
      continue;
    }

    try {
      const { error: completeError } = await admin.rpc("complete_commerce_automation_job", {
        p_job_id: jobId,
        p_claim_token: claimToken,
      });
      if (completeError) throw completeError;
      succeeded += 1;
      processed += 1;
      outcomes.push("succeeded");
    } catch (error) {
      const safeCode = error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "COMMERCE_AUTOMATION_EXECUTION_FAILED")
        : "COMMERCE_AUTOMATION_EXECUTION_FAILED";
      const { data: failData, error: failError } = await admin.rpc("fail_commerce_automation_job", {
        p_job_id: jobId,
        p_claim_token: claimToken,
        p_error_code: safeCode.slice(0, 120),
      });
      if (failError) throw failError;
      const failed = asRecord(failData);
      const status = String(failed.status ?? "dead");
      if (status === "pending") retried += 1;
      else dead += 1;
      processed += 1;
      outcomes.push(status === "pending" ? "retry" : "dead");
    }
  }

  return { enabled: true, processed, succeeded, retried, dead, outcomes };
}
