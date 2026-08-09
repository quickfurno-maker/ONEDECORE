import type { Metadata } from "next";
import { AttendanceCorrectionForm } from "@/features/staff-attendance/components/AttendanceCorrectionForm";
import { AttendancePageHeader } from "@/features/staff-attendance/components/shell/AttendancePageHeader";
import { requireAttendanceCorrectionAccess } from "@/features/staff-attendance/server/attendance-auth";
import { loadCorrectionStaffOptions } from "@/features/staff-attendance/server/attendance-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Attendance Corrections | ONEDECORE",
};

export default async function AttendanceCorrectionsPage() {
  const context = await requireAttendanceCorrectionAccess("/admin/attendance/corrections");
  const staffOptions = await loadCorrectionStaffOptions(context);

  return (
    <div className="space-y-6">
      <AttendancePageHeader
        title="Corrections"
        description="Audited manual attendance corrections within your authorized team scope."
      />
      <AttendanceCorrectionForm staffOptions={staffOptions} />
    </div>
  );
}
