import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { WHATSAPP_AUTOMATION_WORKER_RPC } from "../contracts/automations.ts";
import {
  classifyWhatsappCampaignFailureReply,
  clampWhatsappCampaignWorkerBatch,
  decideWhatsappCampaignCompletion,
  parseWhatsappMarketingClaims,
  WHATSAPP_CAMPAIGN_MAX_ATTEMPTS,
  WHATSAPP_CAMPAIGN_WORKER_RPC,
  type WhatsappCampaignClaimedJob,
  type WhatsappCampaignFailureOutcome,
} from "../contracts/campaign-execution.ts";
import { createFakeWhatsappTemplateMessageAdapter } from "./whatsapp-fake-template-adapters.ts";
import { createMetaWhatsappTemplateMessageAdapter } from "./whatsapp-meta-provider-adapter.ts";
import { getWhatsappOutboundServerEnv, type WhatsappOutboundServerEnv } from "./whatsapp-outbound-env.ts";
import type { WhatsappTemplateMessageAdapter } from "./whatsapp-template-provider-adapter.ts";

/**
 * WM-4/WM-6 — service-role WhatsApp marketing dispatch worker.
 *
 *   materialize  due scheduled runs become recipient + job rows (SQL)
 *   claim        a bounded batch (max 50) per queue, each with a claim token;
 *                SQL re-proves consent, opt-out, suppression, caps, quiet
 *                hours, tombstones and run/automation state first
 *   mark         provider_request_started is recorded BEFORE the provider is
 *                called; if it cannot be recorded nothing is sent
 *   send         official Cloud API `type: "template"` via the WM-2 adapter
 *   complete     success binds into canonical history; an ambiguous answer, a
 *                thrown call, or a success that cannot be bound completes as
 *                `ambiguous`, which SQL parks as needs_reconcile and never
 *                retries; a transient failure is retried by SQL only while
 *                attempt_count < 3
 *
 * Queues: campaign jobs, internal test sends (never retried), automation
 * enrollments (after the trigger scan). Only the internal worker route calls
 * this. No caller session ever reaches the service-role client, and n8n (if
 * used) only calls that route.
 */

export type WhatsappCampaignWorkerAdminClient = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

export type WhatsappCampaignWorkerDeps = {
  readonly getEnv?: () => WhatsappOutboundServerEnv;
  readonly createAdminClient?: (env: WhatsappOutboundServerEnv) => WhatsappCampaignWorkerAdminClient;
  readonly createAdapter?: (env: WhatsappOutboundServerEnv) => WhatsappTemplateMessageAdapter;
};

type QueueTally = { claimed: number; sent: number; retryScheduled: number; failed: number; needsReconcile: number; skipped: number };

export type WhatsappCampaignWorkerSummary = {
  readonly mode: "disabled" | "ran";
  readonly materialized: number;
  readonly claimed: number;
  readonly sent: number;
  readonly retryScheduled: number;
  readonly failed: number;
  readonly needsReconcile: number;
  readonly skipped: number;
  readonly testSends: Readonly<QueueTally>;
  readonly automations: Readonly<QueueTally & { enrolled: number }>;
};

function createAdminClient(env: WhatsappOutboundServerEnv): WhatsappCampaignWorkerAdminClient {
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error("[ONEDECORE WhatsApp Campaign Worker] Admin client unavailable.");
  }
  return createClient<Database>(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as WhatsappCampaignWorkerAdminClient;
}

function resolveAdapter(env: WhatsappOutboundServerEnv, factory: WhatsappCampaignWorkerDeps["createAdapter"]): WhatsappTemplateMessageAdapter {
  if (factory) return factory(env);
  return env.providerCode === "fake" ? createFakeWhatsappTemplateMessageAdapter() : createMetaWhatsappTemplateMessageAdapter(env);
}

/** Only these keys from a provider response are kept, and only as scalars. */
function boundedSnapshot(snapshot: Record<string, unknown>): Json {
  const out: Record<string, string | number | null> = {};
  for (const key of ["provider", "httpStatus", "errorType", "errorCode", "type", "messaging_product"]) {
    const value = snapshot[key];
    if (typeof value === "number" || value === null) out[key] = value;
    else if (typeof value === "string") out[key] = value.slice(0, 64);
  }
  return out;
}

type JobOutcome = "sent" | "retry_scheduled" | "failed_terminal" | "needs_reconcile" | "skipped";

/** How one queue talks to SQL. Campaign jobs and automation enrollments share the failure RPC shape. */
interface QueueSpec {
  readonly name: "campaign" | "automation";
  readonly idArg: "p_job_id" | "p_enrollment_id";
  readonly markRpc: string;
  readonly successRpc: string;
  readonly failureRpc: string;
  readonly attemptKey: string;
}

const CAMPAIGN_QUEUE: QueueSpec = {
  name: "campaign",
  idArg: "p_job_id",
  markRpc: WHATSAPP_CAMPAIGN_WORKER_RPC.markProviderRequestStarted,
  successRpc: WHATSAPP_CAMPAIGN_WORKER_RPC.completeSuccess,
  failureRpc: WHATSAPP_CAMPAIGN_WORKER_RPC.completeFailure,
  attemptKey: "whatsapp-campaign",
};

