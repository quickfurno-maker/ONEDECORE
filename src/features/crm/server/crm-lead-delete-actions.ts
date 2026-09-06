"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  leadDeleteFieldErrorsToRecord,
  validateLeadDeleteInput,
  type LeadDeleteActionState,
} from "../contracts/lead-delete-contracts.ts";
import { deleteLeadForCurrentUser } from "./crm-lead-delete-service.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";
import { getCrmAccessContext } from "./crm-auth.ts";

/**
 * Delete an enquiry.
 *
 * A DEDICATED PATH, NOT A LIFECYCLE TRANSITION
 *
 * This deliberately does not live in `crm-lifecycle-actions.ts`. Closed Lost
 * and Delete are different authorities with different consequences, and putting
 * them in one file is how a shared helper eventually lets one become the other.
 *
 * `canDeleteLeads` is checked here so the owner gets a sentence instead of a
 * Postgres error, and the database checks the permission AND the `super_admin`
 * role again regardless. The server action is a courtesy; the RPC is the lock.
 */

/** Every surface a deleted enquiry has to vanish from. */
const OPERATIONAL_PATHS = [
  "/admin/crm",
  "/admin/crm/leads",
  "/admin/crm/my-day",
  "/admin/crm/calendar",
  "/admin/crm/reports",
  "/admin",
] as const;

function failure(
  message: string,
  code?: string,
  fieldErrors?: LeadDeleteActionState["fieldErrors"]
): LeadDeleteActionState {
  return { success: false, message, code, fieldErrors };
}

export async function deleteLeadAction(
  _previous: LeadDeleteActionState,
  formData: FormData
): Promise<LeadDeleteActionState> {
  const input = {
    leadId: String(formData.get("leadId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    expectedUpdatedAt: String(formData.get("expectedUpdatedAt") ?? ""),
    confirmation: String(formData.get("confirmation") ?? ""),
  };

  const fieldErrors = validateLeadDeleteInput(input);
  if (fieldErrors.length > 0) {
    return failure(
      "Check the highlighted fields.",
      "VALIDATION_FAILED",
      leadDeleteFieldErrorsToRecord(fieldErrors)
    );
  }

  if (!input.expectedUpdatedAt) {
    // Without it the delete could not be stale-checked, and a delete that
    // cannot be stale-checked is one applied to a lead nobody has read.
    return failure("Reload the enquiry and try again.", "VALIDATION_FAILED");
  }

  const context = await getCrmAccessContext();
  if (!context) {
    return failure("Sign in to continue.", "AUTH_REQUIRED");
  }

  if (!context.canDeleteLeads) {
    /*
     * Not `admin.access`, not `leads.manage`, not `leads.transition`. Only the
     * owner-held `leads.delete` reaches this flag.
     */
    return failure(
      "You are not allowed to delete enquiries.",
      "PERMISSION_DENIED"
    );
  }

  try {
    await deleteLeadForCurrentUser(input);
  } catch (error) {
    if (error instanceof CrmError) {
      return failure(error.message, error.code);
    }
    const mapped = crmErrorFromPostgresMessage(
      error instanceof Error ? error.message : "The enquiry could not be deleted."
    );
    return failure(mapped.message, mapped.code);
  }

  for (const path of OPERATIONAL_PATHS) {
    revalidatePath(path);
  }
  revalidatePath(`/admin/crm/leads/${input.leadId}`);

  // The enquiry the owner was looking at no longer exists operationally, so
  // there is nowhere on this page to return to.
  redirect("/admin/crm/leads");
}
