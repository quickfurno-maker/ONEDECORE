import { createClient } from "@/lib/supabase/server";
import { getStaffClaims } from "./session";

export interface VerifiedClaims {
  userId: string;
  email: string | null;
  isActive: boolean;
  permissions: string[];
}

/**
 * Retrieves verified staff claims and active status / permissions.
 * Never relies on unverified getSession() or raw JWT tokens.
 */
export async function getClaims(): Promise<VerifiedClaims | null> {
  const staff = await getStaffClaims();
  if (!staff) return null;

  const supabase = await createClient();

  // Check active profile status
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", staff.userId)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    return null;
  }

  // Check permissions via authorize RPC
  const permissions: string[] = [];

  const { data: hasManage } = await supabase.rpc("authorize", {
    requested_permission: "portfolio.manage",
  });

  const { data: hasRead } = await supabase.rpc("authorize", {
    requested_permission: "portfolio.read",
  });

  const { data: hasAdminAccess } = await supabase.rpc("authorize", {
    requested_permission: "admin.access",
  });

  const { data: hasLeadsReadAll } = await supabase.rpc("authorize", {
    requested_permission: "leads.read_all",
  });

  const { data: hasLeadsReadAssigned } = await supabase.rpc("authorize", {
    requested_permission: "leads.read_assigned",
  });

  const { data: hasSourcesRead } = await supabase.rpc("authorize", {
    requested_permission: "sources.read",
  });

  /*
   * Website Manager.
   *
   * This list is an explicit probe set rather than "every permission the user
   * holds", so a new permission is invisible here until it is added. That is
   * the failure this line fixes: `website.manage` was granted in the database
   * and enforced by every policy, and the admin page still refused the owner
   * because the claim set it checks never contained the string.
   */
  const { data: hasWebsiteManage } = await supabase.rpc("authorize", {
    requested_permission: "website.manage",
  });

  const { data: hasCrmActivitiesRead } = await supabase.rpc("authorize", {
    requested_permission: "crm.activities.read",
  });

  if (hasManage === true) permissions.push("portfolio.manage");
  if (hasRead === true) permissions.push("portfolio.read");
  if (hasAdminAccess === true) permissions.push("admin.access");
  if (hasLeadsReadAll === true) permissions.push("leads.read_all");
  if (hasLeadsReadAssigned === true) permissions.push("leads.read_assigned");
  if (hasSourcesRead === true) permissions.push("sources.read");
  if (hasCrmActivitiesRead === true) permissions.push("crm.activities.read");
  if (hasWebsiteManage === true) permissions.push("website.manage");

  return {
    userId: staff.userId,
    email: staff.email,
    isActive: true,
    permissions,
  };
}
