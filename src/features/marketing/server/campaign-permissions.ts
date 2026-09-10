import "server-only";

import { createClient } from "@/lib/supabase/server";
import { authorizeMany } from "@/server/auth/authorize-many";

export interface CampaignPermissionProbeResult {
  readonly canReadCampaigns: boolean;
  readonly canDraftCampaigns: boolean;
  readonly canRequestCampaignApproval: boolean;
  readonly canApproveCampaigns: boolean;
  readonly canManageMarketingConsent: boolean;
  readonly canExecuteCampaigns: boolean;
  readonly canPauseCampaigns: boolean;
  readonly canReadCampaignMetrics: boolean;
  readonly isSuperAdmin: boolean;
  readonly isSalesManager: boolean;
}

export async function probeCampaignPermissions(): Promise<CampaignPermissionProbeResult> {
  const supabase = await createClient();
  /*
   * Two round trips, not 10.
   *
   * `authorize_many` loops over `public.authorize`, so the access rules are
   * unchanged; only the number of times this page asks them has. The role
   * checks stay individual — `has_active_role` is about a thirtieth of the
   * managed authorization traffic, and a second batch endpoint for it would
   * be machinery bought for very little — but they no longer wait for the
   * permissions, because neither read depends on the other.
   */
  const [answers, [
    sa,
    sm,
  ]] = await Promise.all([
    authorizeMany(
      [
        "campaigns.read",
        "campaigns.draft",
        "campaigns.request_approval",
        "campaigns.approve",
        "marketing_consents.manage",
        "campaigns.execute",
        "campaigns.pause",
        "campaigns.metrics.read",
      ] as const,
      supabase
    ),
    Promise.all([
      supabase.rpc("has_active_role", { p_role_code: "super_admin" }),
      supabase.rpc("has_active_role", { p_role_code: "sales_manager" }),
    ]),
  ]);
  return {
    canReadCampaigns: answers["campaigns.read"],
    canDraftCampaigns: answers["campaigns.draft"],
    canRequestCampaignApproval: answers["campaigns.request_approval"],
    canApproveCampaigns: answers["campaigns.approve"],
    canManageMarketingConsent: answers["marketing_consents.manage"],
    canExecuteCampaigns: answers["campaigns.execute"],
    canPauseCampaigns: answers["campaigns.pause"],
    canReadCampaignMetrics: answers["campaigns.metrics.read"],
    isSuperAdmin: !sa.error && sa.data === true,
    isSalesManager: !sm.error && sm.data === true,
  };
}

export async function hasAnyCampaignReadPermission(): Promise<boolean> {
  const probe = await probeCampaignPermissions();
  return probe.canReadCampaigns;
}
