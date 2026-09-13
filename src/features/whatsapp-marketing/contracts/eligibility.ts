/**
 * WM-0 (ADR-0034) — WhatsApp marketing recipient eligibility. Migration-independent.
 *
 * The database is the authority: WM-4 re-evaluates every recipient inside the
 * claim transaction, immediately before the provider call. This pure function
 * mirrors that evaluation so the precedence, the reason vocabulary and the
 * preview buckets are frozen and testable before any SQL exists.
 *
 * There is no override input. DNC, suppression, missing or withdrawn MARKETING
 * consent and an unapproved template cannot be bypassed by any role, flag or
 * "send anyway" action, and this type is shaped so one cannot be passed.
 */

import type {
  RawSafe,
  WhatsappTemplateCategory,
  WhatsappTemplateStatus,
  WhatsappTemplateVariableValidation,
} from "../../whatsapp/contracts/template-registry.ts";
import type { WhatsappCampaignRunState } from "./campaign-lifecycle.ts";

/** Why a recipient is not sent to. Order here is not precedence; see below. */
export const WHATSAPP_MARKETING_SKIP_REASONS = [
  "run_not_active",
  "template_not_approved",
  "template_category_not_marketing",
  "already_sent",
  "contact_missing",
  "contact_do_not_contact",
  "contact_inactive",
  "whatsapp_channel_missing",
  "channel_suppressed",
  "channel_invalid",
  "channel_inactive",
  "marketing_consent_missing",
  "marketing_consent_withdrawn",
  "marketing_consent_suppressed",
  "marketing_consent_expired",
  "preference_opted_out",
  "variables_missing",
  "variables_invalid",
  "send_policy_unconfigured",
  "frequency_capped",
] as const;

export type WhatsappMarketingSkipReason =
  (typeof WHATSAPP_MARKETING_SKIP_REASONS)[number];

/** Not a skip: the job is rescheduled to the end of the quiet window. */
export const WHATSAPP_MARKETING_DEFER_REASONS = ["quiet_hours"] as const;

export type WhatsappMarketingDeferReason =
  (typeof WHATSAPP_MARKETING_DEFER_REASONS)[number];

export type WhatsappContactStatus =
  | "active"
  | "do_not_contact"
  | "merged"
  | "archived";

export type WhatsappContactChannelStatus =
  | "active"
  | "invalid"
  | "suppressed"
  | "archived";

export type ConsentEventType = "granted" | "withdrawn" | "suppressed" | "expired";

export interface WhatsappMarketingRecipientEvidence {
  /** `null` for an audience preview, before any run exists. */
  readonly runState: WhatsappCampaignRunState | null;
  /** Latest registry status and category, re-read at evaluation time. */
  readonly templateStatus: RawSafe<WhatsappTemplateStatus>;
  readonly templateCategory: RawSafe<WhatsappTemplateCategory>;
  /** A bound provider message already exists for this run + recipient. */
  readonly alreadyBound: boolean;
  /** `null` when the contact row is absent. */
  readonly contactStatus: WhatsappContactStatus | null;
  /** `null` when no WhatsApp contact channel matches. */
  readonly whatsappChannelStatus: WhatsappContactChannelStatus | null;
  /** Latest `consent_events.event_type` for purpose MARKETING, or `null`. */
  readonly latestMarketingConsentEvent: ConsentEventType | null;
  /** The contact opted out of this campaign's preference category. */
  readonly preferenceOptedOut: boolean;
  readonly variables: WhatsappTemplateVariableValidation;
  /** `null` when no send policy is configured. */
  readonly policy: {
    readonly frequencyCapped: boolean;
    readonly withinQuietHours: boolean;
  } | null;
}

export type WhatsappMarketingEligibilityDecision =
  | { readonly decision: "eligible" }
  | { readonly decision: "skip"; readonly reason: WhatsappMarketingSkipReason }
  | { readonly decision: "defer"; readonly reason: WhatsappMarketingDeferReason };

