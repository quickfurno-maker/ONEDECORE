import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LeaveAccessDenied } from "@/features/staff-leave/components/states/LeaveAccessDenied";
import { LeaveNav } from "@/features/staff-leave/components/shell/LeaveNav";
import { resolveLeaveAccess } from "@/features/staff-leave/server/leave-auth";

export const dynamic = "force-dynamic";

export default async function LeaveLayout({ children }: { children: ReactNode }) {
  const resolution = await resolveLeaveAccess();

  if (resolution.kind === "unauthenticated") {
    redirect("/auth/login?next=%2Fadmin%2Fleave");
  }

  if (resolution.kind === "inactive") {
    redirect("/auth/forbidden");
  }

  if (resolution.kind === "denied") {
    return (
      <div className="space-y-6">
        <LeaveNav currentPath="/admin/leave" />
        <LeaveAccessDenied />
      </div>
    );
  }

  const context = resolution.context;

  return (
    <div className="space-y-6">
      <a
        href="#leave-main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-neutral-800 focus:px-3 focus:py-2 focus:text-sm focus:text-neutral-100"
      >
        Skip to leave content
      </a>
      <LeaveNav
        currentPath="/admin/leave"
        showTeam={context.canApproveTeamLeave || context.canManageLeave}
        showTypes={context.canManageLeave}
        showHolidays={context.canManageHolidays}
      />
      <div id="leave-main-content">{children}</div>
    </div>
  );
}
