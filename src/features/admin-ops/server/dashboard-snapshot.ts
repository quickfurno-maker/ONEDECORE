import "server-only";

import { LEAD_STAGE_CODES } from "@/features/crm/contracts/lead-stages.ts";
import { formatCrmCodeLabel } from "@/features/crm/contracts/crm-labels.ts";
import {
  ACHIEVEMENT_INACTIVE_COPY,
  formatInrFromPaise,
} from "@/features/crm/contracts/sales-target-contracts.ts";
import { LEAD_MONTH_ALL_COHORT } from "@/features/crm/contracts/lead-month-cohort.ts";
import { resolveReportDateRange } from "@/features/crm/contracts/reporting-date-range.ts";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth.ts";
import { getLeadListPageForCurrentUser } from "@/features/crm/server/crm-lead-repository.ts";
import { fetchCrmReportingSnapshot } from "@/features/crm/server/crm-reporting-queries.ts";
import { fetchSalesTargetsForCurrentUser } from "@/features/crm/server/crm-sales-target-service.ts";
import { createClient } from "@/lib/supabase/server";
import { listLeadQuotations } from "@/features/quotations/server/quotation-queries.ts";
import { listProjects } from "@/features/projects/server/project-queries.ts";
import type {
  OpsAttentionItem,
  OpsActivityItem,
  OpsKpiItem,
  OpsNavFlags,
  OpsPipelineStage,
  OpsRecentLead,
  OpsSourceSlice,
  OpsTargetCard,
} from "../types.ts";
import type { CrmAccessContext } from "@/features/crm/contracts/crm-access.ts";

export interface OpsDashboardSnapshot {
  readonly kpis: readonly OpsKpiItem[];
  readonly attention: readonly OpsAttentionItem[];
  readonly pipeline: readonly OpsPipelineStage[];
  readonly sources: readonly OpsSourceSlice[];
  readonly activity: readonly OpsActivityItem[];
  readonly recentLeads: readonly OpsRecentLead[];
  readonly target: OpsTargetCard | null;
  readonly trend: readonly number[];
}

export function crmOverviewNavFlags(
  context: CrmAccessContext,
  quotationAccess: { readonly quotations: boolean; readonly createQuotation: boolean }
): OpsNavFlags {
  return {
    crm: true,
    quotations: quotationAccess.quotations,
    projects: false,
    whatsapp: false,
    campaigns: false,
    landingLab: false,
    commerce: false,
    staff: false,
    attendance: false,
    leave: false,
    crmLeads: true,
    crmTargets: context.canReadSalesTargets,
    crmReports: context.canReadCrmReporting,
    crmImports: context.canBulkImportLeads,
    crmAssignmentRules: context.canManageLeadAssignmentRules,
    crmSlaSettings: context.canManageSlaPolicy,
    createLead: context.canCreateLeads,
    createQuotation: quotationAccess.createQuotation,
    commerceCatalog: false,
    commerceInventory: false,
    commerceSettings: false,
  };
}

function stageLabel(status: string): string {
  return formatCrmCodeLabel(status.replaceAll("_", "-"));
}

async function countLeads(options: {
  readonly status?: string;
  readonly openOnly?: boolean;
  readonly unassigned?: boolean;
}): Promise<number | null> {
  try {
    const supabase = await createClient();
    let query = supabase.from("leads").select("id", { count: "exact", head: true });
    if (options.status) {
      query = query.eq("status", options.status);
    }
    if (options.openOnly) {
      query = query.not("status", "in", "(closed_won,closed_lost)");
    }
    if (options.unassigned) {
      query = query.is("assigned_to", null);
    }
    const { count, error } = await query;
    if (error) {
      return null;
    }
    return count ?? 0;
  } catch {
    return null;
  }
}

