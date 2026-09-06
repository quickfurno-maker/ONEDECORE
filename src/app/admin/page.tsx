import type { Metadata } from "next";
import Link from "next/link";
import { MetricCard } from "@/features/admin-ops/components/MetricCard.tsx";
import { NeedsAttentionPanel } from "@/features/admin-ops/components/NeedsAttentionPanel.tsx";
import { PipelinePanel } from "@/features/admin-ops/components/PipelinePanel.tsx";
import { ActivityFeed } from "@/features/admin-ops/components/ActivityFeed.tsx";
import { SourceDonut } from "@/features/admin-ops/components/SourceDonut.tsx";
import { RecentLeadsPanel } from "@/features/admin-ops/components/RecentLeadsPanel.tsx";
import { TargetPanel } from "@/features/admin-ops/components/TargetPanel.tsx";
import { loadOpsDashboardSnapshot } from "@/features/admin-ops/server/dashboard-snapshot.ts";
import { fetchOpsIdentity } from "@/features/admin-ops/server/ops-identity.ts";
import { resolveOpsNavFlags } from "@/features/admin-ops/server/resolve-ops-nav-flags.ts";
import { redirect } from "next/navigation";
import { requireStaffPermission } from "@/server/auth";
import { MANAGER_HOME } from "@/features/manager-workspace/contracts/manager-home";
import { resolveManagerAccess } from "@/features/manager-workspace/server/manager-access";

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

export default async function AdminPage() {
  const session = await requireStaffPermission("admin.access", "/admin");

  /*
   * A Sales Manager belongs in the Manager workspace, not on the owner's
   * dashboard.
   *
   * This page is the Super Admin's view of the whole business — global KPIs,
   * campaign and commerce panels, the attention feed. A manager reaching it
   * through a bookmark, a stale `next=/admin` or the address bar should land
   * where they actually work rather than on a page where most panels would
   * refuse to load.
   *
   * Only THIS page redirects. `/admin/*` feature routes stay exactly as they
   * are, permission-guarded individually, because the manager legitimately
   * works in several of them.
   */
  const managerAccess = await resolveManagerAccess();
  if (managerAccess.kind === "granted" && !managerAccess.access.isSuperAdmin) {
    redirect(MANAGER_HOME);
  }

  const flags = await resolveOpsNavFlags();
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
    <div className="mx-auto max-w-[1600px] space-y-6 lg:space-y-7">
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
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
