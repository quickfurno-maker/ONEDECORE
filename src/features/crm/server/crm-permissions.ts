import "server-only";

import { authorizeMany, type PermissionAnswers } from "@/server/auth/authorize-many";
import { resolveCrmDb, type CrmDb } from "./crm-db.ts";

/**
 * CRM permission probes.
 *
 * WHY EACH PROBE IS A CODE LIST PLUS A PURE MAPPER
 *
 * Every probe here used to issue one `authorize` round trip per permission
 * inside a `Promise.all`. Measured on the real path, resolving the CRM access
 * context cost TWENTY-ONE round trips for one request — twenty-one distinct
 * permissions, none of them duplicated, none of them wrong to ask about. The
 * managed telemetry says the same thing at scale: 65,586 of 78,938 PostgREST
 * requests were `authorize`.
 *
 * So each probe is split into two halves that can be used together or apart:
 *
 *   XXX_CODES     the permissions it needs
 *   xxxFrom(...)  a pure function from answers to the probe's result shape
 *
 * Called on its own, a probe resolves its own codes in ONE round trip. Called
 * by `resolveCrmAccess`, which needs all of them, the union is resolved in one
 * round trip and each mapper reads its own answers out of the same result.
 *
 * The mappers are pure and total: a code missing from the answers reads as
 * `false`, so a partial response can only ever deny.
 *
 * `public.authorize` remains the only place the access rules live.
 * `public.authorize_many` is a loop over it, and nothing is cached.
 */

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

const ASSIGN_CODES = ["leads.assign"] as const;

const MANUAL_LEAD_CODES = [
  "leads.create",
  "leads.duplicate_override",
  "sources.manage",
] as const;

const LIFECYCLE_CODES = [
  "leads.transition",
  "crm.notes.manage",
  "crm.follow_ups.manage",
] as const;

const BULK_IMPORT_CODES = [
  "leads.bulk_import",
  "leads.bulk_import_approve",
  "leads.assignment_rules.manage",
] as const;

const SALES_TARGET_CODES = [
  "sales_targets.read",
  "sales_targets.manage",
  "crm.reporting.read",
] as const;

const CADENCE_CODES = ["crm.cadences.manage"] as const;
const SLA_POLICY_CODES = ["crm.sla.manage"] as const;
const LEAD_DELETION_CODES = ["leads.delete"] as const;

/**
 * Every CRM permission one access-context resolution needs.
 *
 * Deduplicated at the call, so listing a code in two probes costs nothing.
 */
export const CRM_ACCESS_CONTEXT_CODES = [
  ...CRM_PERMISSION_PROBE_CODES,
  ...ASSIGN_CODES,
  ...MANUAL_LEAD_CODES,
  ...LIFECYCLE_CODES,
  ...BULK_IMPORT_CODES,
  ...SALES_TARGET_CODES,
  ...CADENCE_CODES,
  ...SLA_POLICY_CODES,
  ...LEAD_DELETION_CODES,
] as const;

export type CrmPermissionCode = (typeof CRM_ACCESS_CONTEXT_CODES)[number];

/** Answers for any subset of the CRM codes. Missing means denied. */
export type CrmPermissionAnswers = PermissionAnswers<string>;

function granted(answers: CrmPermissionAnswers, code: string): boolean {
  return answers[code] === true;
}

/** Resolve every permission the CRM access context needs, in one round trip. */
export async function resolveCrmPermissionAnswers(
  db?: CrmDb
): Promise<CrmPermissionAnswers> {
  const supabase = await resolveCrmDb(db);
  return authorizeMany(CRM_ACCESS_CONTEXT_CODES, supabase);
}

// --------------------------------------------------------------- read scope ---

export function crmPermissionsFrom(
  answers: CrmPermissionAnswers
): CrmPermissionProbeResult {
  return Object.fromEntries(
    CRM_PERMISSION_PROBE_CODES.map((code) => [code, granted(answers, code)])
  ) as CrmPermissionProbeResult;
}

/**
 * Probes CRM-related permissions for the authenticated staff session.
 */
export async function probeCrmPermissions(db?: CrmDb): Promise<CrmPermissionProbeResult> {
  const supabase = await resolveCrmDb(db);
  return crmPermissionsFrom(await authorizeMany(CRM_PERMISSION_PROBE_CODES, supabase));
}

export async function hasAnyCrmLeadReadPermission(db?: CrmDb): Promise<boolean> {
  const permissions = await probeCrmPermissions(db);
  return permissions["leads.read_all"] || permissions["leads.read_assigned"];
}

// ------------------------------------------------------------------ assign ---

export function canAssignLeadsFrom(answers: CrmPermissionAnswers): boolean {
  return granted(answers, "leads.assign");
}

/**
 * Probes `leads.assign` for the authenticated staff session.
 */
export async function probeCanAssignLeads(db?: CrmDb): Promise<boolean> {
  const supabase = await resolveCrmDb(db);
  return canAssignLeadsFrom(await authorizeMany(ASSIGN_CODES, supabase));
}

// ------------------------------------------------------------- manual leads ---

export interface ManualLeadPermissionProbeResult {
  readonly canCreateLeads: boolean;
  readonly canOverrideLeadDuplicate: boolean;
  readonly canManageLeadSources: boolean;
}

export function manualLeadPermissionsFrom(
  answers: CrmPermissionAnswers
): ManualLeadPermissionProbeResult {
  return {
    canCreateLeads: granted(answers, "leads.create"),
    canOverrideLeadDuplicate: granted(answers, "leads.duplicate_override"),
    canManageLeadSources: granted(answers, "sources.manage"),
  };
}

