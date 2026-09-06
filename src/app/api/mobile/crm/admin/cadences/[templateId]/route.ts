import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { isCrmMobileAdminId } from "@/features/crm/server/crm-mobile-admin.ts";
import { fetchCadenceTemplateDetail } from "@/features/crm/server/crm-cadence-queries.ts";

/**
 * Owner mobile — one cadence template, with its ordered steps.
 *
 * The steps are read `ORDER BY step_order` by the canonical query and returned
 * in that order. That ordering is the cadence: it is what `replace_steps`
 * writes back from array position, so a client that re-sorted this list would
 * be editing a different playbook than the one it displayed.
 *
 * Read-only.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  if (!auth.context.canManageCadences) {
    return crmMobileError(
      "forbidden",
      "You are not allowed to manage cadences."
    );
  }

  const { templateId } = await params;

  /*
   * The id is checked for SHAPE before any query runs. Postgres answers a
   * malformed uuid with `22P02`, which would surface as an opaque 503 and
   * report a client mistake as a server fault; more to the point, a probe with
   * a junk id never reaches a query at all.
   */
  if (!isCrmMobileAdminId(templateId)) {
    return crmMobileError("invalid_request", "Unknown cadence template.");
  }

  try {
    const detail = await fetchCadenceTemplateDetail(templateId.trim(), auth.db);

    /*
     * A template hidden by RLS and a template that does not exist MUST answer
     * identically. Distinguishing them would let a caller enumerate templates
     * they cannot see.
     */
    if (!detail) {
      return crmMobileError("not_found", "Cadence template not found.");
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[mobile/crm/admin/cadences/detail]", error);

    return crmMobileError(
      "unavailable",
      "This cadence is unavailable right now. Try again."
    );
  }
}
