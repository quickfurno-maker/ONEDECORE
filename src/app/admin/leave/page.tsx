import type { Metadata } from "next";
import { LeaveRequestForm } from "@/features/staff-leave/components/LeaveRequestForm";
import { LeaveRequestList } from "@/features/staff-leave/components/LeaveRequestList";
import { LeavePageHeader } from "@/features/staff-leave/components/shell/LeavePageHeader";
import { loadActiveLeaveTypes, loadMyRequests } from "@/features/staff-leave/server/leave-actions";
import { requireLeaveSelfAccess } from "@/features/staff-leave/server/leave-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Leave | ONEDECORE",
};

export default async function LeaveIndexPage() {
  await requireLeaveSelfAccess("/admin/leave");
  const [requests, leaveTypes] = await Promise.all([
    loadMyRequests(),
    loadActiveLeaveTypes(),
  ]);

  return (
    <div className="space-y-6">
      <LeavePageHeader
        title="My leave"
        description="Submit and track leave requests with manager approval workflow."
      />
      <LeaveRequestForm leaveTypes={leaveTypes} />
      <LeaveRequestList requests={requests} />
    </div>
  );
}