const AUTOMATION_QUEUE: QueueSpec = {
  name: "automation",
  idArg: "p_enrollment_id",
  markRpc: WHATSAPP_AUTOMATION_WORKER_RPC.markProviderRequestStarted,
  successRpc: WHATSAPP_AUTOMATION_WORKER_RPC.completeSuccess,
  failureRpc: WHATSAPP_AUTOMATION_WORKER_RPC.completeFailure,
  attemptKey: "whatsapp-automation",
};

async function failJob(
  admin: WhatsappCampaignWorkerAdminClient,
  queue: QueueSpec,
  job: WhatsappCampaignClaimedJob,
  outcome: WhatsappCampaignFailureOutcome,
  errorCode: string,
  snapshot: Json = {}
): Promise<JobOutcome> {
  const { data, error } = await admin.rpc(queue.failureRpc, {
    [queue.idArg]: job.jobId,
    p_claim_token: job.claimToken,
    p_outcome: outcome,
    p_error_code: errorCode.slice(0, 128),
    p_provider_snapshot: snapshot,
  });
  // If completion is lost, the claim expires after provider start and SQL parks it.
  if (error) return "needs_reconcile";
  return classifyWhatsappCampaignFailureReply(data, outcome);
}

async function dispatchOneJob(
  admin: WhatsappCampaignWorkerAdminClient,
  adapter: WhatsappTemplateMessageAdapter,
  queue: QueueSpec,
  job: WhatsappCampaignClaimedJob
): Promise<JobOutcome> {
  // Recorded before the provider call. If this cannot be recorded, do not send.
  const { error: markError } = await admin.rpc(queue.markRpc, { [queue.idArg]: job.jobId, p_claim_token: job.claimToken });
  if (markError) return "skipped";

  // Unsendable claims end terminally without any provider call.
  if (job.attempt > WHATSAPP_CAMPAIGN_MAX_ATTEMPTS) {
    return failJob(admin, queue, job, "terminal", "max_attempts_exceeded");
  }
  if (!job.phoneNumberId || !job.recipientE164 || !job.templateName || !job.templateLanguage || !job.components) {
    return failJob(admin, queue, job, "terminal", "claim_fields_missing");
  }

  let result;
  try {
    result = await adapter.dispatchTemplateMessage({
      phoneNumberId: job.phoneNumberId,
      customerE164: job.recipientE164,
      templateName: job.templateName,
      templateLanguage: job.templateLanguage,
      components: job.components,
      providerAttemptKey: `${queue.attemptKey}:${job.jobId}:${job.attempt}`,
    });
  } catch {
    // The request may have left the process: unclear, so never retried.
    return failJob(admin, queue, job, "ambiguous", "provider_call_threw");
  }

  const decision = decideWhatsappCampaignCompletion(result, job.attempt);
  if (decision.rpc === "failure") {
    return failJob(admin, queue, job, decision.outcome, decision.errorCode, boundedSnapshot(result.responseSnapshot));
  }
  if (result.kind !== "success") {
    return failJob(admin, queue, job, "ambiguous", "unexpected_provider_result");
  }

  const { error: bindError } = await admin.rpc(queue.successRpc, {
    [queue.idArg]: job.jobId,
    p_claim_token: job.claimToken,
    p_provider_message_id: result.providerMessageId,
    p_provider_timestamp: result.providerTimestamp,
    p_provider_snapshot: boundedSnapshot(result.responseSnapshot),
  });
  if (bindError) {
    // Meta accepted it; the customer may already have it. Park, never resend.
    return failJob(admin, queue, job, "ambiguous", "local_bind_failed", boundedSnapshot(result.responseSnapshot));
  }
  return "sent";
}

/** Internal test sends: one attempt, no retry, never customer history. */
async function dispatchOneTestSend(
  admin: WhatsappCampaignWorkerAdminClient,
  adapter: WhatsappTemplateMessageAdapter,
  job: WhatsappCampaignClaimedJob
): Promise<JobOutcome> {
  const { error: markError } = await admin.rpc(WHATSAPP_CAMPAIGN_WORKER_RPC.markTestSendStarted, {
    p_test_send_id: job.jobId,
    p_claim_token: job.claimToken,
  });
  if (markError) return "skipped";
  const complete = async (outcome: "succeeded" | "failed" | "needs_reconcile", extra: Record<string, unknown>): Promise<JobOutcome> => {
    const { error } = await admin.rpc(WHATSAPP_CAMPAIGN_WORKER_RPC.completeTestSend, {
      p_test_send_id: job.jobId,
      p_claim_token: job.claimToken,
      p_outcome: outcome,
      ...extra,
    });
    if (error) return "needs_reconcile";
    return outcome === "succeeded" ? "sent" : outcome === "failed" ? "failed_terminal" : "needs_reconcile";
  };
  if (!job.phoneNumberId || !job.recipientE164 || !job.templateName || !job.templateLanguage || !job.components) {
    return complete("failed", { p_error_code: "claim_fields_missing" });
  }
  let result;
  try {
    result = await adapter.dispatchTemplateMessage({
      phoneNumberId: job.phoneNumberId,
      customerE164: job.recipientE164,
      templateName: job.templateName,
      templateLanguage: job.templateLanguage,
      components: job.components,
      providerAttemptKey: `whatsapp-campaign-test:${job.jobId}`,
    });
  } catch {
    return complete("needs_reconcile", { p_error_code: "provider_call_threw" });
  }
  if (result.kind === "success") return complete("succeeded", { p_provider_message_id: result.providerMessageId });
  if (result.kind === "ambiguous") return complete("needs_reconcile", { p_error_code: result.code.slice(0, 128) });
  return complete("failed", { p_error_code: result.code.slice(0, 128) });
}

