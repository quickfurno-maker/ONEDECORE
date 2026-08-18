import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CampaignLifecycleState } from "../contracts/lifecycle";
import type { CampaignTargetingMode } from "../contracts/targeting";
import type { MarketingChannel } from "../contracts/channel";
import type { AudienceRuleGroup } from "../contracts/audience-rule";
import type { Json } from "@/types/database.generated";

export interface CampaignListItem {
  readonly id: string;
  readonly campaignReference: string;
  readonly name: string;
  readonly latestVersionNumber: number;
  readonly latestTitle: string;
  readonly latestStatus: CampaignLifecycleState;
  readonly targetingMode: CampaignTargetingMode;
  readonly intendedChannels: readonly MarketingChannel[];
  readonly requestedAt: string | null;
  readonly frozenAt: string | null;
}

export interface CampaignVersionDetail {
  readonly id: string;
  readonly campaignId: string;
  readonly versionNumber: number;
  readonly title: string;
  readonly status: CampaignLifecycleState;
  readonly targetingMode: CampaignTargetingMode;
  readonly intendedChannels: readonly MarketingChannel[];
  readonly destinationReference: string | null;
  readonly budgetSnapshot: Record<string, Json | undefined>;
  readonly creativeSnapshot: Record<string, Json | undefined>;
  readonly intendedWindowSnapshot: Record<string, Json | undefined>;
  readonly configurationHash: string | null;
  readonly createdBy: string;
  readonly requestedBy: string | null;
  readonly requestedAt: string | null;
  readonly frozenAt: string | null;
  readonly lockVersion: number;
  readonly ruleGroup: AudienceRuleGroup | null;
  readonly ruleHash: string | null;
  readonly ruleFrozenAt: string | null;
  readonly approvalDecision: "approved" | "rejected" | null;
  readonly approvalReason: string | null;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
}

export interface CampaignDetail {
  readonly id: string;
  readonly campaignReference: string;
  readonly name: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly versions: readonly CampaignVersionDetail[];
}

export interface AudiencePreviewAggregates {
  readonly targetingMode: CampaignTargetingMode;
  readonly ruleMatchLeadCount: number;
  readonly distinctContactCount: number;
  readonly currentMarketingConsentCount: number;
  readonly dncBlockedCount: number;
  readonly eligibleDirectOrCustomCount: number | null;
  readonly evaluatedAt: string;
  readonly previewLabel: string;
}

export interface MarketingConsentState {
  readonly contactId: string;
  readonly currentGranted: boolean;
  readonly latestEventType: string | null;
  readonly latestOccurredAt: string | null;
  readonly dnc: boolean;
  readonly contactStatus: string;
  readonly emailSuppressed: boolean;
  readonly whatsappSuppressed: boolean;
  readonly outreachBlocked: boolean;
}

function asChannels(value: string[] | null): MarketingChannel[] {
  return (value ?? []) as MarketingChannel[];
}

export async function listCampaigns(): Promise<readonly CampaignListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, campaign_reference, name, campaign_versions(version_number, title, status, targeting_mode, intended_channels, requested_at, frozen_at)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const versions = [...((row.campaign_versions as Array<Record<string, unknown>>) ?? [])].sort(
      (a, b) => Number(b.version_number) - Number(a.version_number)
    );
    const latest = versions[0] ?? {};
    return {
      id: row.id,
      campaignReference: row.campaign_reference,
      name: row.name,
      latestVersionNumber: Number(latest.version_number ?? 0),
      latestTitle: String(latest.title ?? row.name),
      latestStatus: (latest.status as CampaignLifecycleState) ?? "draft",
      targetingMode: (latest.targeting_mode as CampaignTargetingMode) ?? "broad_public",
      intendedChannels: asChannels((latest.intended_channels as string[]) ?? []),
      requestedAt: (latest.requested_at as string | null) ?? null,
      frozenAt: (latest.frozen_at as string | null) ?? null,
    };
  });
}

