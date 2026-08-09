import type { Metadata } from "next";
import { AttendancePolicyForm } from "@/features/staff-attendance/components/AttendancePolicyForm";
import { AttendancePageHeader } from "@/features/staff-attendance/components/shell/AttendancePageHeader";
import { AttendanceNav } from "@/features/staff-attendance/components/shell/AttendanceNav";
import { requireAttendancePolicyManageAccess } from "@/features/staff-attendance/server/attendance-auth";
import { loadAttendancePolicies } from "@/features/staff-attendance/server/attendance-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Attendance Policies | ONEDECORE",
};

export default async function AttendancePoliciesPage() {
  await requireAttendancePolicyManageAccess("/admin/attendance-policies");
  const policies = await loadAttendancePolicies();

  return (
    <div className="space-y-6">
      <AttendanceNav
        currentPath="/admin/attendance-policies"
        showPolicies
        showCalendar={false}
      />
      <AttendancePageHeader
        title="Policies"
        description="Publish and activate attendance policies after owner OD gates are resolved."
      />
      <AttendancePolicyForm policies={policies} />
    </div>
  );
}
