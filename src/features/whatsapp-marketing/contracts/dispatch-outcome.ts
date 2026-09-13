/**
 * WM-0 (ADR-0034) — marketing dispatch outcomes. Migration-independent.
 *
 * WM-0 introduces no provider call. This module only classifies the result
 * shape the existing provider port already returns
 * (`WhatsappProviderDispatchResult`), so WM-4's worker has one frozen answer to
 * "what happens to the job now".
 */

import type { WhatsappProviderDispatchResult } from "../../whatsapp/contracts/provider-dispatch.ts";
import type { WhatsappDispatchJobState } from "./recipient-lifecycle.ts";
import { WHATSAPP_DISPATCH_WORKER_BOUNDS } from "./recipient-lifecycle.ts";

export const WHATSAPP_MARKETING_DISPATCH_OUTCOMES = [
  /** Provider accepted; message bound to canonical conversation history. */
  "bound",
  /** Idempotent replay: this job was already bound. No provider call made. */
  "already_bound",
  /** Just-in-time eligibility failed. No provider call made. */
  "skipped_ineligible",
  /** Quiet hours. Job returned to pending with a later not-before instant. */
  "deferred",
  /** Definite transient failure, attempts remain. */
  "retry_scheduled",
  /** Definite terminal failure, or transient with attempts exhausted. */
  "failed_terminal",
  /** Provider outcome unknown (timeout, network loss after send). Never retried. */
  "needs_reconcile",
  /** Nothing claimable: not pending, claim held by another worker, or not due. */
  "not_claimable",
  /** Run is not dispatching (paused, cancelled, completed…). */
  "run_not_active",
  /** Outbound kill switch or marketing execution gate is closed. */
  "outbound_disabled",
] as const;

export type WhatsappMarketingDispatchOutcome =
  (typeof WHATSAPP_MARKETING_DISPATCH_OUTCOMES)[number];

export const WHATSAPP_MARKETING_DISPATCH_OUTCOME_JOB_STATE: Readonly<
  Record<WhatsappMarketingDispatchOutcome, WhatsappDispatchJobState | null>
> = {
  bound: "succeeded",
  already_bound: "succeeded",
  skipped_ineligible: "skipped",
  deferred: "pending",
  retry_scheduled: "pending",
  failed_terminal: "failed",
  needs_reconcile: "needs_reconcile",
  // No state change: the worker did not own the job.
  not_claimable: null,
  run_not_active: null,
  outbound_disabled: null,
};

/**
 * Classify a provider result for attempt `attempt` (1-based). An ambiguous
 * result is `needs_reconcile` on every attempt: a retry after "we do not know
 * whether it was sent" is how customers receive the same message twice.
 */
export function classifyWhatsappMarketingProviderResult(
  result: WhatsappProviderDispatchResult,
  attempt: number,
  maxAttempts: number = WHATSAPP_DISPATCH_WORKER_BOUNDS.maxAttempts
): Extract<
  WhatsappMarketingDispatchOutcome,
  "bound" | "retry_scheduled" | "failed_terminal" | "needs_reconcile"
> {
  switch (result.kind) {
    case "success":
      return "bound";
    case "ambiguous":
      return "needs_reconcile";
    case "failed":
      if (result.errorClass === "transient" && attempt < maxAttempts) {
        return "retry_scheduled";
      }
      return "failed_terminal";
  }
}

/** Keys a provider response snapshot may keep. Anything else is dropped. */
export const WHATSAPP_MARKETING_PROVIDER_SNAPSHOT_ALLOWED_KEYS = [
  "http_status",
  "provider_message_id",
  "error_code",
  "error_subcode",
  "error_type",
  "fbtrace_id",
] as const;
