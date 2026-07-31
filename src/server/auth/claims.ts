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

  return {
    userId: staff.userId,
    email: staff.email,
    isActive: true,
    permissions,
  };
}
