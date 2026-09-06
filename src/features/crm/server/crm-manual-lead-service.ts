import "server-only";

import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import type { CrmAssigneeDirectoryEntry } from "../contracts/lead-detail-dtos.ts";
import type {
  ManualCreateAssigneePolicy,
  ManualLeadDuplicatePreview,
  ManualLeadDuplicatePreviewInput,
  ManualLeadFormInput,
} from "../contracts/manual-lead-contracts.ts";
import {
  validateManualLeadDuplicatePreviewInput,
  validateManualLeadFormInput,
} from "../contracts/manual-lead-contracts.ts";
import type { CrmLeadListRow } from "../contracts/lead-dtos.ts";
import { canonicalizeOptionalPhone } from "../lib/phone-e164.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { CrmError } from "./crm-errors.ts";
import { fetchCrmAssigneeDirectory } from "./crm-lead-queries.ts";
import {
  callCheckManualLeadDuplicate,
  callCreateManualLead,
} from "./crm-transition-adapters.ts";

function withCanonicalPhone<T extends { readonly phone: string | null }>(
  input: T
): T {
  return {
    ...input,
    phone: canonicalizeOptionalPhone(input.phone).phone,
  };
}

export function resolveManualCreateAssigneePolicy(
  context: CrmAccessContext
): ManualCreateAssigneePolicy {
  if (!context.canAssignLeads) {
    return { mode: "executive_self" };
  }

  if (context.canManageLeadSources) {
    return { mode: "admin", allowSelf: false };
  }

  return { mode: "manager", allowSelf: true };
}

/**
 * Duplicate preview for a caller whose access context is already known.
 *
 * The browser resolves that context from cookies; the mobile route resolves it
 * from a bearer token. Everything after that point — the permission assertion,
 * the canonical phone normalisation, the validator and the duplicate RPC — is
 * this one function, so the two surfaces cannot answer differently.
 *
 * The client is injected for the same reason every other CRM read takes one:
 * a bearer request has no cookie to fall back to.
 */
export async function previewManualLeadDuplicateForContext(
  context: CrmAccessContext,
  input: ManualLeadDuplicatePreviewInput,
  db?: CrmDb
): Promise<ManualLeadDuplicatePreview> {
  if (!context.canCreateLeads) {
    throw new CrmError({
      code: "PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }

  const validationErrors = validateManualLeadDuplicatePreviewInput(input);
  if (validationErrors.length > 0) {
    throw new CrmError({
      code: "INVALID_MANUAL_LEAD",
      message: validationErrors[0]?.message ?? "Validation failed",
      httpStatus: 422,
      details: validationErrors.map((entry) => entry.message).join("; "),
    });
  }

  const canonical = withCanonicalPhone(input);
  const supabase = await resolveCrmDb(db);
  return callCheckManualLeadDuplicate(supabase, {
    phone: canonical.phone,
    email: canonical.email,
    serviceCode: canonical.serviceCode,
    propertyCode: canonical.propertyCode,
    locality: canonical.locality,
  });
}

/** The browser entry point, unchanged in behaviour. */
export async function previewManualLeadDuplicateForCurrentUser(
  input: ManualLeadDuplicatePreviewInput
): Promise<ManualLeadDuplicatePreview> {
  return previewManualLeadDuplicateForContext(
    await requireManualLeadContext(),
    input
  );
}

/**
 * Manual lead creation for a caller whose access context is already known.
 *
 * Every rule stays here and below: the create permission, the assignee policy,
 * the field validator, the duplicate-override permission, the canonical phone
 * normalisation, and finally `create_manual_lead`, which is the authority on
 * assignment and on duplicates regardless of what any preview said.
 */
export async function createManualLeadForContext(
  context: CrmAccessContext,
  input: ManualLeadFormInput,
  db?: CrmDb
): Promise<CrmLeadListRow> {
  if (!context.canCreateLeads) {
    throw new CrmError({
      code: "PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }

  const policy = resolveManualCreateAssigneePolicy(context);
  const validationErrors = validateManualLeadFormInput(input, policy);
  if (validationErrors.length > 0) {
    throw new CrmError({
      code: "INVALID_MANUAL_LEAD",
      message: validationErrors[0]?.message ?? "Validation failed",
      httpStatus: 422,
      details: validationErrors.map((entry) => entry.message).join("; "),
    });
  }

  if (
    input.duplicateOverride &&
    !context.canOverrideLeadDuplicate
  ) {
    throw new CrmError({
      code: "DUPLICATE_OVERRIDE_DENIED",
      message: "You are not allowed to override this duplicate warning.",
      httpStatus: 403,
    });
  }

  const supabase = await resolveCrmDb(db);
  return callCreateManualLead(supabase, withCanonicalPhone(input));
}

/** The browser entry point, unchanged in behaviour. */
export async function createManualLeadForCurrentUser(
  input: ManualLeadFormInput
): Promise<CrmLeadListRow> {
  return createManualLeadForContext(
    await requireManualLeadContext(),
    input
  );
}

export async function fetchManualCreateAssigneeDirectoryForContext(
  context: CrmAccessContext,
  db?: CrmDb
): Promise<readonly CrmAssigneeDirectoryEntry[]> {
  /*
   * A caller who cannot assign has no directory to choose from — the database
   * self-assigns them — so an empty list is the honest answer, not a failure.
   */
  if (!context.canAssignLeads) {
    return [];
  }

  return fetchCrmAssigneeDirectory(context, db);
}

/** The browser entry point, unchanged in behaviour. */
export async function fetchManualCreateAssigneeDirectory(
  context: CrmAccessContext
): Promise<readonly CrmAssigneeDirectoryEntry[]> {
  return fetchManualCreateAssigneeDirectoryForContext(context);
}

/** The cookie-scoped context both browser wrappers above resolve. */
async function requireManualLeadContext(): Promise<CrmAccessContext> {
  const context = await getCrmAccessContext();

  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  return context;
}
