import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { crmMobileAdminFailure } from "@/features/crm/server/crm-mobile-admin.ts";
import {
  MANUAL_LEAD_CATALOG_LABELS,
} from "@/features/crm/contracts/manual-lead-contracts.ts";
import {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
} from "@/features/lead-intake/planner-allowlist.ts";
import { fetchActiveLeadSources } from "@/features/crm/server/crm-lead-queries.ts";
import {
  fetchManualCreateAssigneeDirectoryForContext,
  resolveManualCreateAssigneePolicy,
} from "@/features/crm/server/crm-manual-lead-service.ts";

/**
 * Everything the Owner app needs to draw the New Lead form, in one read.
 *
 * The point of this endpoint is that the phone chooses NOTHING. Which services
 * exist, which sources are active, who may be assigned, whether this caller can
 * override a duplicate, and which source is preselected are all answered here —
 * so the app has no allowlist of its own to drift from, and no role name to
 * infer a permission from.
 *
 * WHAT IS DELIBERATELY NOT IN THE RESPONSE. The access context is consulted but
 * never serialised: no permission map, no role, no internal identifier beyond
 * the ids the form must actually submit. `canOverrideDuplicate` is the single
 * capability that reaches the client, and it is a HINT for what to show — the
 * create route asserts it again.
 */

export const dynamic = "force-dynamic";

/* Codes come from the canonical allowlist, labels from the canonical map. */
function catalog<T extends string>(
  codes: readonly T[],
  labels: Readonly<Record<T, string>>
): readonly { readonly code: T; readonly label: string }[] {
  return codes.map((code) => ({ code, label: labels[code] }));
}

export async function GET(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  if (!auth.context.canCreateLeads) {
    return crmMobileError(
      "forbidden",
      "You are not allowed to create leads."
    );
  }

  try {
    const [sources, assignees] = await Promise.all([
      fetchActiveLeadSources(auth.db),
      fetchManualCreateAssigneeDirectoryForContext(auth.context, auth.db),
    ]);

    /*
     * The same preference the browser form applies: `manual_entry` when it is
     * active, otherwise the first active source. Null only when the catalogue
     * is empty, which the app must show as "no source available" rather than
     * inventing one.
     */
    const manualEntry = sources.find((source) => source.code === "manual_entry");
    const defaultSourceId = manualEntry?.id ?? sources[0]?.id ?? null;

    return NextResponse.json({
      assigneePolicy: resolveManualCreateAssigneePolicy(auth.context),
      canOverrideDuplicate: auth.context.canOverrideLeadDuplicate,
      sources,
      assignees,
      defaultSourceId,
      catalogs: {
        services: catalog(
          LEAD_SERVICE_CODES,
          MANUAL_LEAD_CATALOG_LABELS.service
        ),
        properties: catalog(
          LEAD_PROPERTY_CODES,
          MANUAL_LEAD_CATALOG_LABELS.property
        ),
        timelines: catalog(
          LEAD_TIMELINE_CODES,
          MANUAL_LEAD_CATALOG_LABELS.timeline
        ),
        budgets: catalog(
          LEAD_BUDGET_COMFORT_CODES,
          MANUAL_LEAD_CATALOG_LABELS.budget
        ),
        rooms: catalog(LEAD_ROOM_CODES, MANUAL_LEAD_CATALOG_LABELS.room),
      },
    });
  } catch (error) {
    return crmMobileAdminFailure(error, "leads/manual/setup");
  }
}
