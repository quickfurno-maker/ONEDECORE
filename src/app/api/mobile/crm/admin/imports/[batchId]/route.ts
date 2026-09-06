import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import {
  crmMobileAdminFailure,
  isCrmMobileAdminId,
} from "@/features/crm/server/crm-mobile-admin.ts";
import { fetchLeadImportBatchWithRowsForContext } from "@/features/crm/server/crm-import-service.ts";

/**
 * Owner mobile — one import batch and its rows.
 *
 * The row detail is the review surface: per-row validation status, the
 * duplicate outcome, the canonical validation errors, and the assignment the
 * rules resolved. All of it is written by the validation RPC. This route
 * re-derives nothing — not a duplicate verdict, not an assignee, not a row's
 * validity.
 *
 * The batch's stored `fileSha256`, `fileSizeBytes` and `headerFingerprint` are
 * returned; the FILE ITSELF is not. Nothing in this slice stores or serves the
 * uploaded bytes.
 *
 * Read-only.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  if (!auth.context.canBulkImportLeads) {
    return crmMobileError("forbidden", "You are not allowed to import leads.");
  }

  const { batchId } = await params;

  if (!isCrmMobileAdminId(batchId)) {
    return crmMobileError("invalid_request", "Unknown import batch.");
  }

  try {
    /*
     * The canonical reader answers a missing batch with a 404-shaped CrmError,
     * which the shared mapper turns into `not_found`. An RLS-hidden batch and a
     * non-existent one are indistinguishable, as they must be.
     */
    return NextResponse.json(
      await fetchLeadImportBatchWithRowsForContext(
        auth.context,
        batchId.trim(),
        auth.db
      )
    );
  } catch (error) {
    return crmMobileAdminFailure(error, "imports/detail");
  }
}
