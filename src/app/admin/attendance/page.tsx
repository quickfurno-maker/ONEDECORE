import type { Metadata } from "next";
import { AttendanceTodayPanel } from "@/features/staff-attendance/components/AttendanceTodayPanel";
import { AttendancePageHeader } from "@/features/staff-attendance/components/shell/AttendancePageHeader";
import { loadToday } from "@/features/staff-attendance/server/attendance-actions";
import { requireAttendanceSelfAccess } from "@/features/staff-attendance/server/attendance-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Attendance Today | ONEDECORE",
  description: "Mobile-first attendance check-in workspace.",
};

export default async function AttendanceTodayPage() {
  await requireAttendanceSelfAccess("/admin/attendance");
  const today = await loadToday();

  return (
    <div className="mx-auto max-w-xl space-y-6 lg:max-w-none">
      <AttendancePageHeader
        title="Today"
        description="Server-confirmed check-in and check-out with idempotent mobile actions."
      />
      <AttendanceTodayPanel today={today} />
    </div>
  );
}
