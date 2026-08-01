import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeAdminRedirect } from "@/server/auth/authorize";
import { getStaffClaims } from "@/server/auth/session";
import {
  hasCrmLeadReadAccess,
  type CrmAccessContext,
} from "../contracts/crm-access.ts";
import { probeCrmPermissions, probeCanAssignLeads } from "./crm-permissions.ts";

export type CrmAccessResolution =
  | { readonly kind: "granted"; readonly context: CrmAccessContext }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "inactive" }
  | { readonly kind: "denied" };

async function isActiveStaff(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();

  return profile?.status === "active";
}

/**
 * Resolves CRM workspace access using getClaims-aligned staff session probes.
 */
export async function resolveCrmAccess(): Promise<CrmAccessResolution> {
  const staff = await getStaffClaims();
  if (!staff) {
    return { kind: "unauthenticated" };
  }

  if (!(await isActiveStaff(staff.userId))) {
    return { kind: "inactive" };
  }

  const permissions = await probeCrmPermissions();
  const canAssignLeads = await probeCanAssignLeads();
  const context: CrmAccessContext = {
    userId: staff.userId,
    email: staff.email,
    canReadBroad: permissions["leads.read_all"],
    canReadAssigned: permissions["leads.read_assigned"],
    canReadSources: permissions["sources.read"],
    canReadActivities: permissions["crm.activities.read"],
    canReadConsents: permissions["consents.read"],
    canAssignLeads,
  };

  if (!hasCrmLeadReadAccess(context)) {
    return { kind: "denied" };
  }

  return { kind: "granted", context };
}

export async function getCrmAccessContext(): Promise<CrmAccessContext | null> {
  const resolution = await resolveCrmAccess();
  return resolution.kind === "granted" ? resolution.context : null;
}

export async function requireCrmReadAccess(
  currentPath: string = "/admin/crm"
): Promise<CrmAccessContext> {
  const resolution = await resolveCrmAccess();

  if (resolution.kind === "unauthenticated") {
    const safeNext = getSafeAdminRedirect(currentPath);
    const loginUrl =
      safeNext !== "/admin"
        ? `/auth/login?next=${encodeURIComponent(safeNext)}`
        : "/auth/login";
    redirect(loginUrl);
  }

  if (resolution.kind === "inactive") {
    redirect("/auth/forbidden");
  }

  if (resolution.kind === "denied") {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}
