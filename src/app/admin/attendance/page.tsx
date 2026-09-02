import type { Metadata } from "next";
import { AttendanceSubmissionPanel } from "@/features/staff-attendance/components/AttendanceSubmissionPanel";
import { AttendanceTodayPanel } from "@/features/staff-attendance/components/AttendanceTodayPanel";
import {
  WorkforceMonthlySummaryCard,
  WorkforceSubmissionHistory,
} from "@/features/staff-attendance/components/WorkforceMonthlySummaryCard";
import { AttendancePageHeader } from "@/features/staff-attendance/components/shell/AttendancePageHeader";
import {
  WORKFORCE_WEEKLY_OFF_MONTHLY_CAP,
  monthBounds,
} from "@/features/staff-attendance/contracts/workforce-contracts";
import { loadToday } from "@/features/staff-attendance/server/attendance-actions";
import { requireAttendanceSelfAccess } from "@/features/staff-attendance/server/attendance-auth";
import {
  loadMonthlyAttendanceSummary,
  loadSubmissionForDay,
  loadSubmissionsForMonth,
} from "@/features/staff-attendance/server/workforce-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Attendance Today | ONEDECORE",
  description: "Mobile-first attendance check-in, submission and approval status.",
};

export default async function AttendanceTodayPage() {
  const context = await requireAttendanceSelfAccess("/admin/attendance");
  const today = await loadToday();
  const { monthStart, monthEnd } = monthBounds(today.attendanceDate);

  const [submission, summary, history] = await Promise.all([
    loadSubmissionForDay({
      staffId: context.userId,
      attendanceDate: today.attendanceDate,
    }),
    loadMonthlyAttendanceSummary({ staffId: context.userId, month: monthStart }),
    loadSubmissionsForMonth({ staffId: context.userId, monthStart, monthEnd }),
  ]);

  const weeklyOffRemaining = summary.weeklyOffRemaining;
  const weeklyOffUsed = Math.max(
    0,
    WORKFORCE_WEEKLY_OFF_MONTHLY_CAP - weeklyOffRemaining
  );

  return (
    <div className="mx-auto max-w-xl space-y-6 lg:max-w-none">
      <AttendancePageHeader
        title="Today"
        description="Server-confirmed check-in and check-out, then submit the day for Super Admin approval."
      />
      <AttendanceTodayPanel today={today} />
      <AttendanceSubmissionPanel
        attendanceDate={today.attendanceDate}
        submission={submission}
        weeklyOffUsed={weeklyOffUsed}
        weeklyOffRemaining={weeklyOffRemaining}
      />
      <WorkforceMonthlySummaryCard summary={summary} />
      <WorkforceSubmissionHistory rows={history} />
    </div>
  );
}