function emptyTally(): QueueTally {
  return { claimed: 0, sent: 0, retryScheduled: 0, failed: 0, needsReconcile: 0, skipped: 0 };
}

function tally(counts: QueueTally, outcome: JobOutcome): void {
  if (outcome === "sent") counts.sent += 1;
  else if (outcome === "retry_scheduled") counts.retryScheduled += 1;
  else if (outcome === "failed_terminal") counts.failed += 1;
  else if (outcome === "needs_reconcile") counts.needsReconcile += 1;
  else counts.skipped += 1;
}

export async function dispatchWhatsappCampaignJobs(
  options: { readonly maxBatch?: unknown; readonly workerId: string },
  deps: WhatsappCampaignWorkerDeps = {}
): Promise<WhatsappCampaignWorkerSummary> {
  const env = (deps.getEnv ?? getWhatsappOutboundServerEnv)();
  const campaign = emptyTally();
  const tests = emptyTally();
  const automations = { ...emptyTally(), enrolled: 0 };
  let materialized = 0;
  if (env.mode === "disabled") {
    return { mode: "disabled", materialized, ...campaign, testSends: tests, automations };
  }

  const batch = clampWhatsappCampaignWorkerBatch(options.maxBatch);
  const workerId = options.workerId.slice(0, 80);
  const admin = (deps.createAdminClient ?? createAdminClient)(env);
  const adapter = resolveAdapter(env, deps.createAdapter);

  const { data: materializedData } = await admin.rpc(WHATSAPP_CAMPAIGN_WORKER_RPC.materializeDueRuns, { p_limit: batch });
  materialized = Array.isArray(materializedData) ? materializedData.length : 0;

  // Sequential on purpose: bounded batches against one sender number.
  const { data: claimData, error: claimError } = await admin.rpc(WHATSAPP_CAMPAIGN_WORKER_RPC.claimJobs, {
    p_batch_size: batch,
    p_worker_id: workerId,
  });
  if (!claimError) {
    const jobs = parseWhatsappMarketingClaims(claimData, "job_id").slice(0, batch);
    campaign.claimed = jobs.length;
    for (const job of jobs) {
      let outcome: JobOutcome;
      try {
        outcome = await dispatchOneJob(admin, adapter, CAMPAIGN_QUEUE, job);
      } catch {
        outcome = "skipped";
      }
      tally(campaign, outcome);
    }
  }

  const { data: testData, error: testError } = await admin.rpc(WHATSAPP_CAMPAIGN_WORKER_RPC.claimTestSends, {
    p_limit: Math.min(batch, 20),
    p_worker_id: workerId,
  });
  if (!testError) {
    const claimed = parseWhatsappMarketingClaims(testData, "test_send_id").slice(0, 20);
    tests.claimed = claimed.length;
    for (const job of claimed) {
      let outcome: JobOutcome;
      try {
        outcome = await dispatchOneTestSend(admin, adapter, job);
      } catch {
        outcome = "skipped";
      }
      tally(tests, outcome);
    }
  }

  const { data: enrolledData } = await admin.rpc(WHATSAPP_AUTOMATION_WORKER_RPC.enrollTriggers, { p_limit: 200 });
  if (Array.isArray(enrolledData)) {
    automations.enrolled = enrolledData.reduce(
      (sum: number, row) => sum + (typeof (row as { enrolled?: unknown }).enrolled === "number" ? ((row as { enrolled: number }).enrolled) : 0),
      0
    );
  }
  const { data: automationData, error: automationError } = await admin.rpc(WHATSAPP_AUTOMATION_WORKER_RPC.claim, {
    p_batch_size: batch,
    p_worker_id: workerId,
  });
  if (!automationError) {
    const claimed = parseWhatsappMarketingClaims(automationData, "enrollment_id").slice(0, batch);
    automations.claimed = claimed.length;
    for (const job of claimed) {
      let outcome: JobOutcome;
      try {
        outcome = await dispatchOneJob(admin, adapter, AUTOMATION_QUEUE, job);
      } catch {
        outcome = "skipped";
      }
      tally(automations, outcome);
    }
  }

  return { mode: "ran", materialized, ...campaign, testSends: tests, automations };
}
