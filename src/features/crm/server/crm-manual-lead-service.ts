import "server-only";

import { createClient } from "@/lib/supabase/server";
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

export async function previewManualLeadDuplicateForCurrentUser(
  input: ManualLeadDuplicatePreviewInput
): Promise<ManualLeadDuplicatePreview> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

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
  const supabase = await createClient();
  return callCheckManualLeadDuplicate(supabase, {
    phone: canonical.phone,
    email: canonical.email,
    serviceCode: canonical.serviceCode,
    propertyCode: canonical.propertyCode,
    locality: canonical.locality,
  });
}

export async function createManualLeadForCurrentUser(
  input: ManualLeadFormInput
): Promise<CrmLeadListRow> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

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

  const supabase = await createClient();
  return callCreateManualLead(supabase, withCanonicalPhone(input));
}

export async function fetchManualCreateAssigneeDirectory(
  context: CrmAccessContext
): Promise<readonly CrmAssigneeDirectoryEntry[]> {
  if (!context.canAssignLeads) {
    return [];
  }

  return fetchCrmAssigneeDirectory(context);
}
