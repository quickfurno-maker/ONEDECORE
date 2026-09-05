import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { isUuid } from "@/features/crm/contracts/assignment-contracts.ts";
import {
  REPORT_DATE_PRESETS,
  type ReportDatePreset,
  type ReportFilters,
} from "@/features/crm/contracts/reporting-contracts.ts";
import { resolveReportDateRange } from "@/features/crm/contracts/reporting-date-range.ts";
import {
  fetchCrmManagementAnalyticsSnapshot,
  resolveAnalyticsScopeOwnerId,
} from "@/features/crm/server/crm-management-analytics-queries.ts";
import { fetchCrmPipelineValueSummaryStrict } from "@/features/crm/server/crm-lead-commercial-queries.ts";
import { fetchCrmReportingSnapshotForContext } from "@/features/crm/server/crm-reporting-queries.ts";

/**
 * Owner mobile CRM Insights.
 *
 * The mobile phase audited whether Android could read the analytics sources
 * directly and concluded it could not, for two separate reasons — and this
 * route exists to hold both of them on the server:
 *
 *   the window   `get_crm_management_analytics` takes explicit
 *                `p_start`/`p_end`/`p_target_month`, and producing those means
 *                reimplementing `resolveReportDateRange` — IST month ends, the
 *                last-month year rollover, the 30-day back-count and the
 *                366-day custom cap. An off-by-one there changes which leads
 *                are in the cohort, so SLA compliance, funnel conversion and
 *                velocity medians all move without looking wrong.
 *   the engine   trends, source mix, workload, follow-up performance, lost
 *                reasons and the aging bands have no RPC at all. They are
 *                aggregated in server TypeScript over a cohort read, and
 *                `crm.reporting.read` is enforced only in TypeScript, so a
 *                direct client read would both rebuild the analytics engine
 *                and skip the permission.
 *
 * So the client names a semantic PERIOD and this route answers with the
 * canonical models, verbatim. It computes no rate, no median, no funnel step,
 * no ranking, no bucket and no boundary.
 *
 * THREE SOURCES, REPORTED SEPARATELY. Management analytics, the forecast and
 * the reporting snapshot fail independently, and one failing must never blank
 * or falsify another — an owner reading "₹0 forecast" when the forecast simply
 * did not load is worse than reading nothing. Each is enveloped with its own
 * `kind`, and a failure is never serialised as an empty success.
 *
 * Read-only.
 */

export const dynamic = "force-dynamic";

type SourceResult<T> =
  | { readonly kind: "ok"; readonly data: T }
  | { readonly kind: "unavailable" };

function settled<T>(
  result: PromiseSettledResult<T>,
  label: string
): SourceResult<T> {
  if (result.status === "fulfilled") {
    return { kind: "ok", data: result.value };
  }

  /*
   * Categories, never internals: a Postgres message can name columns, policies
   * and grants, and none of that belongs on a phone.
   */
  console.error(`[mobile/crm/insights] ${label}`, result.reason);

  return { kind: "unavailable" };
}

