import { NextResponse } from "next/server";
import { toMobileLeadDetail } from "@/features/crm/contracts/mobile-lead-detail-dtos.ts";
import {
  crmMobileAuthError,
  crmMobileError,
  isCrmLeadIdShape,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { queryLeadDetail } from "@/features/crm/server/crm-lead-repository.ts";

/**
 * Canonical Lead Detail for the ONEDECORE Owner mobile app.
 *
 * WHY THIS ROUTE EXISTS. The web lead page assembles one detail model — the
 * overview, the contact channels, the source and its touchpoints, the
 * assignment and its history, the notes, the follow-ups with their REAL
 * completion actors and outcomes, the consent summary, the SLA clock, the
 * on-hold / closed-lost state and the unified timeline. Every one of those is a
 * judgement about what the CRM knows, several of them are interpretations
 * assembled in server TypeScript, and the Owner app needs all of them.
 *
 * Rebuilding that assembly against PostgREST from Android would have meant
 * re-deriving the timeline's dedupe and ordering, the actor resolution and the
 * conversation-log occurrence rule on a phone — a second CRM engine that drifts
 * from this one the first time a rule changes. So the phone calls the SAME
 * function the web page calls.
 *
 * THE HANDLER IS THIN. It authenticates, checks the id shape, runs
 * `queryLeadDetail` with the caller's own client, and adds the ordered
 * conversation log the web computes at render time. It contains no CRM business
 * logic of its own and must not grow any.
 *
 * NO PRIVILEGE IS ADDED. `auth.db` is the caller's bearer-scoped client and
 * `auth.context` is the same access context the browser workspace resolves, so
 * a lead outside the caller's RLS scope yields no row — indistinguishable from
 * a lead that does not exist, which is why both answer the same 404.
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
    const detail = await queryLeadDetail(
      auth.context,
      leadId.trim(),
      auth.db
    );

    /*
     * NO EXISTENCE ORACLE. A hidden lead and a missing lead are the same
     * answer, with the same sentence, so this endpoint cannot be used to
     * discover which leads are real.
     */
    if (!detail) {
      return crmMobileError(
        "not_found",
        "That lead is not available."
      );
    }

    return NextResponse.json(toMobileLeadDetail(detail));
  } catch (error) {
    /*
     * Categories, never internals. A Postgres message can name columns,
     * policies and grants, and none of that belongs on a phone.
     */
    console.error("[mobile/crm/leads/:leadId/detail]", error);

    return crmMobileError(
      "unavailable",
      "This lead is unavailable right now. Try again."
    );
  }
}