/**
 * First failing check wins. Run- and template-scope checks come first because
 * they apply to every recipient; compliance checks (DNC, suppression, consent)
 * come before operational ones so a recipient is reported under the most
 * important reason that applies to them.
 */
export function evaluateWhatsappMarketingRecipient(
  evidence: WhatsappMarketingRecipientEvidence
): WhatsappMarketingEligibilityDecision {
  const skip = (reason: WhatsappMarketingSkipReason) =>
    ({ decision: "skip", reason }) as const;

  if (evidence.runState !== null && evidence.runState !== "dispatching") {
    return skip("run_not_active");
  }
  if (evidence.templateStatus.value !== "APPROVED") return skip("template_not_approved");
  if (evidence.templateCategory.value !== "MARKETING") {
    return skip("template_category_not_marketing");
  }
  if (evidence.alreadyBound) return skip("already_sent");

  if (evidence.contactStatus === null) return skip("contact_missing");
  if (evidence.contactStatus === "do_not_contact") return skip("contact_do_not_contact");
  if (evidence.contactStatus !== "active") return skip("contact_inactive");

  if (evidence.whatsappChannelStatus === null) return skip("whatsapp_channel_missing");
  if (evidence.whatsappChannelStatus === "suppressed") return skip("channel_suppressed");
  if (evidence.whatsappChannelStatus === "invalid") return skip("channel_invalid");
  if (evidence.whatsappChannelStatus !== "active") return skip("channel_inactive");

  switch (evidence.latestMarketingConsentEvent) {
    case "granted":
      break;
    case "withdrawn":
      return skip("marketing_consent_withdrawn");
    case "suppressed":
      return skip("marketing_consent_suppressed");
    case "expired":
      return skip("marketing_consent_expired");
    default:
      return skip("marketing_consent_missing");
  }

  if (evidence.preferenceOptedOut) return skip("preference_opted_out");

  if (!evidence.variables.ok) {
    return evidence.variables.missing.length > 0
      ? skip("variables_missing")
      : skip("variables_invalid");
  }

  if (evidence.policy === null) return skip("send_policy_unconfigured");
  if (evidence.policy.frequencyCapped) return skip("frequency_capped");
  if (evidence.policy.withinQuietHours) {
    return { decision: "defer", reason: "quiet_hours" };
  }

  return { decision: "eligible" };
}

/** Audience preview buckets. Every matched recipient lands in exactly one. */
export const WHATSAPP_AUDIENCE_PREVIEW_BUCKETS = [
  "eligible",
  "missing_whatsapp",
  "no_marketing_consent",
  "do_not_contact",
  "suppressed_or_invalid",
  "frequency_capped",
  "missing_variables",
  "other",
] as const;

export type WhatsappAudiencePreviewBucket =
  (typeof WHATSAPP_AUDIENCE_PREVIEW_BUCKETS)[number];

export function whatsappAudiencePreviewBucket(
  decision: WhatsappMarketingEligibilityDecision
): WhatsappAudiencePreviewBucket {
  if (decision.decision === "eligible") return "eligible";
  // Quiet hours only delay a send; at preview time the recipient is eligible.
  if (decision.decision === "defer") return "eligible";
  switch (decision.reason) {
    case "whatsapp_channel_missing":
      return "missing_whatsapp";
    case "marketing_consent_missing":
    case "marketing_consent_withdrawn":
    case "marketing_consent_suppressed":
    case "marketing_consent_expired":
    case "preference_opted_out":
      return "no_marketing_consent";
    case "contact_do_not_contact":
      return "do_not_contact";
    case "channel_suppressed":
    case "channel_invalid":
    case "channel_inactive":
      return "suppressed_or_invalid";
    case "frequency_capped":
      return "frequency_capped";
    case "variables_missing":
    case "variables_invalid":
      return "missing_variables";
    default:
      return "other";
  }
}

/** Non-PII preview shape: counts only, never a recipient list. */
export type WhatsappAudiencePreviewCounts = Readonly<
  { totalMatched: number } & Record<WhatsappAudiencePreviewBucket, number>
>;
