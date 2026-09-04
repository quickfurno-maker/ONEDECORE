import { NextResponse } from "next/server";
import { parseLeadListQuery } from "@/features/crm/contracts/lead-list-query.ts";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { queryLeadListPage } from "@/features/crm/server/crm-lead-queries.ts";

/**
 * Canonical Smart Leads read for the ONEDECORE Owner mobile app.
 *
 * This endpoint exists for exactly one reason: the lead score, the effective
 * sales bucket and the sales-priority ranking are derived in server TypeScript
 * (`deriveLeadScore`, `resolveEffectiveSalesBucket`, `sortSegmentedLeads`), not
 * in SQL. Reimplementing any of that in Android would create a second
 * intelligence engine that drifts from this one the first time a weight moves.
 *
 * So the handler is deliberately thin. It parses the query with the SAME parser
 * the web workspace uses, runs the SAME read model, and returns the result. It
 * contains no CRM business logic of its own and must not grow any.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());

  try {
    /* Same parser as the web route: one place decides what a valid query is. */
    const query = parseLeadListQuery(searchParams);

    const page = await queryLeadListPage(auth.context, query, auth.db);

    return NextResponse.json(page);
  } catch (error) {
    /*
     * Categories, never internals. A Postgres message can name columns,
     * policies and grants, and none of that belongs on a phone.
     */
    console.error("[mobile/crm/leads]", error);

    return crmMobileError(
      "unavailable",
      "CRM leads are unavailable right now. Try again."
    );
  }
}
