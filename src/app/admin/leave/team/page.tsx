import type { Metadata } from "next";
import { LeaveApprovalQueue } from "@/features/staff-leave/components/LeaveApprovalQueue";
import { LeavePageHeader } from "@/features/staff-leave/components/shell/LeavePageHeader";
import { loadTeamPendingRequests } from "@/features/staff-leave/server/leave-actions";
import { requireLeaveTeamApproveAccess } from "@/features/staff-leave/server/leave-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leave Approvals | ONEDECORE",
};

export default async function LeaveTeamPage() {
  await requireLeaveTeamApproveAccess("/admin/leave/team");
  const requests = await loadTeamPendingRequests();

  return (
    <div className="space-y-6">
      <LeavePageHeader
        title="Approval queue"
        description="Review pending leave requests from your direct reports."
      />
      <LeaveApprovalQueue requests={requests} />
    </div>
  );
}
