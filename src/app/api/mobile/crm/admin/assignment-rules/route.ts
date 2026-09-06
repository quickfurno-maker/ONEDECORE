import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { fetchLeadAssignmentRulesForContext } from "@/features/crm/server/crm-assignment-rule-service.ts";

/**
 * Owner mobile — lead assignment rules.
 *
 * The canonical read orders by `priority ASC, id ASC` and this route returns
 * that order untouched. It is not a display preference: it is the order the
 * import validator resolves matches in, so a list re-sorted on a phone would be
 * showing a precedence the server does not apply.
 *
 * NO MATCH-PRECEDENCE ENGINE LIVES HERE. Which rule wins for a given lead —
 * how source, service, locality and budget combine, and what happens when a
 * target is ineligible — is decided during import validation in the database.
 * This endpoint lists configuration; it never evaluates it.
 *
 * Read-only.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  if (!auth.context.canManageLeadAssignmentRules) {
    return crmMobileError(
      "forbidden",
      "You are not allowed to manage lead assignment rules."
    );
  }

  try {
    return NextResponse.json(
      await fetchLeadAssignmentRulesForContext(auth.context, auth.db)
    );
  } catch (error) {
    console.error("[mobile/crm/admin/assignment-rules]", error);

    return crmMobileError(
      "unavailable",
      "Assignment rules are unavailable right now. Try again."
    );
  }
}
