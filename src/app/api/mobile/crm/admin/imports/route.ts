import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { crmMobileAdminFailure } from "@/features/crm/server/crm-mobile-admin.ts";
import { fetchLeadImportBatchListForContext } from "@/features/crm/server/crm-import-service.ts";

/**
 * Owner mobile — bulk lead import batches.
 *
 * The summary carries the counts the review decision is made on: valid,
 * invalid, duplicate-blocked and importable rows, plus the `validationRevision`
 * every lifecycle action must echo back. All of them are computed by the
 * canonical validation RPC and stored on the batch; none is derived here.
 *
 * Read-only.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  /*
   * `crm.leads.bulk_import` gates the list. The batch rows carry submitted lead
   * data, so the read is an import-operator read and not a general CRM one.
   */
  if (!auth.context.canBulkImportLeads) {
    return crmMobileError(
      "forbidden",
      "You are not allowed to import leads."
    );
  }

  try {
    return NextResponse.json(
      await fetchLeadImportBatchListForContext(auth.context, auth.db)
    );
  } catch (error) {
    return crmMobileAdminFailure(error, "imports");
  }
}
