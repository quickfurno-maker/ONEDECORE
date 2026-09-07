import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  isCrmLeadIdShape,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import {
  CRM_MOBILE_INVALID_JSON_BODY,
  crmMobileDeleteFailure,
  readCrmMobileJsonObject,
  readStringField,
} from "@/features/crm/server/crm-mobile-admin.ts";
import {
  leadDeleteFieldErrorsToRecord,
  validateLeadDeleteInput,
} from "@/features/crm/contracts/lead-delete-contracts.ts";
import { deleteLeadForContext } from "@/features/crm/server/crm-lead-delete-service.ts";

/**
 * Delete one enquiry, from the Owner app.
 *
 * DELETE IS NOT CLOSED LOST. Closed Lost is the sales team's ordinary lifecycle
 * transition and the enquiry stays in CRM history where reporting still sees
 * it. This removes the enquiry from every operational surface, and it is the
 * owner's alone. They share no permission and no code path, and this route
 * exists beside the lifecycle routes rather than inside them so they never
 * start to.
 *
 * IT IS A TOMBSTONE, NOT AN ERASURE. `delete_lead_tombstone` preserves the
 * audit trail, the contact, the consent record and the communication evidence.
 * Nothing here should ever describe it to a user as permanent removal of data,
 * and this route deliberately offers no restore and no hard delete — the
 * canonical capability has neither.
 *
 * WHAT THIS ROUTE DECIDES: that the caller is authenticated, that the path id
 * is shaped like a lead, that the four canonical fields are present and pass
 * the shared validator, and that the caller holds `leads.delete`. That is all.
 *
 * WHAT IT DOES NOT DECIDE, and must never learn to: whether the enquiry is
 * closed_won, whether a quotation, an acceptance or a project exists, whether
 * the `updated_at` the owner read is still current, or whether the caller holds
 * the `super_admin` role. Every one of those is evaluated inside
 * `delete_lead_tombstone`, in the same transaction as the write, under a lock.
 * A copy of any of them here would be a second opinion that could be wrong at
 * exactly the moment it mattered.
 *
 * NO SERVICE ROLE, NO TABLE WRITE. The caller's own bearer-scoped client makes
 * the call, so RLS and `authorize(...)` resolve against the real user.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  const { leadId } = await params;

  /* The SHARED shape guard, so a junk id never reaches the RPC. */
  if (!isCrmLeadIdShape(leadId)) {
    return crmMobileError(
      "invalid_request",
      "That lead reference is not valid."
    );
  }

  const body = await readCrmMobileJsonObject(request);

  if (!body) {
    return crmMobileError("invalid_request", CRM_MOBILE_INVALID_JSON_BODY);
  }

  /*
   * The id comes from the PATH, never from the body. Accepting a body id would
   * let a request delete one enquiry while addressing another, and the two
   * would disagree in the audit trail.
   */
  const input = {
    leadId,
    reason: readStringField(body, "reason") ?? "",
    expectedUpdatedAt: readStringField(body, "expectedUpdatedAt") ?? "",
    confirmation: readStringField(body, "confirmation") ?? "",
  };

  /* The canonical validator — the same one the browser form runs. */
  const fieldErrors = validateLeadDeleteInput(input);

  if (fieldErrors.length > 0) {
    const record = leadDeleteFieldErrorsToRecord(fieldErrors);

    return NextResponse.json(
      {
        error: "invalid_request",
        message: "Check the highlighted fields.",
        code: "VALIDATION_FAILED",
        fieldErrors: record,
      },
      { status: 400 }
    );
  }

  /*
   * `validateLeadDeleteInput` does not check this, and the omission is easy to
   * miss: without `expectedUpdatedAt` the RPC cannot stale-check, and a delete
   * that cannot be stale-checked is one applied to a lead nobody has actually
   * read. The browser action guards it separately for the same reason.
   */
  if (!input.expectedUpdatedAt) {
    return crmMobileError(
      "invalid_request",
      "Reload the enquiry and try again.",
      "VALIDATION_FAILED"
    );
  }

  try {
    const result = await deleteLeadForContext(
      auth.context,
      input,
      auth.db
    );

    /*
     * The deletion reference is the audit handle the canonical RPC minted. It
     * is returned so the owner can be told the record survives as history, and
     * so a support question about "the enquiry that vanished" has an answer.
     */
    return NextResponse.json({
      leadId: result.leadId,
      deletionReference: result.deletionReference,
      deletedAt: result.deletedAt,
    });
  } catch (error) {
    return crmMobileDeleteFailure(error, "leads/delete");
  }
}
