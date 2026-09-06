import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { fetchSalesTargetsForContext } from "@/features/crm/server/crm-sales-target-service.ts";

/**
 * Owner mobile — sales target configuration.
 *
 * Targets have a READ permission and a separate MANAGE permission, and the two
 * are genuinely different populations: a sales lead may need to see the month's
 * numbers without being able to revise or lock them. So the list answers on
 * `crm.sales_targets.read` and reports `canManage` alongside it, which lets the
 * client hide actions it would be refused rather than offer them and fail.
 *
 * `canManage` is a HINT, never a gate. The write endpoint asserts the manage
 * permission itself, inside the canonical service, and would refuse a caller
 * who ignored this flag exactly as it refuses one who never read it.
 *
 * NO ATTAINMENT IS COMPUTED HERE. Targets are configuration; achievement stays
 * Phase 7B gated, and a "progress" number invented at this boundary would be a
 * commercial figure with no source.
 *
 * Read-only.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  try {
    const targets = await fetchSalesTargetsForContext(auth.context, auth.db);

    return NextResponse.json({
      targets,
      canManage: auth.context.canManageSalesTargets,
    });
  } catch (error) {
    console.error("[mobile/crm/admin/targets]", error);

    return crmMobileError(
      "unavailable",
      "Sales targets are unavailable right now. Try again."
    );
  }
}
