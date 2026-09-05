import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { fetchCrmDashboardSummary } from "@/features/crm/server/crm-dashboard-summary-queries.ts";

/**
 * The Owner mobile home screen's CRM summary.
 *
 * The dashboard opens on three lead counts and today's appointments. Every one
 * of those depends on a boundary the phone must not own: the Asia/Kolkata day,
 * a Monday-start week, a calendar month, and the instant that separates an
 * upcoming appointment from one that has already slipped.
 *
 * A phone computing those would need the IST offset, a week convention and a
 * half-open bound, and it would drift from the web workspace the first time any
 * of the three was written slightly differently — silently, because both
 * numbers would look plausible. So the server answers, and Android renders.
 *
 * It is deliberately thin and read-only. No CRM business logic lives here, and
 * it must not grow any.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  try {
    const summary = await fetchCrmDashboardSummary(auth.context, auth.db);

    return NextResponse.json(summary);
  } catch (error) {
    /*
     * Categories, never internals. A Postgres message can name columns,
     * policies and grants, and none of that belongs on a phone.
     */
    console.error("[mobile/crm/dashboard-summary]", error);

    return crmMobileError(
      "unavailable",
      "The dashboard summary is unavailable right now. Try again."
    );
  }
}
