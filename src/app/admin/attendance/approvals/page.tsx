import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AttendanceApprovalInbox } from "@/features/staff-attendance/components/AttendanceApprovalInbox";
import { AttendancePageHeader } from "@/features/staff-attendance/components/shell/AttendancePageHeader";
import { loadApprovalInbox } from "@/features/staff-attendance/server/workforce-actions";
import { getAttendanceAccessContext } from "@/features/staff-attendance/server/attendance-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Attendance Approvals | ONEDECORE",
  description: "Super Admin attendance approval inbox.",
};

export default async function AttendanceApprovalsPage() {
  const context = await getAttendanceAccessContext();

  if (!context) {
    redirect("/auth/login?next=%2Fadmin%2Fattendance%2Fapprovals");
  }

  // Approval authority is Super Admin only. The RPC enforces this again, so a
  // direct request cannot bypass the missing nav entry.
  if (!context.canApproveAttendance) {
    redirect("/auth/forbidden");
  }

  const rows = await loadApprovalInbox({ limit: 200 });

  return (
    <div className="space-y-6">
      <AttendancePageHeader
        title="Attendance approvals"
        description="Approve, edit, reject or return attendance. Only approved days are official and payroll-valid."
      />
      <AttendanceApprovalInbox rows={rows} />
    </div>
  );
}
