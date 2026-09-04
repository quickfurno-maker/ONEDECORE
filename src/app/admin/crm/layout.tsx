import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { resolveCrmAccess } from "@/features/crm/server/crm-auth";
import { CrmAccessDenied } from "@/features/crm/components/states/CrmAccessDenied";
import { CrmNav } from "@/features/crm/components/shell/CrmNav";
import { CrmWorkspaceShell } from "@/features/crm/components/shell/CrmWorkspaceShell";

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
      <CrmWorkspaceShell>
        <CrmNav currentPath="/admin/crm" />
        <CrmAccessDenied />
      </CrmWorkspaceShell>
    );
  }

  return (
    <CrmWorkspaceShell>
      <a
        href="#crm-main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--crm-surface)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--crm-text)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--crm-primary)]"
      >
        Skip to CRM content
      </a>
      <CrmNav
        currentPath="/admin/crm"
        showImports={resolution.context.canBulkImportLeads}
        showAssignmentRules={resolution.context.canManageLeadAssignmentRules}
        showCadences={resolution.context.canManageCadences}
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
      <div id="crm-main-content" className="crm-enter">
        {children}
      </div>
    </CrmWorkspaceShell>
  );
}
