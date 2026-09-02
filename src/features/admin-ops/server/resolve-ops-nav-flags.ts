import "server-only";

import { cache } from "react";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth.ts";
import { hasAnyCrmLeadReadPermission } from "@/features/crm/server/crm-permissions.ts";
import { hasAnyStaffNavPermission } from "@/features/staff-admin/server/staff-permissions.ts";
import { hasAnyAttendanceNavPermission } from "@/features/staff-attendance/server/attendance-auth.ts";
import { hasAnyLeaveNavPermission } from "@/features/staff-leave/server/leave-auth.ts";
import { hasAnyWhatsappInboxReadPermission } from "@/features/whatsapp/server/whatsapp-permissions.ts";
import { hasAnyProjectReadPermission } from "@/features/projects/server/project-permissions.ts";
import { hasAnyCampaignReadPermission } from "@/features/marketing/server/campaign-permissions.ts";
import { hasLandingPagesReadPermission } from "@/features/landing-lab/server/landing-permissions.ts";
import {
  hasAnyCommerceReadPermission,
  probeCommercePermissions,
} from "@/features/commerce/server/commerce-permissions.ts";
import { probeQuotationPermissions } from "@/features/quotations/server/quotation-permissions.ts";
import type { OpsNavFlags } from "../types.ts";

const DENIED_QUOTATION = {
  canReadQuotations: false,
  canCreateQuotations: false,
  canEditQuotations: false,
} as const;

export const resolveOpsNavFlags = cache(async (): Promise<OpsNavFlags> => {
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
    quotationPermissions,
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
    probeQuotationPermissions().catch(() => DENIED_QUOTATION),
  ]);

  const crmContext = showCrmLink ? await getCrmAccessContext() : null;
  const commercePermissions = showCommerceLink
    ? await probeCommercePermissions()
    : {
        canManageCatalog: false,
        canManageInventory: false,
        canManageSettings: false,
      };

  return {
    crm: showCrmLink,
    quotations: quotationPermissions.canReadQuotations,
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
    crmSlaSettings: crmContext?.canManageSlaPolicy ?? false,
    createLead: crmContext?.canCreateLeads ?? false,
    createQuotation: quotationPermissions.canCreateQuotations,
    commerceCatalog: commercePermissions.canManageCatalog,
    commerceInventory: commercePermissions.canManageInventory,
    commerceSettings: commercePermissions.canManageSettings,
  };
});
