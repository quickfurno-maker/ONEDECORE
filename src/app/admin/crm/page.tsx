import type { Metadata } from "next";
import Link from "next/link";
import { NeedsAttentionPanel } from "@/features/admin-ops/components/NeedsAttentionPanel.tsx";
import { PipelinePanel } from "@/features/admin-ops/components/PipelinePanel.tsx";
import { ActivityFeed } from "@/features/admin-ops/components/ActivityFeed.tsx";
import { SourceDonut } from "@/features/admin-ops/components/SourceDonut.tsx";
import { RecentLeadsPanel } from "@/features/admin-ops/components/RecentLeadsPanel.tsx";
import { TargetPanel } from "@/features/admin-ops/components/TargetPanel.tsx";
import {
  crmOverviewNavFlags,
  loadOpsDashboardSnapshot,
} from "@/features/admin-ops/server/dashboard-snapshot.ts";
import { resolveOpsNavFlags } from "@/features/admin-ops/server/resolve-ops-nav-flags.ts";
import { CrmExecutiveBar } from "@/features/crm/components/dashboard/CrmExecutiveBar.tsx";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth";
import { fetchCrmExecutiveSummary } from "@/features/crm/server/crm-executive-summary.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CRM | ONEDECORE Operations",
  description: "Sales workspace overview.",
};

export default async function CrmOverviewPage() {
  const context = await getCrmAccessContext();
  if (!context) {
    return null;
  }

  const flags = await resolveOpsNavFlags();
  const [snapshot, executive] = await Promise.all([
    loadOpsDashboardSnapshot(
      crmOverviewNavFlags(context, {
        quotations: flags.quotations,
        createQuotation: flags.createQuotation,
      })
    ),
    fetchCrmExecutiveSummary(context, { includeWhatsapp: flags.whatsapp }),
  ]);

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="CRM Overview"
        description="Monitor sales workload, pipeline health and the leads that need action next."
        actions={
          <>
            <Link href="/admin/crm/my-day" className="crm-btn crm-btn-secondary">
              Open My Day
            </Link>
            {context.canCreateLeads ? (
              <Link href="/admin/crm/leads/new" className="crm-btn crm-btn-primary">
                + New Lead
              </Link>
            ) : null}
            {context.canBulkImportLeads ? (
              <Link href="/admin/crm/imports/new" className="crm-btn crm-btn-secondary">
                Import
              </Link>
            ) : null}
          </>
        }
      />
      <CrmExecutiveBar summary={executive} />
      <div className="crm-dashboard-section-heading">
        <div>
          <p>Priority workspace</p>
          <h2>What needs your attention now</h2>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <NeedsAttentionPanel items={snapshot.attention} />
        <PipelinePanel stages={snapshot.pipeline} />
        <TargetPanel target={snapshot.target} />
      </div>
      <div className="crm-dashboard-section-heading">
        <div>
          <p>Business signal</p>
          <h2>Where leads are coming from and moving next</h2>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SourceDonut slices={snapshot.sources} />
        <RecentLeadsPanel leads={snapshot.recentLeads} />
      </div>
      <ActivityFeed items={snapshot.activity} />
    </div>
  );
}
