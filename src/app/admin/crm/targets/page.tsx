import type { Metadata } from "next";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { SalesTargetsPanel } from "@/features/crm/components/targets/SalesTargetsPanel";
import { requireCrmSalesTargetsAccess } from "@/features/crm/server/crm-auth";
import { fetchCrmAssigneeDirectory } from "@/features/crm/server/crm-lead-queries";
import { fetchSalesTargetsForCurrentUser } from "@/features/crm/server/crm-sales-target-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales Targets | ONEDECORE",
  description: "Monthly sales target configuration for the CRM workspace.",
};

export default async function CrmTargetsPage() {
  const context = await requireCrmSalesTargetsAccess();
  const [targets, assignees] = await Promise.all([
    fetchSalesTargetsForCurrentUser(),
    context.canManageSalesTargets
      ? fetchCrmAssigneeDirectory(context)
      : Promise.resolve([]),
  ]);

  const isExecutiveView =
    !context.canManageSalesTargets && !context.canReadBroad;

  const visibleTargets = isExecutiveView
    ? targets.filter(
        (target) =>
          target.targetScope === "executive_personal" &&
          target.targetUserId === context.userId
      )
    : targets;

  const title = isExecutiveView ? "My Target" : "Sales Targets";
  const description = isExecutiveView
    ? "View your personal monthly target configuration."
    : "Configure monthly team and executive targets. Achievement remains inactive until Phase 7B.";

  return (
    <div className="space-y-6">
      <CrmPageHeader title={title} description={description} />
      <SalesTargetsPanel
        context={context}
        targets={visibleTargets}
        assignees={assignees}
        isExecutiveView={isExecutiveView}
      />
    </div>
  );
}
