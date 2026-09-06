import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { fetchCadenceTemplates } from "@/features/crm/server/crm-cadence-queries.ts";

/**
 * Owner mobile — cadence template catalogue.
 *
 * The audit asked whether Android could read `crm_cadence_templates` directly
 * and the answer was no, for a reason that is not about the template rows: the
 * summary each row carries is a JOIN this endpoint performs. `stepCount` counts
 * `crm_cadence_steps` and `activeEnrollmentCount` counts the `active` and
 * `paused` enrollments, and those two numbers are what tell an owner whether a
 * template is safe to archive. A client that fetched only the template table
 * would show every cadence as empty and unused.
 *
 * So the canonical query answers, verbatim. This route decides nothing about
 * cadences and must not grow a rule.
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
   * `crm.cadences.manage` gates the READ as well as the writes. The cadence
   * catalogue is an administration surface, and RLS alone would show its rows
   * to any CRM reader — the gate is what makes this list an admin list.
   */
  if (!auth.context.canManageCadences) {
    return crmMobileError(
      "forbidden",
      "You are not allowed to manage cadences."
    );
  }

  try {
    return NextResponse.json(await fetchCadenceTemplates(auth.db));
  } catch (error) {
    /* Categories, never internals: a Postgres message names columns and grants. */
    console.error("[mobile/crm/admin/cadences]", error);

    return crmMobileError(
      "unavailable",
      "Cadences are unavailable right now. Try again."
    );
  }
}
