import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface LandingLabPermissionProbe {
  readonly canRead: boolean;
  readonly canManage: boolean;
  readonly canPublish: boolean;
  readonly canManageExperiments: boolean;
  readonly canReadAnalytics: boolean;
}

export async function probeLandingLabPermissions(): Promise<LandingLabPermissionProbe> {
  const supabase = await createClient();
  const [readRes, manageRes, publishRes, experimentRes, analyticsRes] = await Promise.all([
    supabase.rpc("authorize", { requested_permission: "landing_pages.read" }),
    supabase.rpc("authorize", { requested_permission: "landing_pages.manage" }),
    supabase.rpc("authorize", { requested_permission: "landing_pages.publish" }),
    supabase.rpc("authorize", { requested_permission: "landing_experiments.manage" }),
    supabase.rpc("authorize", { requested_permission: "landing_analytics.read" }),
  ]);
  return {
    canRead: !readRes.error && readRes.data === true,
    canManage: !manageRes.error && manageRes.data === true,
    canPublish: !publishRes.error && publishRes.data === true,
    canManageExperiments: !experimentRes.error && experimentRes.data === true,
    canReadAnalytics: !analyticsRes.error && analyticsRes.data === true,
  };
}

export async function hasLandingPagesReadPermission(): Promise<boolean> {
  const probe = await probeLandingLabPermissions();
  return probe.canRead;
}
