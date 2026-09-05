import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  isCrmLeadIdShape,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { queryLeadIntelligence } from "@/features/crm/server/crm-lead-queries.ts";

/**
 * Canonical per-lead intelligence for the ONEDECORE Owner mobile app.
 *
 * WHY THIS ROUTE EXISTS. The Owner app's Lead Command Center opens from Today,
 * from Smart Leads, from the classic list, from the dashboard and from cold
 * deep links. The facts it needs most — the effective sales bucket and its
 * provenance, the system score and band, the risk flags, the site-visit
 * milestone — are derived in server TypeScript over batched signals, so they
 * are not columns and PostgREST cannot return them. The two existing mobile
 * endpoints that DO carry them are list surfaces with no lead-id filter, which
 * left a directly-opened lead with no way to obtain them at all.
 *
 * The app's honest response to that was to show nothing rather than estimate.
 * This route closes the gap so it can show the truth instead.
 *
 * It is deliberately thin, and deliberately NARROW. It reads ONE lead by
 * primary key and runs the SAME enrichment `queryLeadListPage` maps its cohort
 * through — `enrichLeadRow`, and through it `deriveLeadScore` and
 * `resolveEffectiveSalesBucket`. It contains no CRM business logic of its own
 * and must not grow any. A lead cannot score one way in the list and another
 * way when opened, because one function answers both.
 *
 * It is not a general lead-detail endpoint. Identity, contact, activities,
 * notes and history are already readable from the phone under RLS; only the
 * derived intelligence was unreachable, and only that is returned here.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  const { leadId } = await params;

  /* The SHARED shape guard, so a junk id never reaches a query. */
  if (!isCrmLeadIdShape(leadId)) {
    return crmMobileError(
      "invalid_request",
      "That lead reference is not valid."
    );
  }

  try {
    const lead = await queryLeadIntelligence(
      auth.context,
      leadId.trim(),
      auth.db
    );

    /*
     * NO EXISTENCE ORACLE. `auth.db` is the caller's own client, so a lead
     * outside their RLS scope yields no row — exactly as a lead that does not
     * exist does. Both answer 404 with the same sentence, so this endpoint
     * cannot be used to discover which leads are real.
     */
    if (!lead) {
      return crmMobileError(
        "not_found",
        "That lead is not available."
      );
    }

    return NextResponse.json(lead);
  } catch (error) {
    /*
     * Categories, never internals. A Postgres message can name columns,
     * policies and grants, and none of that belongs on a phone.
     */
    console.error("[mobile/crm/leads/:leadId]", error);

    return crmMobileError(
      "unavailable",
      "This lead is unavailable right now. Try again."
    );
  }
}
