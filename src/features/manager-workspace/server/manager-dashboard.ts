import "server-only";

import { redirect } from "next/navigation";

import { fetchOpsIdentity } from "@/features/admin-ops/server/ops-identity";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth";
import { fetchCrmMyDaySnapshot } from "@/features/crm/server/crm-my-day-queries";
import { fetchCrmReportingSnapshotForContext } from "@/features/crm/server/crm-reporting-queries";
import { fetchCrmManagementAnalyticsSnapshot } from "@/features/crm/server/crm-management-analytics-queries";
import { readProjectHighLevelStatus } from "@/features/projects/server/project-high-level-queries";
import { resolveReportDateRange } from "@/features/crm/contracts/reporting-date-range.ts";
import { pickHeadlineTargetRow } from "@/features/crm/contracts/management-analytics-contracts.ts";
import type { ReportFilters } from "@/features/crm/contracts/reporting-contracts.ts";
import type { ManagerWorkspaceAccess } from "./manager-access.ts";
import {
  buildManagerAttentionQueue,
  buildManagerProjectRows,
  buildManagerWorkload,
  managerPanelReady,
  managerPanelUnavailable,
  MANAGER_ATTENTION_LIMIT,
  type ManagerCrmSection,
  type ManagerDashboardSnapshot,
  type ManagerManagementSection,
  type ManagerPanelState,
  type ManagerProjectsSection,
  type ManagerTargetAttainment,
} from "../contracts/manager-dashboard.ts";

/**
 * The Sales Manager dashboard's server aggregation layer.
 *
 * WHAT THIS IS ALLOWED TO DO
 *
 * Compose. Every number below is produced by an existing canonical read model
 * that already enforces its own permission: `get_crm_my_day`, the CRM reporting
 * snapshot, `get_crm_management_analytics` and the project high-level read
 * model. This module adds no SQL, no SECURITY DEFINER shortcut, no permission
 * and no migration. If a metric cannot be obtained from those four, it is not
 * on the dashboard — the gap is documented instead of engineered around.
 *
 * IT IS ALSO NOT THE OWNER'S LOADER
 *
 * `loadOpsDashboardSnapshot` builds the Super Admin's view of the whole
 * business and reaches into campaigns, commerce and payroll to do it. Calling
 * it here and hiding the parts a manager may not see would put the boundary in
 * the JSX, where it is one careless edit from being lost. This file exists so
 * the manager's dashboard is composed of manager-shaped reads from the start.
 *
 * FAILURE ISOLATION
 *
 *   identity / CRM access   fail closed — the dashboard does not render.
 *   My Day (primary read)   fail closed — see below.
 *   reporting, analytics,   the panel says "Unavailable". The rest renders.
 *   projects
 *
 * My Day is the primary read because the KPI strip's first four cards and the
 * whole Needs Attention queue come from it: a dashboard that lost it would be
 * a page of zeros that looks like good news. So it is allowed to throw, and
 * the route's error boundary catches it.
 */

const REPORTING_UNAVAILABLE_NOTE =
  "Sales performance could not be read just now.";
const ANALYTICS_UNAVAILABLE_NOTE =
  "SLA, conversion and target figures could not be read just now.";
const PROJECTS_UNAVAILABLE_NOTE = "Project status could not be read just now.";

