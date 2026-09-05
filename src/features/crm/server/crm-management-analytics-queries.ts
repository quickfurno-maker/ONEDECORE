import "server-only";

import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import type { ReportFilters } from "../contracts/reporting-contracts.ts";
import {
  mapManagementAnalyticsPayload,
  resolveTargetPeriodFromRangeStart,
  type CrmManagementAnalyticsSnapshot,
} from "../contracts/management-analytics-contracts.ts";
import type { CrmPipelineValueSummary } from "../contracts/deal-value-contracts.ts";
import { fetchCrmPipelineValueSummary } from "./crm-lead-commercial-queries.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

export interface CrmManagementAnalyticsBundle {
  readonly analytics: CrmManagementAnalyticsSnapshot;
  /** CRM 2D weighted pipeline, reused verbatim as the CRM 2E forecast. */
  readonly forecast: CrmPipelineValueSummary;
  readonly scopeOwnerId: string | null;
  readonly isTeamScope: boolean;
  readonly targetPeriod: string;
}

function assertReportingPermission(context: CrmAccessContext): void {
  if (!context.canReadCrmReporting) {
    throw new CrmError({
      code: "CRM_REPORTING_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }
}

/**
 * Resolves the owner scope exactly like `fetchCrmMyDaySnapshot` and
 * `fetchCrmPipelineValueSummary`: a caller without broad lead read is pinned to
 * their own id, so a crafted `assignee` query parameter can never widen scope.
 * The RPC refuses a foreign owner independently, and RLS refuses it a third
 * time — the client-side pin is a convenience, never the boundary.
 */
export function resolveAnalyticsScopeOwnerId(
  context: CrmAccessContext,
  requestedOwnerId: string | null
): string | null {
  if (!context.canReadBroad) {
    return context.userId;
  }
  return requestedOwnerId;
}

/**
 * Management analytics for `/admin/crm/reports`.
 *
 * Two reads, both scoped by the caller's own RLS:
 *   1. `get_crm_management_analytics` — SLA, velocity, conversion, targets.
 *   2. `get_crm_pipeline_value_summary` — the CRM 2D weighted forecast,
 *      unchanged. CRM 2E deliberately does not re-derive stage probabilities.
 */
/**
 * `get_crm_management_analytics` alone — SLA, velocity, conversion and targets.
 *
 * Split out of the bundle below so the mobile read endpoint can run this source
 * INDEPENDENTLY of the forecast: one failing must not erase the other, and a
 * combined read cannot express that.
 *
 * Every number in the payload is the RPC's. The window comes from the canonical
 * report range and the target month from `resolveTargetPeriodFromRangeStart`;
 * nothing here computes a rate, a median, a funnel step or an attainment.
 */
export async function fetchCrmManagementAnalyticsSnapshot(
  context: CrmAccessContext,
  filters: ReportFilters,
  db?: CrmDb
): Promise<{
  readonly analytics: CrmManagementAnalyticsSnapshot;
  readonly scopeOwnerId: string | null;
  readonly targetPeriod: string;
}> {
  assertReportingPermission(context);

  const scopeOwnerId = resolveAnalyticsScopeOwnerId(context, filters.assigneeId);
  const { targetMonth, period } = resolveTargetPeriodFromRangeStart(
    filters.dateRange.startIso
  );

  const supabase = await resolveCrmDb(db);

  const analyticsResult = await supabase.rpc("get_crm_management_analytics", {
    p_start: filters.dateRange.startIso,
    p_end: filters.dateRange.endIso,
    p_target_month: targetMonth,
    p_owner_id: scopeOwnerId,
    p_source_id: filters.sourceId,
  });

  if (analyticsResult.error) {
    throw crmErrorFromPostgresMessage(analyticsResult.error.message, "RPC_FAILED");
  }

  const data = analyticsResult.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw crmErrorFromPostgresMessage("empty analytics payload", "RPC_FAILED");
  }

  const analytics = mapManagementAnalyticsPayload(data);

  return {
    analytics,
    scopeOwnerId,
    targetPeriod: analytics.targets.period || period,
  };
}

export async function fetchCrmManagementAnalytics(
  context: CrmAccessContext,
  filters: ReportFilters
): Promise<CrmManagementAnalyticsBundle> {
  /*
   * Asserted here as well as inside the analytics read, so a caller without
   * reporting permission is refused BEFORE the forecast RPC is issued — the
   * ordering this function has always had.
   */
  assertReportingPermission(context);

  const scopeOwnerId = resolveAnalyticsScopeOwnerId(context, filters.assigneeId);

  const [snapshot, forecast] = await Promise.all([
    fetchCrmManagementAnalyticsSnapshot(context, filters),
    fetchCrmPipelineValueSummary(scopeOwnerId),
  ]);

  return {
    analytics: snapshot.analytics,
    forecast,
    scopeOwnerId: snapshot.scopeOwnerId,
    isTeamScope: snapshot.scopeOwnerId === null,
    targetPeriod: snapshot.targetPeriod,
  };
}

export async function getCrmManagementAnalyticsForCurrentUser(
  filters: ReportFilters
): Promise<CrmManagementAnalyticsBundle> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "CRM_REPORTING_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  return fetchCrmManagementAnalytics(context, filters);
}
