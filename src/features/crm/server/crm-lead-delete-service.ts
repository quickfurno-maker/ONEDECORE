import "server-only";

import type { CrmAccessContext } from "../contracts/crm-access.ts";
import type { LeadDeleteInput } from "../contracts/lead-delete-contracts.ts";
import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

/**
 * Calls the one operation that can tombstone an enquiry.
 *
 * The authenticated staff client, never a service role. The RPC checks
 * `leads.delete` AND the `super_admin` role itself, so this module is a
 * transport: if it were the thing deciding, a second caller could decide
 * differently.
 *
 * TWO CALLERS, ONE CALL. The browser action resolves its user from cookies and
 * asserts `canDeleteLeads` before it gets here; the mobile route resolves a
 * bearer caller and hands its context and client to `deleteLeadForContext`.
 * Both end up in `callDeleteLeadTombstone` with a caller-scoped client, so the
 * blockers that actually matter — closed_won, an existing quotation, an
 * acceptance, a project, a stale `updated_at` — are evaluated once, inside the
 * database, for either surface.
 */

export interface LeadDeleteResult {
  readonly leadId: string;
  readonly deletionReference: string;
  readonly deletedAt: string;
}

/**
 * The RPC and its answer, and nothing else.
 *
 * No permission decision lives here on purpose: a transport that also decided
 * would be a second place the answer could differ from the database's.
 */
async function callDeleteLeadTombstone(
  supabase: CrmDb,
  input: LeadDeleteInput
): Promise<LeadDeleteResult> {
  const { data, error } = await supabase.rpc("delete_lead_tombstone", {
    p_lead_id: input.leadId,
    p_reason: input.reason.trim(),
    p_expected_updated_at: input.expectedUpdatedAt,
    p_confirmation: input.confirmation,
  });

  if (error) {
    // The database speaks in stable tokens; the caller sees a sentence.
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const row = (data ?? {}) as {
    lead_id?: unknown;
    deletion_reference?: unknown;
    deleted_at?: unknown;
  };

  if (
    typeof row.lead_id !== "string" ||
    typeof row.deletion_reference !== "string" ||
    typeof row.deleted_at !== "string"
  ) {
    throw new CrmError({
      code: "RPC_FAILED",
      message: "The enquiry could not be deleted. Try again.",
      httpStatus: 500,
    });
  }

  return {
    leadId: row.lead_id,
    deletionReference: row.deletion_reference,
    deletedAt: row.deleted_at,
  };
}

/**
 * Deletion for a caller whose access context is already resolved.
 *
 * `canDeleteLeads` is asserted here so a bearer caller gets a sentence and a
 * 403 rather than a Postgres error surfacing as an opaque failure — exactly the
 * courtesy `deleteLeadAction` performs for the browser. It is not the lock.
 * `delete_lead_tombstone` re-checks the permission AND the `super_admin` role,
 * and refuses regardless of what any client believed.
 *
 * The client is injected for the same reason every other CRM mobile call
 * injects one: a bearer request has no cookie to fall back to.
 */
export async function deleteLeadForContext(
  context: CrmAccessContext,
  input: LeadDeleteInput,
  db?: CrmDb
): Promise<LeadDeleteResult> {
  if (!context.canDeleteLeads) {
    /*
     * Not `admin.access`, not `leads.manage`, not `leads.transition`. Only the
     * owner-held `leads.delete` reaches this flag.
     */
    throw new CrmError({
      code: "LEAD_DELETE_PERMISSION_DENIED",
      message: "You are not allowed to delete enquiries.",
      httpStatus: 403,
    });
  }

  return callDeleteLeadTombstone(await resolveCrmDb(db), input);
}

/** The browser entry point, unchanged in behaviour. */
export async function deleteLeadForCurrentUser(
  input: LeadDeleteInput
): Promise<LeadDeleteResult> {
  return callDeleteLeadTombstone(await resolveCrmDb(), input);
}
