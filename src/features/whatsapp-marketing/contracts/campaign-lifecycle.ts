/**
 * WM-0 (ADR-0034) — WhatsApp campaign spec and run lifecycles. Migration-independent.
 *
 * Campaign identity, versions, audience rule versions and approvals stay in the
 * generic Phase 9A tables (ADR-0027). This module only describes what WhatsApp
 * adds on top: a channel spec frozen with the version, and execution runs that
 * live in their own tables. `public.campaign_runs` is the paid-ads run table
 * (ADR-0031, provider_channel in meta_ads/google_ads) and is never reused.
 */

/**
 * A WhatsApp campaign spec is 1:1 with a `campaign_versions` row whose
 * `intended_channels` is exactly `['whatsapp']`. It is editable only while that
 * version is `draft`; the moment the version is submitted it is frozen, and an
 * approved version's spec can never change. A change means a new version.
 */
export const WHATSAPP_CAMPAIGN_SPEC_STATES = ["draft", "frozen"] as const;

export type WhatsappCampaignSpecState =
  (typeof WHATSAPP_CAMPAIGN_SPEC_STATES)[number];

export function whatsappCampaignSpecStateForVersionStatus(
  versionStatus: "draft" | "pending_approval" | "approved" | "rejected"
): WhatsappCampaignSpecState {
  return versionStatus === "draft" ? "draft" : "frozen";
}

/** The only `intended_channels` shape a WhatsApp campaign version may carry. */
export const WHATSAPP_CAMPAIGN_INTENDED_CHANNELS = ["whatsapp"] as const;

/** WhatsApp campaigns address known CRM contacts; broad public targeting is not applicable. */
export const WHATSAPP_CAMPAIGN_TARGETING_MODE = "direct_or_custom" as const;

export const WHATSAPP_CAMPAIGN_RUN_STATES = [
  /** Created from an approved version; waiting for its start instant. */
  "scheduled",
  /** Recipient set being materialised from the frozen audience rule version. */
  "materializing",
  /** Recipients and preflight counts recorded; ready to dispatch. */
  "ready",
  /** Dispatch jobs may be claimed. */
  "dispatching",
  /** No new claims. In-flight claimed jobs still finish and record evidence. */
  "paused",
  /** Every job is terminal except `needs_reconcile`; awaiting human resolution. */
  "reconciling",
  "completed",
  "cancelled",
  "failed",
] as const;

export type WhatsappCampaignRunState =
  (typeof WHATSAPP_CAMPAIGN_RUN_STATES)[number];

export const WHATSAPP_CAMPAIGN_RUN_TERMINAL_STATES = [
  "completed",
  "cancelled",
  "failed",
] as const;

const RUN_TRANSITIONS: Readonly<
  Record<WhatsappCampaignRunState, readonly WhatsappCampaignRunState[]>
> = {
  scheduled: ["materializing", "cancelled"],
  materializing: ["ready", "failed", "cancelled"],
  ready: ["dispatching", "cancelled"],
  dispatching: ["paused", "reconciling", "completed", "cancelled", "failed"],
  paused: ["dispatching", "cancelled"],
  // Cancelling cannot make an ambiguous provider outcome go away; a run that
  // has reached reconciliation leaves it only by resolving every job.
  reconciling: ["completed"],
  completed: [],
  cancelled: [],
  failed: [],
};

export type WhatsappCampaignRunTransition =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

export function validateWhatsappCampaignRunTransition(
  from: WhatsappCampaignRunState,
  to: WhatsappCampaignRunState
): WhatsappCampaignRunTransition {
  if (RUN_TRANSITIONS[from].includes(to)) return { allowed: true };
  return {
    allowed: false,
    reason: `WhatsApp campaign run cannot move from ${from} to ${to}.`,
  };
}

export function isWhatsappCampaignRunTerminal(
  state: WhatsappCampaignRunState
): boolean {
  return (WHATSAPP_CAMPAIGN_RUN_TERMINAL_STATES as readonly string[]).includes(
    state
  );
}

/** Only a dispatching run may have jobs claimed. */
export function canClaimWhatsappCampaignJobs(
  state: WhatsappCampaignRunState
): boolean {
  return state === "dispatching";
}

/** Preconditions to create a run, checked in the database, mirrored here. */
export interface WhatsappCampaignRunCreationEvidence {
  readonly versionStatus: "draft" | "pending_approval" | "approved" | "rejected";
  readonly intendedChannels: readonly string[];
  readonly specState: WhatsappCampaignSpecState | null;
  readonly templateSnapshotApproved: boolean;
  readonly outboundKillSwitchOpen: boolean;
  readonly marketingExecutionEnabled: boolean;
}

export const WHATSAPP_CAMPAIGN_RUN_CREATION_DENIALS = [
  "version_not_approved",
  "version_not_whatsapp_only",
  "spec_missing_or_not_frozen",
  "template_snapshot_not_approved",
  "outbound_disabled",
  "marketing_execution_disabled",
] as const;

export type WhatsappCampaignRunCreationDenial =
  (typeof WHATSAPP_CAMPAIGN_RUN_CREATION_DENIALS)[number];

export function evaluateWhatsappCampaignRunCreation(
  evidence: WhatsappCampaignRunCreationEvidence
):
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: WhatsappCampaignRunCreationDenial } {
  if (evidence.versionStatus !== "approved") {
    return { allowed: false, reason: "version_not_approved" };
  }
  if (
    evidence.intendedChannels.length !== 1 ||
    evidence.intendedChannels[0] !== "whatsapp"
  ) {
    return { allowed: false, reason: "version_not_whatsapp_only" };
  }
  if (evidence.specState !== "frozen") {
    return { allowed: false, reason: "spec_missing_or_not_frozen" };
  }
  if (!evidence.templateSnapshotApproved) {
    return { allowed: false, reason: "template_snapshot_not_approved" };
  }
  if (!evidence.outboundKillSwitchOpen) {
    return { allowed: false, reason: "outbound_disabled" };
  }
  if (!evidence.marketingExecutionEnabled) {
    return { allowed: false, reason: "marketing_execution_disabled" };
  }
  return { allowed: true };
}
