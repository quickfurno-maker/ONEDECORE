import type { Metadata } from "next";
import { AttendanceTeamTable } from "@/features/staff-attendance/components/AttendanceTeamTable";
import { AttendancePageHeader } from "@/features/staff-attendance/components/shell/AttendancePageHeader";
import { loadTeam } from "@/features/staff-attendance/server/attendance-actions";
import { requireAttendanceTeamRead } from "@/features/staff-attendance/server/attendance-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team Attendance | ONEDECORE",
};

export default async function AttendanceTeamPage() {
  await requireAttendanceTeamRead("/admin/attendance/team");
  const rows = await loadTeam();

  return (
    <div className="space-y-6">
      <AttendancePageHeader
        title="Team today"
        description="Direct-report attendance summary for the current business date."
      />
      <AttendanceTeamTable rows={rows} />
    </div>
  );
}