export async function probeManualLeadPermissions(db?: CrmDb): Promise<ManualLeadPermissionProbeResult> {
  const supabase = await resolveCrmDb(db);
  return manualLeadPermissionsFrom(await authorizeMany(MANUAL_LEAD_CODES, supabase));
}

// ---------------------------------------------------------------- lifecycle ---

export interface LifecycleMutationPermissionProbeResult {
  readonly canTransitionLeads: boolean;
  readonly canManageLeadNotes: boolean;
  readonly canManageLeadFollowUps: boolean;
}

export function lifecycleMutationPermissionsFrom(
  answers: CrmPermissionAnswers
): LifecycleMutationPermissionProbeResult {
  return {
    canTransitionLeads: granted(answers, "leads.transition"),
    canManageLeadNotes: granted(answers, "crm.notes.manage"),
    canManageLeadFollowUps: granted(answers, "crm.follow_ups.manage"),
  };
}

export async function probeLifecycleMutationPermissions(db?: CrmDb): Promise<LifecycleMutationPermissionProbeResult> {
  const supabase = await resolveCrmDb(db);
  return lifecycleMutationPermissionsFrom(await authorizeMany(LIFECYCLE_CODES, supabase));
}

// --------------------------------------------------------------- bulk import ---

export interface BulkImportPermissionProbeResult {
  readonly canBulkImportLeads: boolean;
  readonly canApproveLeadImports: boolean;
  readonly canManageLeadAssignmentRules: boolean;
}

export function bulkImportPermissionsFrom(
  answers: CrmPermissionAnswers
): BulkImportPermissionProbeResult {
  return {
    canBulkImportLeads: granted(answers, "leads.bulk_import"),
    canApproveLeadImports: granted(answers, "leads.bulk_import_approve"),
    canManageLeadAssignmentRules: granted(answers, "leads.assignment_rules.manage"),
  };
}

export async function probeBulkImportPermissions(db?: CrmDb): Promise<BulkImportPermissionProbeResult> {
  const supabase = await resolveCrmDb(db);
  return bulkImportPermissionsFrom(await authorizeMany(BULK_IMPORT_CODES, supabase));
}

// -------------------------------------------------------------- sales targets ---

export interface SalesTargetPermissionProbeResult {
  readonly canReadSalesTargets: boolean;
  readonly canManageSalesTargets: boolean;
  readonly canReadCrmReporting: boolean;
}

export function salesTargetPermissionsFrom(
  answers: CrmPermissionAnswers
): SalesTargetPermissionProbeResult {
  return {
    canReadSalesTargets: granted(answers, "sales_targets.read"),
    canManageSalesTargets: granted(answers, "sales_targets.manage"),
    canReadCrmReporting: granted(answers, "crm.reporting.read"),
  };
}

export async function probeSalesTargetPermissions(db?: CrmDb): Promise<SalesTargetPermissionProbeResult> {
  const supabase = await resolveCrmDb(db);
  return salesTargetPermissionsFrom(await authorizeMany(SALES_TARGET_CODES, supabase));
}

// ------------------------------------------------------------------ cadences ---

export interface CadencePermissionProbeResult {
  readonly canManageCadences: boolean;
}

export function cadencePermissionsFrom(
  answers: CrmPermissionAnswers
): CadencePermissionProbeResult {
  return { canManageCadences: granted(answers, "crm.cadences.manage") };
}

/**
 * Probes `crm.cadences.manage` — CRM 2C cadence template lifecycle (D3).
 */
export async function probeCadencePermissions(db?: CrmDb): Promise<CadencePermissionProbeResult> {
  const supabase = await resolveCrmDb(db);
  return cadencePermissionsFrom(await authorizeMany(CADENCE_CODES, supabase));
}

// ---------------------------------------------------------------- SLA policy ---

export interface SlaPolicyPermissionProbeResult {
  readonly canManageSlaPolicy: boolean;
}

export function slaPolicyPermissionsFrom(
  answers: CrmPermissionAnswers
): SlaPolicyPermissionProbeResult {
  return { canManageSlaPolicy: granted(answers, "crm.sla.manage") };
}

/**
 * Probes `crm.sla.manage` — CRM first-contact SLA policy administration.
 * Super Admin only; `public.update_crm_sla_policy` re-checks it in the DB.
 */
export async function probeSlaPolicyPermissions(db?: CrmDb): Promise<SlaPolicyPermissionProbeResult> {
  const supabase = await resolveCrmDb(db);
  return slaPolicyPermissionsFrom(await authorizeMany(SLA_POLICY_CODES, supabase));
}

// -------------------------------------------------------------- lead deletion ---

export interface LeadDeletionPermissionProbeResult {
  readonly canDeleteLeads: boolean;
}

export function leadDeletionPermissionsFrom(
  answers: CrmPermissionAnswers
): LeadDeletionPermissionProbeResult {
  return { canDeleteLeads: granted(answers, "leads.delete") };
}

/**
 * Whether this caller may DELETE an enquiry.
 *
 * Its own probe, not a flag folded into the lifecycle one. Deleting an enquiry
 * and marking it CLOSED LOST are different authorities held by different roles:
 * closed lost is the sales team's ordinary lifecycle transition, delete is the
 * owner's. Resolving them together is how they would end up sharing a check.
 */
export async function probeLeadDeletionPermissions(
  db?: CrmDb
): Promise<LeadDeletionPermissionProbeResult> {
  const supabase = await resolveCrmDb(db);
  return leadDeletionPermissionsFrom(await authorizeMany(LEAD_DELETION_CODES, supabase));
}
