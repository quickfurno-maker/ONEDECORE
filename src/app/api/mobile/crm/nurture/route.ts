import { NextResponse } from "next/server";
import { parseLeadListQuery } from "@/features/crm/contracts/lead-list-query.ts";
import { crmMobileAuthError, crmMobileError, resolveCrmMobileAuth } from "@/features/crm/server/crm-mobile-auth.ts";
import { queryLeadListPage } from "@/features/crm/server/crm-lead-queries.ts";
import { fetchCrmNurtureV2Signals, countCrmNurtureStages } from "@/features/crm/server/crm-nurture-v2.ts";

/**
 * Read-only long-horizon nurture workspace. This never schedules a message.
 * The server fixes month/timeline and excludes terminal leads. Caller RLS
 * applies to BOTH the lead list and the downstream nurture-signal read.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await resolveCrmMobileAuth(request);
  if (auth.kind !== "granted") return crmMobileAuthError(auth.kind);
  const params = new URL(request.url).searchParams;
  try {
    const parsed = parseLeadListQuery({
      q: params.get("q") ?? undefined,
      page: params.get("page") ?? undefined,
      pageSize: params.get("pageSize") ?? undefined,
      month: "all",
      timeline: "after-2-months",
    });
    const page = await queryLeadListPage(
      auth.context,
      { ...parsed, excludeTerminal: true },
      auth.db
    );
    const signals = await fetchCrmNurtureV2Signals(page.items.map((lead) => lead.id), auth.db);
    return NextResponse.json({
      items: page.items.map((lead) => ({ lead, nurture: signals[lead.id] ?? null })),
      pagination: page.pagination,
      filteredTotal: page.filteredTotal,
      countsExact: page.countsExact,
      cohortTruncated: page.cohortTruncated,
      capturedAt: page.capturedAt,
      visibleStageCounts: countCrmNurtureStages(signals),
      countScope: "current_page",
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("[mobile/crm/nurture]", error);
    return crmMobileError("unavailable", "Nurture leads are unavailable right now.");
  }
}
