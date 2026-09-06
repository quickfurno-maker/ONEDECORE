import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { isCrmMobileAdminId } from "@/features/crm/server/crm-mobile-admin.ts";
import { fetchSalesTargetEventsForContext } from "@/features/crm/server/crm-sales-target-service.ts";

/**
 * Owner mobile — one target's revision history.
 *
 * Every create, revise, lock and reopen writes a `sales_target_events` row with
 * the actor and the reason that was given. That trail is the reason revisions
 * demand a reason at all, and it answers on the READ permission: seeing why a
 * number moved is part of seeing the number.
 *
 * Read-only.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ targetId: string }> }
) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  if (!auth.context.canReadSalesTargets) {
    return crmMobileError(
      "forbidden",
      "You do not have access to sales targets."
    );
  }

  const { targetId } = await params;

  if (!isCrmMobileAdminId(targetId)) {
    return crmMobileError("invalid_request", "Unknown sales target.");
  }

  try {
    /*
     * An unknown id and an RLS-hidden target both answer with an empty list.
     * The canonical query filters by `target_id` and returns what the caller
     * may see, and turning "no rows" into a 404 here would tell a caller
     * whether a target they cannot read exists.
     */
    return NextResponse.json(
      await fetchSalesTargetEventsForContext(
        auth.context,
        targetId.trim(),
        auth.db
      )
    );
  } catch (error) {
    console.error("[mobile/crm/admin/targets/events]", error);

    return crmMobileError(
      "unavailable",
      "Target history is unavailable right now. Try again."
    );
  }
}
