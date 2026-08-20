import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin-ops/components/AdminShell.tsx";
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
  title: "Operations Suite | ONEDECORE",
  description: "Internal operations workspace for ONEDECORE staff.",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireStaffPermission("admin.access", "/admin");
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

  const flags: OpsNavFlags = {
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

  const identity = await fetchOpsIdentity(session.userId, session.email);

  const hrefs = {
    crmLeads: "/admin/crm/leads",
    whatsappInbox: "/admin/whatsapp/inbox",
    attendance: "/admin/attendance",
    projects: "/admin/projects",
    campaigns: "/admin/campaigns",
  } as const;

  return (
    <AdminShell identity={identity} flags={flags} hrefs={hrefs}>
      {children}
    </AdminShell>
  );
}
