import "server-only";

import { createClient } from "@/lib/supabase/server";

const CRM_PERMISSION_PROBE_CODES = [
  "leads.read_all",
  "leads.read_assigned",
  "sources.read",
  "crm.activities.read",
  "consents.read",
] as const;

export type CrmPermissionProbeCode =
  (typeof CRM_PERMISSION_PROBE_CODES)[number];

export type CrmPermissionProbeResult = Readonly<
  Record<CrmPermissionProbeCode, boolean>
>;

/**
 * Probes CRM-related permissions for the authenticated staff session.
 */
export async function probeCrmPermissions(): Promise<CrmPermissionProbeResult> {
  const supabase = await createClient();
  const entries = await Promise.all(
    CRM_PERMISSION_PROBE_CODES.map(async (code) => {
      const { data, error } = await supabase.rpc("authorize", {
        requested_permission: code,
      });

      return [code, !error && data === true] as const;
    })
  );

  return Object.fromEntries(entries) as CrmPermissionProbeResult;
}

export async function hasAnyCrmLeadReadPermission(): Promise<boolean> {
  const permissions = await probeCrmPermissions();
  return permissions["leads.read_all"] || permissions["leads.read_assigned"];
}
