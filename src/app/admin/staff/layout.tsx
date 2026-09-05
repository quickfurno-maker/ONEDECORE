import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { StaffAccessDenied } from "@/features/staff-admin/components/states/StaffAccessDenied";
import { StaffNav } from "@/features/staff-admin/components/shell/StaffNav";
import { resolveStaffAdminAccess } from "@/features/staff-admin/server/staff-auth";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const resolution = await resolveStaffAdminAccess();

  if (resolution.kind === "unauthenticated") {
    redirect("/auth/login?portal=admin&next=%2Fadmin%2Fstaff");
  }

  if (resolution.kind === "inactive") {
    redirect("/auth/forbidden");
  }

  if (resolution.kind === "denied") {
    return (
      <div className="space-y-6">
        <StaffNav currentPath="/admin/staff" />
        <StaffAccessDenied />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <a
        href="#staff-main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-neutral-800 focus:px-3 focus:py-2 focus:text-sm focus:text-neutral-100"
      >
        Skip to staff content
      </a>
      <StaffNav
        currentPath="/admin/staff"
        showCreate={resolution.context.canManageStaff}
      />
      <div id="staff-main-content">{children}</div>
    </div>
  );
}
