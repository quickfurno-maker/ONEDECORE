import type { Metadata } from "next";

import { formatMyDayLocalDateLabel } from "@/features/crm/contracts/my-day-contracts.ts";
import { buildManagerKpiStrip } from "@/features/manager-workspace/contracts/manager-dashboard.ts";
import { ManagerAttentionPanel } from "@/features/manager-workspace/components/ManagerAttentionPanel";
import { ManagerMetricCard } from "@/features/manager-workspace/components/ManagerMetricCard";
import { ManagerProjectStatus } from "@/features/manager-workspace/components/ManagerProjectStatus";
import { ManagerQuickActions } from "@/features/manager-workspace/components/ManagerQuickActions";
import { ManagerSalesPerformance } from "@/features/manager-workspace/components/ManagerSalesPerformance";
import { ManagerShell } from "@/features/manager-workspace/components/ManagerShell";
import { ManagerTeamWorkload } from "@/features/manager-workspace/components/ManagerTeamWorkload";
import { requireSalesManager } from "@/features/manager-workspace/server/manager-access";
import { loadManagerDashboardSnapshot } from "@/features/manager-workspace/server/manager-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manager Dashboard | ONEDECORE",
  description: "Sales management workspace for authorized ONEDECORE personnel.",
};

/**
 * The Sales Manager dashboard.
 *
 * WHAT THIS IS
 *
 * A dedicated dashboard for the Sales Manager: today's slipping work, this
 * month's sales position, how enquiries are spread across the team, and where
 * the handed-over projects have reached.
 *
 * WHAT IT IS DELIBERATELY NOT
 *
 * The Super Admin dashboard with cards hidden. Every panel below is composed
 * from `loadManagerDashboardSnapshot`, which reads only canonical models the
 * role is already authorised for. It imports none of the owner's snapshot
 * loader and none of the owner's panels — not because they would look wrong,
 * but because a boundary enforced by which components a page happens to render
 * is one careless edit from being gone. The role lost its boundary that way
 * once already.
 *
 * READ ONLY. Nothing on this page mutates anything; every link leads to a
 * route that re-checks its own permissions.
 */
export default async function ManagerHomePage() {
  const access = await requireSalesManager();
  const snapshot = await loadManagerDashboardSnapshot(access);
  const kpis = buildManagerKpiStrip(snapshot);

  return (
    <ManagerShell
      displayName={snapshot.identity.displayName}
      roleLabel={snapshot.identity.roleLabel}
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="border-b border-neutral-800 pb-6">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            ONEDECORE Manager Workspace
          </span>
          <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight text-neutral-50 sm:text-3xl">
            Good to see you, {snapshot.identity.firstName}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Sales Manager · {formatMyDayLocalDateLabel(snapshot.localDate)}
          </p>
        </header>

        <section className="mt-6" aria-labelledby="manager-kpis">
          <h2 id="manager-kpis" className="sr-only">
            Today at a glance
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {kpis.map((kpi) => (
              <ManagerMetricCard key={kpi.key} kpi={kpi} />
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <ManagerAttentionPanel execution={snapshot.execution} />
            <ManagerSalesPerformance
              crm={snapshot.crm}
              management={snapshot.management}
            />
            <ManagerProjectStatus projects={snapshot.projects} />
          </div>
          <div className="space-y-6">
            <ManagerTeamWorkload crm={snapshot.crm} />
            <ManagerQuickActions />
          </div>
        </div>

        <footer className="mt-10 border-t border-neutral-800 pt-6">
          <p className="text-[11px] text-neutral-500">
            Restricted System — Unauthorized access attempts are monitored and
            logged.
          </p>
        </footer>
      </div>
    </ManagerShell>
  );
}
