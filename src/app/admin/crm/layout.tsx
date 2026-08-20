import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { resolveCrmAccess } from "@/features/crm/server/crm-auth";
import { CrmAccessDenied } from "@/features/crm/components/states/CrmAccessDenied";
import { CrmNav } from "@/features/crm/components/shell/CrmNav";

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: ReactNode }) {
  const resolution = await resolveCrmAccess();

  if (resolution.kind === "unauthenticated") {
    redirect("/auth/login?next=%2Fadmin%2Fcrm");
  }

  if (resolution.kind === "inactive") {
    redirect("/auth/forbidden");
  }

  if (resolution.kind === "denied") {
    return (
      <div className="space-y-6">
        <CrmNav currentPath="/admin/crm" />
        <CrmAccessDenied />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <a
        href="#crm-main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--od-elevated)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--od-text)]"
      >
        Skip to CRM content
      </a>
      <CrmNav
        currentPath="/admin/crm"
        showImports={resolution.context.canBulkImportLeads}
        showAssignmentRules={resolution.context.canManageLeadAssignmentRules}
        showTargets={resolution.context.canReadSalesTargets}
        showReports={resolution.context.canReadCrmReporting}
        targetsLabel={
          resolution.context.canManageSalesTargets ||
          resolution.context.canReadBroad
            ? "Sales Targets"
            : "My Target"
        }
        reportsLabel={
          resolution.context.canReadBroad ? "Reports" : "My Performance"
        }
      />
      <div id="crm-main-content">{children}</div>
    </div>
  );
}
