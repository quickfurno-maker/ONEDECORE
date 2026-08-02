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

/**
 * Probes `leads.assign` for the authenticated staff session.
 */
export async function probeCanAssignLeads(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize", {
    requested_permission: "leads.assign",
  });

  return !error && data === true;
}

export interface ManualLeadPermissionProbeResult {
  readonly canCreateLeads: boolean;
  readonly canOverrideLeadDuplicate: boolean;
  readonly canManageLeadSources: boolean;
}

export interface LifecycleMutationPermissionProbeResult {
  readonly canTransitionLeads: boolean;
  readonly canManageLeadNotes: boolean;
  readonly canManageLeadFollowUps: boolean;
}

export async function probeLifecycleMutationPermissions(): Promise<LifecycleMutationPermissionProbeResult> {
  const supabase = await createClient();
  const codes = [
    "leads.transition",
    "crm.notes.manage",
    "crm.follow_ups.manage",
  ] as const;

  const entries = await Promise.all(
    codes.map(async (code) => {
      const { data, error } = await supabase.rpc("authorize", {
        requested_permission: code,
      });
      return [code, !error && data === true] as const;
    })
  );

  const map = Object.fromEntries(entries) as Record<(typeof codes)[number], boolean>;

  return {
    canTransitionLeads: map["leads.transition"],
    canManageLeadNotes: map["crm.notes.manage"],
    canManageLeadFollowUps: map["crm.follow_ups.manage"],
  };
}

export async function probeManualLeadPermissions(): Promise<ManualLeadPermissionProbeResult> {
  const supabase = await createClient();
  const codes = [
    "leads.create",
    "leads.duplicate_override",
    "sources.manage",
  ] as const;

  const entries = await Promise.all(
    codes.map(async (code) => {
      const { data, error } = await supabase.rpc("authorize", {
        requested_permission: code,
      });
      return [code, !error && data === true] as const;
    })
  );

  const map = Object.fromEntries(entries) as Record<(typeof codes)[number], boolean>;

  return {
    canCreateLeads: map["leads.create"],
    canOverrideLeadDuplicate: map["leads.duplicate_override"],
    canManageLeadSources: map["sources.manage"],
  };
}