export async function GET(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  /*
   * Reporting access is checked HERE, before any source runs, as well as inside
   * each query. Without this gate the per-source envelopes below would turn a
   * refusal into three "unavailable" results — a 200 that reads as an outage
   * rather than as a permission answer, and one that would still have exposed
   * the forecast, which has no reporting gate of its own.
   */
  if (!auth.context.canReadCrmReporting) {
    return crmMobileError(
      "forbidden",
      "You do not have access to CRM reporting."
    );
  }

  const url = new URL(request.url);
  const rawPreset = url.searchParams.get("preset");
  const rawStart = url.searchParams.get("start");
  const rawEnd = url.searchParams.get("end");
  const rawOwner = url.searchParams.get("owner");
  const rawSource = url.searchParams.get("source");

  /*
   * An ABSENT preset takes the canonical default. A PRESENT one the canonical
   * vocabulary does not admit is refused rather than silently replaced: a
   * client that asked for last month and was handed this month would label the
   * wrong period with the right numbers.
   */
  if (
    rawPreset !== null &&
    !(REPORT_DATE_PRESETS as readonly string[]).includes(rawPreset)
  ) {
    return crmMobileError(
      "invalid_request",
      "Unknown period. Use this_month, last_month, last_30_days or custom."
    );
  }

  const preset = (rawPreset ?? "this_month") as ReportDatePreset;

  /*
   * The range — every IST boundary, the year rollover and the 366-day cap —
   * is resolved by the canonical helper. This route states no date rule and
   * never sees a UTC bound until the helper produces one.
   */
  const resolved = resolveReportDateRange({
    preset,
    customStart: rawStart,
    customEnd: rawEnd,
  });

  if (!resolved.range) {
    return crmMobileError(
      "invalid_request",
      resolved.error ?? "Invalid reporting period."
    );
  }

  /*
   * A malformed owner or source is refused rather than dropped. Dropping an
   * owner would silently WIDEN the request to the whole team; dropping a source
   * would widen it to every source. Refusing is the direction that can never
   * return more than was asked for.
   */
  const ownerRaw = (rawOwner ?? "").trim();
  const requestedOwnerId =
    ownerRaw === "" || ownerRaw === "team" ? null : ownerRaw;

  if (requestedOwnerId !== null && !isUuid(requestedOwnerId)) {
    return crmMobileError("invalid_request", "Unknown owner filter.");
  }

  const sourceRaw = (rawSource ?? "").trim();
  const sourceId = sourceRaw === "" ? null : sourceRaw;

  if (sourceId !== null && !isUuid(sourceId)) {
    return crmMobileError("invalid_request", "Unknown source filter.");
  }

  /*
   * ONE owner scope, resolved once by the canonical resolver and used by all
   * three sources. This matters: the reporting snapshot's own filter applies a
   * requested `assigneeId` verbatim and only pins a non-broad caller when none
   * was given, so passing the raw request through would let a non-broad caller
   * scope the snapshot to a colleague. Pinning here first removes that path,
   * and the analytics RPC refuses a foreign owner independently.
   */
  const scopeOwnerId = resolveAnalyticsScopeOwnerId(
    auth.context,
    requestedOwnerId
  );

  const filters: ReportFilters = {
    dateRange: resolved.range,
    sourceId,
    status: null,
    assigneeId: scopeOwnerId,
  };

  const [managementSettled, forecastSettled, reportingSettled] =
    await Promise.allSettled([
      fetchCrmManagementAnalyticsSnapshot(auth.context, filters, auth.db),
      /*
       * The STRICT forecast reader. The tolerant one answers
       * EMPTY_PIPELINE_VALUE_SUMMARY on failure, which serialises as a
       * complete, all-zero forecast — indistinguishable from a genuinely empty
       * pipeline. On a surface reporting money, those are different facts.
       */
      fetchCrmPipelineValueSummaryStrict(scopeOwnerId, auth.db),
      fetchCrmReportingSnapshotForContext(auth.context, filters, auth.db),
    ]);

  const management = settled(managementSettled, "management");
  const forecast = settled(forecastSettled, "forecast");
  const reporting = settled(reportingSettled, "reporting");

  /* Nothing loaded at all is an outage, not a page of empty sections. */
  if (
    management.kind === "unavailable" &&
    forecast.kind === "unavailable" &&
    reporting.kind === "unavailable"
  ) {
    return crmMobileError(
      "unavailable",
      "Insights are unavailable right now. Try again."
    );
  }

  return NextResponse.json({
    range: resolved.range,
    scopeOwnerId,
    isTeamScope: scopeOwnerId === null,
    sourceId,
    /*
     * The target period belongs to the analytics source. When that source is
     * unavailable the period is unknown, and saying so is better than deriving
     * one here from the range — which would be this route owning a rule.
     */
    targetPeriod:
      management.kind === "ok"
        ? management.data.targetPeriod
        : null,
    management:
      management.kind === "ok"
        ? { kind: "ok" as const, data: management.data.analytics }
        : management,
    forecast,
    reporting,
  });
}
