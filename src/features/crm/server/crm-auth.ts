import "server-only";

import { redirect } from "next/navigation";
import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
import { getSafeAdminRedirect } from "@/server/auth/authorize";
import { getStaffClaims } from "@/server/auth/session";
import {
  hasCrmLeadReadAccess,
  type CrmAccessContext,
} from "../contracts/crm-access.ts";
import {
  probeCrmPermissions,
  probeCanAssignLeads,
  probeBulkImportPermissions,
  probeLifecycleMutationPermissions,
  probeCadencePermissions,
  probeManualLeadPermissions,
  probeSalesTargetPermissions,
  probeSlaPolicyPermissions,
} from "./crm-permissions.ts";

export type CrmAccessResolution =
  | { readonly kind: "granted"; readonly context: CrmAccessContext }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "inactive" }
  | { readonly kind: "denied" };

async function isActiveStaff(userId: string, db?: CrmDb): Promise<boolean> {
  const supabase = await resolveCrmDb(db);
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
export async function resolveCrmAccess(
  options: { db?: CrmDb; staff?: { userId: string; email: string | null } } = {}
): Promise<CrmAccessResolution> {
  const { db } = options;

  /*
   * The caller is either resolved from cookies (browser workspace) or handed in
   * already resolved from a bearer token (mobile). Everything after this point
   * is identical for both, which is the whole point: one permission model, one
   * access context, two transports.
   */
  const staff = options.staff ?? (await getStaffClaims());
  if (!staff) {
    return { kind: "unauthenticated" };
  }

  if (!(await isActiveStaff(staff.userId, db))) {
    return { kind: "inactive" };
  }

  const permissions = await probeCrmPermissions(db);
  const canAssignLeads = await probeCanAssignLeads(db);
  const [
    manualLeadPermissions,
    lifecyclePermissions,
    bulkImportPermissions,
    salesTargetPermissions,
    cadencePermissions,
    slaPolicyPermissions,
  ] = await Promise.all([
      probeManualLeadPermissions(db),
      probeLifecycleMutationPermissions(db),
      probeBulkImportPermissions(db),
      probeSalesTargetPermissions(db),
      probeCadencePermissions(db),
      probeSlaPolicyPermissions(db),
    ]);
  const context: CrmAccessContext = {
    userId: staff.userId,
    email: staff.email,
    canReadBroad: permissions["leads.read_all"],
    canReadAssigned: permissions["leads.read_assigned"],
    canReadSources: permissions["sources.read"],
    canReadActivities: permissions["crm.activities.read"],
    canReadConsents: permissions["consents.read"],
    canAssignLeads,
    canCreateLeads: manualLeadPermissions.canCreateLeads,
    canOverrideLeadDuplicate: manualLeadPermissions.canOverrideLeadDuplicate,
    canManageLeadSources: manualLeadPermissions.canManageLeadSources,
    canTransitionLeads: lifecyclePermissions.canTransitionLeads,
    canManageLeadNotes: lifecyclePermissions.canManageLeadNotes,
    canManageLeadFollowUps: lifecyclePermissions.canManageLeadFollowUps,
    canBulkImportLeads: bulkImportPermissions.canBulkImportLeads,
    canApproveLeadImports: bulkImportPermissions.canApproveLeadImports,
    canManageLeadAssignmentRules:
      bulkImportPermissions.canManageLeadAssignmentRules,
    canReadSalesTargets: salesTargetPermissions.canReadSalesTargets,
    canManageSalesTargets: salesTargetPermissions.canManageSalesTargets,
    canReadCrmReporting: salesTargetPermissions.canReadCrmReporting,
    canManageCadences: cadencePermissions.canManageCadences,
    canManageSlaPolicy: slaPolicyPermissions.canManageSlaPolicy,
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

export async function requireCrmCreateAccess(
  currentPath: string = "/admin/crm/leads/new"
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

  if (resolution.kind === "denied" || !resolution.context.canCreateLeads) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireCrmBulkImportAccess(
  currentPath: string = "/admin/crm/imports"
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

  if (resolution.kind === "denied" || !resolution.context.canBulkImportLeads) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireCrmAssignmentRulesAccess(
  currentPath: string = "/admin/crm/settings/assignment-rules"
): Promise<CrmAccessContext> {
  return requireCrmAssignmentRuleAccess(currentPath);
}

export async function requireCrmAssignmentRuleAccess(
  currentPath: string = "/admin/crm/settings/assignment-rules"
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

  if (
    resolution.kind === "denied" ||
    !resolution.context.canManageLeadAssignmentRules
  ) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireCrmSlaPolicyAccess(
  currentPath: string = "/admin/crm/settings/sla"
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

  if (resolution.kind === "denied" || !resolution.context.canManageSlaPolicy) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireCrmSalesTargetsAccess(
  currentPath: string = "/admin/crm/targets"
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

  if (resolution.kind === "denied" || !resolution.context.canReadSalesTargets) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireCrmCadenceAccess(
  currentPath: string = "/admin/crm/cadences"
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

  if (resolution.kind === "denied" || !resolution.context.canManageCadences) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}

export async function requireCrmReportingAccess(
  currentPath: string = "/admin/crm/reports"
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

  if (resolution.kind === "denied" || !resolution.context.canReadCrmReporting) {
    redirect("/auth/forbidden");
  }

  return resolution.context;
}
