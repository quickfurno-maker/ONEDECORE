import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface CampaignPermissionProbeResult {
  readonly canReadCampaigns: boolean;
  readonly canDraftCampaigns: boolean;
  readonly canRequestCampaignApproval: boolean;
  readonly canApproveCampaigns: boolean;
  readonly canManageMarketingConsent: boolean;
  readonly isSuperAdmin: boolean;
  readonly isSalesManager: boolean;
}

export async function probeCampaignPermissions(): Promise<CampaignPermissionProbeResult> {
  const supabase = await createClient();
  const [readRes, draftRes, requestRes, approveRes, consentRes, sa, sm] = await Promise.all([
    supabase.rpc("authorize", { requested_permission: "campaigns.read" }),
    supabase.rpc("authorize", { requested_permission: "campaigns.draft" }),
    supabase.rpc("authorize", { requested_permission: "campaigns.request_approval" }),
    supabase.rpc("authorize", { requested_permission: "campaigns.approve" }),
    supabase.rpc("authorize", { requested_permission: "marketing_consents.manage" }),
    supabase.rpc("has_active_role", { p_role_code: "super_admin" }),
    supabase.rpc("has_active_role", { p_role_code: "sales_manager" }),
  ]);

  return {
    canReadCampaigns: !readRes.error && readRes.data === true,
    canDraftCampaigns: !draftRes.error && draftRes.data === true,
    canRequestCampaignApproval: !requestRes.error && requestRes.data === true,
    canApproveCampaigns: !approveRes.error && approveRes.data === true,
    canManageMarketingConsent: !consentRes.error && consentRes.data === true,
    isSuperAdmin: !sa.error && sa.data === true,
    isSalesManager: !sm.error && sm.data === true,
  };
}

export async function hasAnyCampaignReadPermission(): Promise<boolean> {
  const probe = await probeCampaignPermissions();
  return probe.canReadCampaigns;
}