export async function getCampaignDetail(campaignId: string): Promise<CampaignDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, campaign_reference, name, created_by, created_at, campaign_versions(*, campaign_audience_rule_versions(*), campaign_approvals(*))"
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const versions = [...((data.campaign_versions as Array<Record<string, unknown>>) ?? [])]
    .sort((a, b) => Number(a.version_number) - Number(b.version_number))
    .map((version) => {
      const rules = (version.campaign_audience_rule_versions as Array<Record<string, unknown>> | Record<string, unknown> | null);
      const rule = Array.isArray(rules) ? rules[0] : rules;
      const approvals = version.campaign_approvals as Array<Record<string, unknown>> | Record<string, unknown> | null;
      const approval = Array.isArray(approvals) ? approvals[0] : approvals;
      return {
        id: String(version.id),
        campaignId: String(version.campaign_id),
        versionNumber: Number(version.version_number),
        title: String(version.title),
        status: version.status as CampaignLifecycleState,
        targetingMode: version.targeting_mode as CampaignTargetingMode,
        intendedChannels: asChannels(version.intended_channels as string[]),
        destinationReference: (version.destination_reference as string | null) ?? null,
        budgetSnapshot: (version.budget_snapshot as Record<string, Json | undefined>) ?? {},
        creativeSnapshot: (version.creative_snapshot as Record<string, Json | undefined>) ?? {},
        intendedWindowSnapshot: (version.intended_window_snapshot as Record<string, Json | undefined>) ?? {},
        configurationHash: (version.configuration_hash as string | null) ?? null,
        createdBy: String(version.created_by),
        requestedBy: (version.requested_by as string | null) ?? null,
        requestedAt: (version.requested_at as string | null) ?? null,
        frozenAt: (version.frozen_at as string | null) ?? null,
        lockVersion: Number(version.lock_version),
        ruleGroup: (rule?.rule_group as AudienceRuleGroup | undefined) ?? null,
        ruleHash: (rule?.rule_hash as string | null) ?? null,
        ruleFrozenAt: (rule?.frozen_at as string | null) ?? null,
        approvalDecision: (approval?.decision as "approved" | "rejected" | null) ?? null,
        approvalReason: (approval?.reason as string | null) ?? null,
        decidedBy: (approval?.decided_by as string | null) ?? null,
        decidedAt: (approval?.decided_at as string | null) ?? null,
      };
    });

  return {
    id: data.id,
    campaignReference: data.campaign_reference,
    name: data.name,
    createdBy: data.created_by,
    createdAt: data.created_at,
    versions,
  };
}

export async function previewCampaignAudience(
  campaignVersionId: string
): Promise<AudiencePreviewAggregates | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_campaign_audience", {
    p_campaign_version_id: campaignVersionId,
  });
  if (error) throw error;
  const row = data as Record<string, unknown>;
  return {
    targetingMode: row.targeting_mode as CampaignTargetingMode,
    ruleMatchLeadCount: Number(row.rule_match_lead_count ?? 0),
    distinctContactCount: Number(row.distinct_contact_count ?? 0),
    currentMarketingConsentCount: Number(row.current_marketing_consent_count ?? 0),
    dncBlockedCount: Number(row.dnc_blocked_count ?? 0),
    eligibleDirectOrCustomCount:
      row.eligible_direct_or_custom_count == null ? null : Number(row.eligible_direct_or_custom_count),
    evaluatedAt: String(row.evaluated_at),
    previewLabel: String(row.preview_label ?? "Current preview — eligibility will be rechecked before future execution."),
  };
}

export async function getMarketingConsentState(
  contactId: string
): Promise<MarketingConsentState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_contact_marketing_consent_state", {
    p_contact_id: contactId,
  });
  if (error) return null;
  const row = data as Record<string, unknown>;
  return {
    contactId: String(row.contact_id),
    currentGranted: Boolean(row.current_granted),
    latestEventType: (row.latest_event_type as string | null) ?? null,
    latestOccurredAt: (row.latest_occurred_at as string | null) ?? null,
    dnc: Boolean(row.dnc),
    contactStatus: String(row.contact_status ?? "active"),
    emailSuppressed: Boolean(row.email_suppressed),
    whatsappSuppressed: Boolean(row.whatsapp_suppressed),
    outreachBlocked: Boolean(row.outreach_blocked),
  };
}
