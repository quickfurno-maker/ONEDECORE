import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import {
  CRM_MOBILE_INVALID_JSON_BODY,
  crmMobileAdminFailure,
  isCrmMobileAdminId,
  readCrmMobileJsonObject,
  readIntegerField,
  readStringField,
} from "@/features/crm/server/crm-mobile-admin.ts";
import {
  approveLeadImportBatchForContext,
  cancelLeadImportBatchForContext,
  confirmLeadImportBatchDirectForContext,
  processLeadImportBatchForContext,
  rejectLeadImportBatchForContext,
  submitLeadImportBatchForContext,
} from "@/features/crm/server/crm-import-service.ts";

/**
 * Owner mobile — import batch lifecycle.
 *
 * THE APPROVAL SPLIT IS PRESERVED. `submit`, `confirm_direct`, `cancel` and
 * `process` run on `crm.leads.bulk_import`; `approve` and `reject` run on
 * `crm.leads.import.approve`. That separation is the review step: whoever
 * prepared a batch must not be able to wave it through. The two permissions are
 * asserted inside the canonical service, and the route gate below admits only
 * the caller who holds the one this action needs — it never widens the split.
 *
 * `expectedRevision` IS REQUIRED AND FORWARDED EXACTLY. It is the batch's
 * `validationRevision` at the moment the caller looked at it, and the RPC
 * compares it before acting. A mismatch raises `crm_import_stale_revision`,
 * which the canonical mapper answers as 409. Without it, approving a batch
 * whose rows had been re-validated underneath would import a different set of
 * leads than the approver reviewed.
 *
 * `cancel` alone takes no revision, matching the canonical
 * `cancel_lead_import_batch` signature.
 *
 * THE PROCESS CHUNK IS THE SERVER'S. `p_max_rows` is never read from the
 * request. The canonical service defaults it to
 * `LEAD_IMPORT_LIMITS.maxProcessChunk`, and it stays a server-side throughput
 * bound: a caller-chosen value would let one request decide how much work a
 * single transaction does.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  const { batchId } = await params;

  if (!isCrmMobileAdminId(batchId)) {
    return crmMobileError("invalid_request", "Unknown import batch.");
  }

  const target = batchId.trim();

  const body = await readCrmMobileJsonObject(request);

  if (!body) {
    return crmMobileError("invalid_request", CRM_MOBILE_INVALID_JSON_BODY);
  }

  const action = readStringField(body, "action");

  /*
   * The route gate mirrors the service's split rather than replacing it: an
   * approval action needs the approval permission, everything else needs the
   * import permission, and the service asserts the same thing again.
   */
  const needsApproval = action === "approve" || action === "reject";

  if (needsApproval && !auth.context.canApproveLeadImports) {
    return crmMobileError(
      "forbidden",
      "You are not allowed to approve import batches."
    );
  }

  if (!needsApproval && !auth.context.canBulkImportLeads) {
    return crmMobileError("forbidden", "You are not allowed to import leads.");
  }

  const expectedRevision = readIntegerField(body, "expectedRevision");

  /* Every action but `cancel` carries a revision, and it must actually be one. */
  if (action !== "cancel" && action !== null && expectedRevision === null) {
    return crmMobileError(
      "invalid_request",
      "expectedRevision is required."
    );
  }

  try {
    switch (action) {
      case "submit":
        return NextResponse.json(
          await submitLeadImportBatchForContext(
            auth.context,
            target,
            expectedRevision as number,
            auth.db
          )
        );

      case "approve":
        return NextResponse.json(
          await approveLeadImportBatchForContext(
            auth.context,
            target,
            expectedRevision as number,
            auth.db
          )
        );

      case "reject": {
        const rejectionReason = readStringField(body, "rejectionReason");

        /*
         * Passed to the canonical service, which runs
         * `validateLeadImportRejectionReason` and owns the length bounds. The
         * only thing insisted on here is that a string arrived — the validator
         * calls `.trim()` on it.
         */
        if (rejectionReason === null) {
          return crmMobileError(
            "invalid_request",
            "A rejection reason is required."
          );
        }

        return NextResponse.json(
          await rejectLeadImportBatchForContext(
            auth.context,
            target,
            expectedRevision as number,
            rejectionReason,
            auth.db
          )
        );
      }

      case "confirm_direct":
        return NextResponse.json(
          await confirmLeadImportBatchDirectForContext(
            auth.context,
            target,
            expectedRevision as number,
            auth.db
          )
        );

      case "cancel":
        return NextResponse.json(
          await cancelLeadImportBatchForContext(auth.context, target, auth.db)
        );

      case "process":
        /* No chunk argument. The service's canonical default is the only one. */
        return NextResponse.json(
          await processLeadImportBatchForContext(
            auth.context,
            target,
            expectedRevision as number,
            auth.db
          )
        );

      default:
        return crmMobileError(
          "invalid_request",
          "Unknown import action. Use submit, approve, reject, confirm_direct, cancel or process."
        );
    }
  } catch (error) {
    return crmMobileAdminFailure(error, "imports/actions");
  }
}
