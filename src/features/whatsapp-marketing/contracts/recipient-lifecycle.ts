/**
 * WM-0 (ADR-0034) — recipient snapshot and dispatch job lifecycles. Migration-independent.
 *
 * Two state machines, deliberately separate:
 * - a recipient is a frozen audience member of one run (minimum protected data);
 * - a dispatch job is the queue entry that may call the provider for it.
 *
 * Provider delivery evidence (delivered, read, failed-after-accept) is NOT a
 * recipient or job state. It arrives later from signed webhooks into
 * `whatsapp_message_status_events` and is joined through the bound message.
 */

export const WHATSAPP_CAMPAIGN_RECIPIENT_STATES = [
  /** Eligible at preflight; a dispatch job exists or will be created. */
  "queued",
  /** Ineligible at preflight; never gets a job. Carries a skip reason. */
  "excluded",
  /** Provider accepted and the message is bound to canonical history. */
  "sent",
  /** Ineligible at just-in-time re-check; no provider call made. */
  "skipped",
  "failed",
  "needs_reconcile",
  "cancelled",
] as const;

export type WhatsappCampaignRecipientState =
  (typeof WHATSAPP_CAMPAIGN_RECIPIENT_STATES)[number];

export const WHATSAPP_DISPATCH_JOB_STATES = [
  "pending",
  "claimed",
  "succeeded",
  "skipped",
  "failed",
  "needs_reconcile",
  "cancelled",
] as const;

export type WhatsappDispatchJobState =
  (typeof WHATSAPP_DISPATCH_JOB_STATES)[number];

export const WHATSAPP_DISPATCH_JOB_TERMINAL_STATES = [
  "succeeded",
  "skipped",
  "failed",
  "cancelled",
] as const;

const JOB_TRANSITIONS: Readonly<
  Record<WhatsappDispatchJobState, readonly WhatsappDispatchJobState[]>
> = {
  pending: ["claimed", "cancelled"],
  // `claimed -> pending` is a scheduled retry after a definite transient
  // failure, or a reclaim after claim TTL expiry *before* any provider request
  // was recorded. A claimed job is never cancelled: the provider call may be in
  // flight, and only its outcome may end the claim.
  claimed: ["succeeded", "skipped", "failed", "needs_reconcile", "pending"],
  // Resolved only by evidence or an explicit, audited human decision. Never
  // back to `pending`: an ambiguous send is never blindly retried.
  needs_reconcile: ["succeeded", "failed"],
  succeeded: [],
  skipped: [],
  failed: [],
  cancelled: [],
};

export function validateWhatsappDispatchJobTransition(
  from: WhatsappDispatchJobState,
  to: WhatsappDispatchJobState
): { readonly allowed: true } | { readonly allowed: false; readonly reason: string } {
  if (JOB_TRANSITIONS[from].includes(to)) return { allowed: true };
  return {
    allowed: false,
    reason: `WhatsApp dispatch job cannot move from ${from} to ${to}.`,
  };
}

export function isWhatsappDispatchJobTerminal(
  state: WhatsappDispatchJobState
): boolean {
  return (WHATSAPP_DISPATCH_JOB_TERMINAL_STATES as readonly string[]).includes(
    state
  );
}

/**
 * Engineering safety bounds for the worker, not business policy. Business
 * limits (frequency caps, quiet hours) are configuration, see `preferences.ts`.
 */
export const WHATSAPP_DISPATCH_WORKER_BOUNDS = {
  maxAttempts: 3,
  claimTtlSeconds: 120,
  claimBatchMax: 50,
  backoffBaseSeconds: 30,
  backoffMaxSeconds: 900,
  providerTimeoutMs: 15_000,
} as const;

/** Bounded exponential backoff for attempt n (1-based) that failed transiently. */
export function whatsappDispatchRetryDelaySeconds(attempt: number): number {
  const { backoffBaseSeconds, backoffMaxSeconds } = WHATSAPP_DISPATCH_WORKER_BOUNDS;
  const safeAttempt = Math.max(1, Math.min(Math.floor(attempt), 16));
  return Math.min(backoffBaseSeconds * 2 ** (safeAttempt - 1), backoffMaxSeconds);
}

/**
 * The per-run recipient uniqueness key. One contact channel receives at most
 * one message per run, whatever the audience rule matched it through.
 */
export function whatsappCampaignRecipientKey(input: {
  readonly runId: string;
  readonly contactChannelId: string;
}): string {
  return `${input.runId}:${input.contactChannelId}`;
}

/**
 * Stable provider-side correlation for a job, safe to echo back from Meta. It
 * carries opaque ids only, never a phone number, name or campaign title.
 */
export function whatsappDispatchCorrelationKey(input: {
  readonly runId: string;
  readonly jobId: string;
}): string {
  return `odwm:${input.runId}:${input.jobId}`;
}