export async function loadOpsDashboardSnapshot(
  flags: OpsNavFlags
): Promise<OpsDashboardSnapshot> {
  const context = flags.crm ? await getCrmAccessContext() : null;
  const kpis: OpsKpiItem[] = [];
  const attention: OpsAttentionItem[] = [];
  let pipeline: OpsPipelineStage[] = [];
  let sources: OpsSourceSlice[] = [];
  let trend: number[] = [];
  let target: OpsTargetCard | null = null;

  const leadPage = flags.crm
    ? await getLeadListPageForCurrentUser({
        q: null,
        status: null,
        sourceId: null,
        assignment: null,
        assigneeId: null,
        followUpDue: null,
        bucket: null,
        month: LEAD_MONTH_ALL_COHORT,
        page: 1,
        pageSize: 8,
      }).catch(() => null)
    : null;

  const recentLeads: OpsRecentLead[] =
    leadPage?.items.map((item) => ({
      id: item.id,
      name: item.submittedName,
      requirement: formatCrmCodeLabel(item.serviceCode),
      locality: item.locality ?? "—",
      status: item.status,
      source: item.primarySourceLabel,
      assignee: item.assigneeLabel,
      createdAt: item.createdAt,
    })) ?? [];

  const activity: OpsActivityItem[] = recentLeads.map((lead) => ({
    id: lead.id,
    title: "Lead created",
    detail: `${lead.name} · ${stageLabel(lead.status)}`,
    href: `/admin/crm/leads/${lead.id}`,
    occurredAt: lead.createdAt,
  }));

  if (flags.crm && context) {
    const [newCount, openCount, unassignedCount, stageCounts] = await Promise.all([
      countLeads({ status: "new" }),
      countLeads({ openOnly: true }),
      context.canReadBroad ? countLeads({ unassigned: true }) : Promise.resolve(null),
      Promise.all(
        LEAD_STAGE_CODES.map(async (status) => ({
          status,
          label: stageLabel(status),
          count: (await countLeads({ status })) ?? 0,
        }))
      ),
    ]);
    pipeline = stageCounts;

    if (newCount !== null) {
      kpis.push({
        id: "new-leads",
        label: "New Leads",
        value: String(newCount),
        context: "Status = new",
        href: "/admin/crm/leads?status=new",
        accent: "purple",
        sparkline: null,
      });
    }
    if (openCount !== null) {
      kpis.push({
        id: "open",
        label: "Open Opportunities",
        value: String(openCount),
        context: "Not closed",
        href: "/admin/crm/leads",
        accent: "warning",
        sparkline: null,
      });
    }

    if (unassignedCount && unassignedCount > 0) {
      attention.push({
        id: "unassigned",
        title: `${unassignedCount} unassigned lead${unassignedCount === 1 ? "" : "s"}`,
        detail: "Waiting for assignment",
        href: "/admin/crm/leads?assignment=unassigned",
        actionLabel: "Review",
        tone: "urgent",
      });
    }
  }

  if (flags.quotations) {
    try {
      const quotations = await listLeadQuotations();
      kpis.push({
        id: "quotations",
        label: "Quotations",
        value: String(quotations.length),
        context: "Visible to you",
        href: "/admin/quotations",
        accent: "blue",
        sparkline: null,
      });
      const drafts = quotations.filter((row) => row.status === "active");
      if (drafts.length > 0) {
        attention.push({
          id: "quotes",
          title: `${drafts.length} active quotation${drafts.length === 1 ? "" : "s"}`,
          detail: "Open the quotations workspace",
          href: "/admin/quotations",
          actionLabel: "Open",
          tone: "attention",
        });
      }
    } catch {
      // Permission or query failure — omit.
    }
  }

  if (flags.projects) {
    try {
      const projects = await listProjects();
      kpis.push({
        id: "projects",
        label: "Projects",
        value: String(projects.length),
        context: "Handover records",
        href: "/admin/projects",
        accent: "teal",
        sparkline: null,
      });
    } catch {
      // omit
    }
  }

  if (flags.whatsapp) {
    try {
      const supabase = await createClient();
      const { count, error } = await supabase
        .from("whatsapp_conversations")
        .select("id", { count: "exact", head: true });
      if (!error && count !== null) {
        kpis.push({
          id: "whatsapp",
          label: "WhatsApp Threads",
          value: String(count),
          context: "Conversations you can access",
          href: "/admin/whatsapp/inbox",
          accent: "positive",
          sparkline: null,
        });
      }
    } catch {
      // omit
    }
  }

  if (context?.canReadCrmReporting) {
    const range = resolveReportDateRange({ preset: "this_month" });
    if (range.range) {
      try {
        const snapshot = await fetchCrmReportingSnapshot({
          dateRange: range.range,
          sourceId: null,
          status: null,
          assigneeId: null,
        });
        sources = snapshot.sourceMix.map((item) => ({
          id: item.sourceId,
          label: item.sourceName,
          count: item.count,
        }));
        trend = snapshot.trend.map((point) => point.count);
        if (snapshot.followUps.overdue > 0) {
          attention.push({
            id: "overdue",
            title: `${snapshot.followUps.overdue} overdue follow-up${snapshot.followUps.overdue === 1 ? "" : "s"}`,
            detail: "Open follow-ups past due date",
            href: "/admin/crm/leads?followUpDue=overdue",
            actionLabel: "Review",
            tone: "urgent",
          });
        }
      } catch {
        // omit analytics panels
      }
    }
  }

  if (context?.canReadSalesTargets) {
    try {
      const targets = await fetchSalesTargetsForCurrentUser();
      const current = targets[0];
      if (current) {
        target = {
          month: current.targetMonth,
          revenueLabel: formatInrFromPaise(current.revenueTargetPaise),
          closedWonCountTarget: current.closedWonCountTarget,
          notice: ACHIEVEMENT_INACTIVE_COPY,
        };
        kpis.push({
          id: "target",
          label: "Monthly Target",
          value: formatInrFromPaise(current.revenueTargetPaise),
          context: "Configured target — achievement inactive",
          href: "/admin/crm/targets",
          accent: "gold",
          sparkline: null,
        });
      }
    } catch {
      // omit
    }
  }

  return {
    kpis: kpis.slice(0, 6),
    attention,
    pipeline,
    sources,
    activity,
    recentLeads,
    target,
    trend,
  };
}
