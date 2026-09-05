import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AttendanceAccessDenied } from "@/features/staff-attendance/components/states/AttendanceAccessDenied";
import { AttendanceNav } from "@/features/staff-attendance/components/shell/AttendanceNav";
import { resolveAttendanceAccess } from "@/features/staff-attendance/server/attendance-auth";

export const dynamic = "force-dynamic";

export default async function AttendanceLayout({ children }: { children: ReactNode }) {
  const resolution = await resolveAttendanceAccess();

  if (resolution.kind === "unauthenticated") {
    redirect("/auth/login?portal=admin&next=%2Fadmin%2Fattendance");
  }

  if (resolution.kind === "inactive") {
    redirect("/auth/forbidden");
  }

  if (resolution.kind === "denied") {
    return (
      <div className="space-y-6">
        <AttendanceNav currentPath="/admin/attendance" />
        <AttendanceAccessDenied />
      </div>
    );
  }

  const context = resolution.context;

  return (
    <div className="space-y-6">
      <a
        href="#attendance-main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-neutral-800 focus:px-3 focus:py-2 focus:text-sm focus:text-neutral-100"
      >
        Skip to attendance content
      </a>
      <AttendanceNav
        currentPath="/admin/attendance"
        showTeam={context.canReadTeamAttendance || context.canReadAllAttendance}
        showCalendar={
          context.canSelfAttendance ||
          context.canReadTeamAttendance ||
          context.canReadAllAttendance
        }
        showCorrections={
          context.canCorrectAllAttendance || context.canCorrectTeamAttendance
        }
        showPolicies={context.canManagePolicies}
        showApprovals={context.canApproveAttendance}
      />
      <div id="attendance-main-content">{children}</div>
    </div>
  );
}