function thisMonthFilters(now?: Date): ReportFilters | null {
  /*
   * The canonical IST range helper. Not a hand-built UTC boundary, and not a
   * period the client recomputes: the same helper the reports page uses, so
   * "this month" means one thing across the product.
   */
  const resolved = resolveReportDateRange({ preset: "this_month", now });
  if (!resolved.range) {
    return null;
  }
  return {
    dateRange: resolved.range,
    sourceId: null,
    status: null,
    assigneeId: null,
  };
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

type ReportingResult = Awaited<
  ReturnType<typeof fetchCrmReportingSnapshotForContext>
>;
type AnalyticsResult = Awaited<
  ReturnType<typeof fetchCrmManagementAnalyticsSnapshot>
>;
type ProjectsResult = Awaited<ReturnType<typeof readProjectHighLevelStatus>>;

function buildCrmSection(
  reporting: ReportingResult,
  rangeLabel: string
): ManagerCrmSection {
  return {
    rangeLabel,
    totalLeads: reporting.summary.totalLeads,
    closedWonCount: reporting.summary.closedWonCount,
    closedLostCount: reporting.summary.closedLostCount,
    openFollowUps: reporting.followUps.open,
    overdueFollowUps: reporting.followUps.overdue,
    workload: buildManagerWorkload(reporting.assigneeWorkload),
  };
}

function buildTargetAttainment(
  analytics: AnalyticsResult
): ManagerTargetAttainment | null {
  const row = pickHeadlineTargetRow(
    analytics.analytics.targets.rows,
    analytics.scopeOwnerId
  );
  if (!row) {
    // Nobody configured a target for this period. That is "Not configured",
    // and the card says exactly that rather than showing 0% attainment.
    return null;
  }

  return {
    label: row.targetDisplayName,
    revenueTargetPaise: row.revenueTargetPaise,
    achievedPaise: row.achievedPaise,
    attainmentBasisPoints: row.attainmentBasisPoints,
    closedWonCountTarget: row.closedWonCountTarget,
    acceptedCount: row.acceptedCount,
  };
}

function buildManagementSection(
  analytics: AnalyticsResult
): ManagerManagementSection {
  const snapshot = analytics.analytics;
  return {
    period: snapshot.targets.period || analytics.targetPeriod,
    slaComplianceBasisPoints: snapshot.sla.complianceBasisPoints,
    slaDecidedCount: snapshot.sla.decidedCount,
    slaBreachedCount: snapshot.sla.breachedCount,
    wonRateBasisPoints: snapshot.conversion.wonRateBasisPoints,
    receivedCount: snapshot.conversion.receivedCount,
    medianFirstContactSeconds: snapshot.velocity.medianFirstContactSeconds,
    target: buildTargetAttainment(analytics),
  };
}

function buildProjectsSection(
  projects: ProjectsResult
): ManagerPanelState<ManagerProjectsSection> {
  if (projects.status !== "ok") {
    return managerPanelUnavailable(PROJECTS_UNAVAILABLE_NOTE);
  }
  return managerPanelReady(buildManagerProjectRows(projects.rows));
}

/**
 * Reads everything the Manager dashboard renders, in one pass.
 *
 * The optional reads run together through `allSettled` so one refusal cannot
 * take the others down with it, and so the page costs one round of latency
 * rather than three.
 */
export async function loadManagerDashboardSnapshot(
  access: ManagerWorkspaceAccess
): Promise<ManagerDashboardSnapshot> {
  const identity = await fetchOpsIdentity(access.userId, access.email);

  const crmContext = await getCrmAccessContext();
  if (!crmContext) {
    /*
     * The role gate let them into the workspace, but CRM read access is a
     * PERMISSION and it is asked for separately. Without it there is no
     * dashboard to draw, so this fails closed rather than rendering a frame
     * full of "Unavailable".
     */
    redirect("/auth/forbidden");
  }

  // Primary read. A failure here propagates: see the failure-isolation note.
  const myDay = await fetchCrmMyDaySnapshot(crmContext, {
    attentionLimit: 50,
    upcomingLimit: 50,
  });

  const filters = thisMonthFilters();

  const [reportingResult, analyticsResult, projectsResult] =
    await Promise.allSettled([
      filters
        ? fetchCrmReportingSnapshotForContext(crmContext, filters)
        : Promise.reject(new Error("report range unavailable")),
      filters
        ? fetchCrmManagementAnalyticsSnapshot(crmContext, filters)
        : Promise.reject(new Error("report range unavailable")),
      readProjectHighLevelStatus(),
    ]);

  const reporting = settledValue(reportingResult);
  const analytics = settledValue(analyticsResult);
  const projects = settledValue(projectsResult);

  const attention = buildManagerAttentionQueue(myDay, MANAGER_ATTENTION_LIMIT);

  return {
    capturedAt: myDay.capturedAt,
    localDate: myDay.localDate,
    identity: {
      userId: identity.userId,
      displayName: identity.displayName,
      firstName: identity.firstName,
      roleLabel: identity.roleLabel ?? "Sales Manager",
    },
    execution: {
      localDate: myDay.localDate,
      isTeamScope: myDay.isTeamScope,
      summary: myDay.summary,
      attention: attention.items,
      attentionTotal: attention.total,
    },
    crm:
      reporting && filters
        ? managerPanelReady(
            buildCrmSection(reporting, filters.dateRange.label)
          )
        : managerPanelUnavailable(REPORTING_UNAVAILABLE_NOTE),
    management: analytics
      ? managerPanelReady(buildManagementSection(analytics))
      : managerPanelUnavailable(ANALYTICS_UNAVAILABLE_NOTE),
    projects: projects
      ? buildProjectsSection(projects)
      : managerPanelUnavailable(PROJECTS_UNAVAILABLE_NOTE),
  };
}
