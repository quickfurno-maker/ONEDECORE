import "server-only";

import { createClient } from "@/lib/supabase/server";
import { authorizeMany } from "@/server/auth/authorize-many";

export interface LandingLabPermissionProbe {
  readonly canRead: boolean;
  readonly canManage: boolean;
  readonly canPublish: boolean;
  readonly canManageExperiments: boolean;
  readonly canReadAnalytics: boolean;
}

export async function probeLandingLabPermissions(): Promise<LandingLabPermissionProbe> {
  const supabase = await createClient();
  /*
   * One round trip, not 5. `authorize_many` loops over
   * `public.authorize`, so the access rules are unchanged; only the number
   * of times the page asks them has.
   */
  const answers = await authorizeMany(
    [
    "landing_pages.read",
    "landing_pages.manage",
    "landing_pages.publish",
    "landing_experiments.manage",
    "landing_analytics.read",
    ] as const,
    supabase
  );
  return {
    canRead: !false && answers["landing_pages.read"],
    canManage: !false && answers["landing_pages.manage"],
    canPublish: !false && answers["landing_pages.publish"],
    canManageExperiments: !false && answers["landing_experiments.manage"],
    canReadAnalytics: !false && answers["landing_analytics.read"],
  };
}

export async function hasLandingPagesReadPermission(): Promise<boolean> {
  const probe = await probeLandingLabPermissions();
  return probe.canRead;
}
