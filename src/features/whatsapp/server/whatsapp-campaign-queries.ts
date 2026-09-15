import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  parseWhatsappCampaignPreview,
  parseWhatsappCampaignRunBreakdown,
  parseWhatsappCampaignTemplateOptions,
  parseWhatsappCampaignTestDestinations,
  parseWhatsappCampaignVersionDetail,
  parseWhatsappCampaignVersionList,
  WHATSAPP_CAMPAIGN_EXECUTION_RPC,
  type WhatsappCampaignPreview,
  type WhatsappCampaignRunBreakdown,
  type WhatsappCampaignTemplateOption,
  type WhatsappCampaignTestDestination,
  type WhatsappCampaignVersionDetail,
  type WhatsappCampaignVersionSummary,
} from "../contracts/campaign-execution.ts";
import { isUuid } from "../contracts/control-plane.ts";

/*
 * Campaign reads through the CALLER's session, and only through definer RPCs
 * that scope what the caller may see: Super Admin (campaigns.read) sees every
 * WhatsApp-only version; a Sales Manager (whatsapp.campaigns.execute, no
 * generic campaigns.read) sees approved WhatsApp-only versions only, so no
 * paid-ads campaign ever reaches them. Approval is the generic
 * `campaign_approvals` decision, echoed read-only.
 */

export async function listWhatsappCampaignVersionsForCurrentUser(): Promise<readonly WhatsappCampaignVersionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.listVersions);
  if (error) return [];
  return parseWhatsappCampaignVersionList(data);
}

/** Invisible and missing versions both come back null: no existence oracle. */
export async function getWhatsappCampaignVersionForCurrentUser(versionId: string): Promise<WhatsappCampaignVersionDetail | null> {
  if (!isUuid(versionId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.getVersion, { p_campaign_version_id: versionId });
  if (error) return null;
  return parseWhatsappCampaignVersionDetail(data);
}

/** The spec's tracked-link / Flow button mapping. RLS: campaigns.read, or execute on a frozen spec. */
export async function getWhatsappCampaignSpecButtonBindingsForCurrentUser(
  versionId: string
): Promise<Readonly<Record<string, Readonly<Record<string, string>>>>> {
  if (!isUuid(versionId)) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_campaign_specs")
    .select("button_bindings")
    .eq("campaign_version_id", versionId)
    .maybeSingle();
  if (error || !data || typeof data.button_bindings !== "object" || data.button_bindings === null || Array.isArray(data.button_bindings)) {
    return {};
  }
  const out: Record<string, Record<string, string>> = {};
  for (const [index, binding] of Object.entries(data.button_bindings as Record<string, unknown>)) {
    if (typeof binding !== "object" || binding === null) continue;
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(binding as Record<string, unknown>)) {
      if (typeof value === "string") values[key] = value;
    }
    out[index] = values;
  }
  return out;
}

/** Sendable APPROVED MARKETING snapshots. Requires campaigns.draft + whatsapp.templates.read. */
export async function listWhatsappCampaignTemplateOptionsForCurrentUser(): Promise<readonly WhatsappCampaignTemplateOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.listTemplateOptions);
  if (error) return [];
  return parseWhatsappCampaignTemplateOptions(data);
}

export async function listWhatsappCampaignTestDestinationsForCurrentUser(): Promise<readonly WhatsappCampaignTestDestination[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.listTestDestinations);
  if (error) return [];
  return parseWhatsappCampaignTestDestinations(data);
}

export interface WhatsappCampaignTestSendView {
  readonly id: string;
  readonly destinationLabel: string;
  readonly outcome: string;
  readonly lastErrorCode: string | null;
  readonly createdAt: string;
}

/** RLS: whatsapp.campaigns.test_send. */
export async function listWhatsappCampaignTestSendsForCurrentUser(versionId: string): Promise<readonly WhatsappCampaignTestSendView[]> {
  if (!isUuid(versionId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_campaign_test_sends")
    .select("id, destination_label, outcome, last_error_code, created_at")
    .eq("campaign_version_id", versionId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    destinationLabel: row.destination_label,
    outcome: row.outcome,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at,
  }));
}

export type WhatsappCampaignPreviewRead =
  | { readonly kind: "ready"; readonly preview: WhatsappCampaignPreview }
  | { readonly kind: "failed"; readonly code: string | null };

export async function previewWhatsappCampaignAudienceForCurrentUser(versionId: string): Promise<WhatsappCampaignPreviewRead> {
  if (!isUuid(versionId)) return { kind: "failed", code: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.previewAudience, {
    p_campaign_version_id: versionId,
  });
  if (error) return { kind: "failed", code: error.code ?? null };
  const preview = parseWhatsappCampaignPreview(data);
  return preview ? { kind: "ready", preview } : { kind: "failed", code: null };
}

export async function getWhatsappCampaignRunBreakdownForCurrentUser(runId: string): Promise<WhatsappCampaignRunBreakdown | null> {
  if (!isUuid(runId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.runBreakdown, { p_run_id: runId });
  if (error) return null;
  return parseWhatsappCampaignRunBreakdown(data);
}

export interface WhatsappClickDestinationView {
  readonly id: string;
  readonly label: string;
  readonly destinationUrl: string;
  readonly isActive: boolean;
}

export async function listWhatsappClickDestinationsForCurrentUser(): Promise<readonly WhatsappClickDestinationView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_CAMPAIGN_EXECUTION_RPC.listClickDestinations);
  if (error || !Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const row = item as Record<string, unknown>;
    return typeof row.id === "string" && typeof row.label === "string" && typeof row.destination_url === "string"
      ? [{ id: row.id, label: row.label, destinationUrl: row.destination_url, isActive: row.is_active === true }]
      : [];
  });
}
