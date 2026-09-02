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

export interface BulkImportPermissionProbeResult {
  readonly canBulkImportLeads: boolean;
  readonly canApproveLeadImports: boolean;
  readonly canManageLeadAssignmentRules: boolean;
}

export async function probeBulkImportPermissions(): Promise<BulkImportPermissionProbeResult> {
  const supabase = await createClient();
  const codes = [
    "leads.bulk_import",
    "leads.bulk_import_approve",
    "leads.assignment_rules.manage",
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
    canBulkImportLeads: map["leads.bulk_import"],
    canApproveLeadImports: map["leads.bulk_import_approve"],
    canManageLeadAssignmentRules: map["leads.assignment_rules.manage"],
  };
}

export interface CadencePermissionProbeResult {
  readonly canManageCadences: boolean;
}

/**
 * Probes `crm.cadences.manage` — CRM 2C cadence template lifecycle (D3).
 */
export async function probeCadencePermissions(): Promise<CadencePermissionProbeResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize", {
    requested_permission: "crm.cadences.manage",
  });

  return { canManageCadences: !error && data === true };
}

export interface SlaPolicyPermissionProbeResult {
  readonly canManageSlaPolicy: boolean;
}

/**
 * Probes `crm.sla.manage` — CRM first-contact SLA policy administration.
 * Super Admin only; `public.update_crm_sla_policy` re-checks it in the DB.
 */
export async function probeSlaPolicyPermissions(): Promise<SlaPolicyPermissionProbeResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize", {
    requested_permission: "crm.sla.manage",
  });

  return { canManageSlaPolicy: !error && data === true };
}

export interface SalesTargetPermissionProbeResult {
  readonly canReadSalesTargets: boolean;
  readonly canManageSalesTargets: boolean;
  readonly canReadCrmReporting: boolean;
}

export async function probeSalesTargetPermissions(): Promise<SalesTargetPermissionProbeResult> {
  const supabase = await createClient();
  const codes = [
    "sales_targets.read",
    "sales_targets.manage",
    "crm.reporting.read",
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
    canReadSalesTargets: map["sales_targets.read"],
    canManageSalesTargets: map["sales_targets.manage"],
    canReadCrmReporting: map["crm.reporting.read"],
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
