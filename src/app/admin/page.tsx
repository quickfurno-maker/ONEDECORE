import type { Metadata } from "next";
import Link from "next/link";
import { MetricCard } from "@/features/admin-ops/components/MetricCard.tsx";
import { NeedsAttentionPanel } from "@/features/admin-ops/components/NeedsAttentionPanel.tsx";
import { PipelinePanel } from "@/features/admin-ops/components/PipelinePanel.tsx";
import { ActivityFeed } from "@/features/admin-ops/components/ActivityFeed.tsx";
import { SourceDonut } from "@/features/admin-ops/components/SourceDonut.tsx";
import { RecentLeadsPanel } from "@/features/admin-ops/components/RecentLeadsPanel.tsx";
import { TargetPanel } from "@/features/admin-ops/components/TargetPanel.tsx";
import { QuickActionsMenu } from "@/features/admin-ops/components/QuickActionsMenu.tsx";
import { loadOpsDashboardSnapshot } from "@/features/admin-ops/server/dashboard-snapshot.ts";
import { fetchOpsIdentity } from "@/features/admin-ops/server/ops-identity.ts";
import type { OpsNavFlags } from "@/features/admin-ops/types.ts";
import { requireStaffPermission } from "@/server/auth";
import { hasAnyCrmLeadReadPermission } from "@/features/crm/server/crm-permissions";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth";
import { hasAnyStaffNavPermission } from "@/features/staff-admin/server/staff-permissions";
import { hasAnyAttendanceNavPermission } from "@/features/staff-attendance/server/attendance-auth";
import { hasAnyLeaveNavPermission } from "@/features/staff-leave/server/leave-auth";
import { hasAnyWhatsappInboxReadPermission } from "@/features/whatsapp/server/whatsapp-permissions";
import { hasAnyProjectReadPermission } from "@/features/projects/server/project-permissions";
import { hasAnyCampaignReadPermission } from "@/features/marketing/server/campaign-permissions";
import { hasLandingPagesReadPermission } from "@/features/landing-lab/server/landing-permissions";
import { hasAnyCommerceReadPermission } from "@/features/commerce/server/commerce-permissions";
import { probeQuotationPermissions } from "@/features/quotations/server/quotation-permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard | ONEDECORE Operations",
  description: "Role-aware operations dashboard.",
};

function greeting(hour: number): string {
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 17) {
    return "Good afternoon";
  }
  return "Good evening";
}

async function flagsForDashboard(): Promise<OpsNavFlags> {
  const [
    showCrmLink,
    showWhatsappLink,
    showStaffLink,
    showAttendanceLink,
    showLeaveLink,
    showProjectsLink,
    showCampaignsLink,
    showLandingLabLink,
    showCommerceLink,
  ] = await Promise.all([
    hasAnyCrmLeadReadPermission(),
    hasAnyWhatsappInboxReadPermission(),
    hasAnyStaffNavPermission(),
    hasAnyAttendanceNavPermission(),
    hasAnyLeaveNavPermission(),
    hasAnyProjectReadPermission(),
    hasAnyCampaignReadPermission(),
    hasLandingPagesReadPermission(),
    hasAnyCommerceReadPermission(),
  ]);
  const crmContext = showCrmLink ? await getCrmAccessContext() : null;
  const quotationPermissions = showCrmLink
    ? await probeQuotationPermissions().catch(() => ({
        canReadQuotations: false,
        canCreateQuotations: false,
        canEditQuotations: false,
      }))
    : { canReadQuotations: false, canCreateQuotations: false, canEditQuotations: false };
  return {
    crm: showCrmLink,
    quotations: showCrmLink,
    projects: showProjectsLink,
    whatsapp: showWhatsappLink,
    campaigns: showCampaignsLink,
    landingLab: showLandingLabLink,
    commerce: showCommerceLink,
    staff: showStaffLink,
    attendance: showAttendanceLink,
    leave: showLeaveLink,
    crmLeads: showCrmLink,
    crmTargets: crmContext?.canReadSalesTargets ?? false,
    crmReports: crmContext?.canReadCrmReporting ?? false,
    crmImports: crmContext?.canBulkImportLeads ?? false,
    crmAssignmentRules: crmContext?.canManageLeadAssignmentRules ?? false,
    createLead: crmContext?.canCreateLeads ?? false,
    createQuotation: quotationPermissions.canCreateQuotations,
  };
}

export default async function AdminPage() {
  const session = await requireStaffPermission("admin.access", "/admin");
  const flags = await flagsForDashboard();
  const [identity, snapshot] = await Promise.all([
    fetchOpsIdentity(session.userId, session.email),
    loadOpsDashboardSnapshot(flags),
  ]);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight text-[var(--od-text)]">
            {greeting(hour)}, {identity.firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--od-muted)]">
            Here’s what’s happening in your business today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QuickActionsMenu flags={flags} />
          {flags.createLead ? (
            <Link
              href="/admin/crm/leads/new"
              className="inline-flex min-h-10 items-center rounded-[8px] bg-[var(--od-gold)] px-4 text-sm font-semibold text-[#1a1408]"
            >
              + New Lead
            </Link>
          ) : null}
        </div>
      </div>

      {snapshot.kpis.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {snapshot.kpis.map((item, index) => (
            <MetricCard key={item.id} item={item} index={index} />
          ))}
        </div>
      ) : (
        <p className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-6 text-sm text-[var(--od-muted)]">
          No operational metrics are available for your permissions yet.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <NeedsAttentionPanel items={snapshot.attention} />
        <PipelinePanel stages={snapshot.pipeline} />
        <ActivityFeed items={snapshot.activity} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SourceDonut slices={snapshot.sources} />
        <RecentLeadsPanel leads={snapshot.recentLeads} />
        <TargetPanel target={snapshot.target} />
      </div>
    </div>
  );
}
