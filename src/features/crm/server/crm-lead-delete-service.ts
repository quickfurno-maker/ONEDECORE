import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { LeadDeleteInput } from "../contracts/lead-delete-contracts.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

/**
 * Calls the one operation that can tombstone an enquiry.
 *
 * The authenticated staff client, never a service role. The RPC checks
 * `leads.delete` AND the `super_admin` role itself, so this module is a
 * transport: if it were the thing deciding, a second caller could decide
 * differently.
 */

export interface LeadDeleteResult {
  readonly leadId: string;
  readonly deletionReference: string;
  readonly deletedAt: string;
}

export async function deleteLeadForCurrentUser(
  input: LeadDeleteInput
): Promise<LeadDeleteResult> {
  const supabase = await createClient();

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
