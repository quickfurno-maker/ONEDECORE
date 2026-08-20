import type { Metadata } from "next";
import Link from "next/link";
import { MetricCard } from "@/features/admin-ops/components/MetricCard.tsx";
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
import { getCrmAccessContext } from "@/features/crm/server/crm-auth";

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

  const snapshot = await loadOpsDashboardSnapshot(crmOverviewNavFlags(context));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[30px] font-semibold text-[var(--od-text)]">CRM</h1>
          <p className="mt-1 text-sm text-[var(--od-muted)]">Sales workspace</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {context.canCreateLeads ? (
            <Link
              href="/admin/crm/leads/new"
              className="inline-flex min-h-10 items-center rounded-[8px] bg-[var(--od-gold)] px-4 text-sm font-semibold text-[#1a1408]"
            >
              + New Lead
            </Link>
          ) : null}
          {context.canBulkImportLeads ? (
            <Link
              href="/admin/crm/imports/new"
              className="inline-flex min-h-10 items-center rounded-[8px] border border-[var(--od-border-strong)] px-4 text-sm text-[var(--od-text-2)]"
            >
              Import
            </Link>
          ) : null}
        </div>
      </div>
      {snapshot.kpis.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {snapshot.kpis.slice(0, 4).map((item, index) => (
            <MetricCard key={item.id} item={item} index={index} />
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-3">
        <NeedsAttentionPanel items={snapshot.attention} />
        <PipelinePanel stages={snapshot.pipeline} />
        <TargetPanel target={snapshot.target} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SourceDonut slices={snapshot.sources} />
        <RecentLeadsPanel leads={snapshot.recentLeads} />
      </div>
      <ActivityFeed items={snapshot.activity} />
    </div>
  );
}
