import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin-ops/components/AdminShell.tsx";
import { fetchOpsIdentity } from "@/features/admin-ops/server/ops-identity.ts";
import { resolveOpsNavFlags } from "@/features/admin-ops/server/resolve-ops-nav-flags.ts";
import { requireStaffPermission } from "@/server/auth";
import { hasAnyCrmLeadReadPermission } from "@/features/crm/server/crm-permissions";
import { hasAnyWhatsappInboxReadPermission } from "@/features/whatsapp/server/whatsapp-permissions";
import { hasAnyAttendanceNavPermission } from "@/features/staff-attendance/server/attendance-auth";
import { hasAnyProjectReadPermission } from "@/features/projects/server/project-permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operations Suite | ONEDECORE",
  description: "Internal operations workspace for ONEDECORE staff.",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireStaffPermission("admin.access", "/admin");
  const flags = await resolveOpsNavFlags();
  const identity = await fetchOpsIdentity(session.userId, session.email);

  const hrefs = {
    crmLeads: "/admin/crm/leads",
    whatsappInbox: "/admin/whatsapp/inbox",
    attendance: "/admin/attendance",
    projects: "/admin/projects",
    campaigns: "/admin/campaigns",
  } as const;

  void hasAnyCrmLeadReadPermission;
  void hasAnyWhatsappInboxReadPermission;
  void hasAnyAttendanceNavPermission;
  void hasAnyProjectReadPermission;

  return (
    <AdminShell identity={identity} flags={flags} hrefs={hrefs}>
      {children}
    </AdminShell>
  );
}
