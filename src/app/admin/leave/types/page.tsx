import type { Metadata } from "next";
import { LeaveTypeAdmin } from "@/features/staff-leave/components/LeaveTypeAdmin";
import { LeavePageHeader } from "@/features/staff-leave/components/shell/LeavePageHeader";
import { loadLeaveTypes } from "@/features/staff-leave/server/leave-actions";
import { requireLeaveManageAccess } from "@/features/staff-leave/server/leave-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leave Types | ONEDECORE",
};

export default async function LeaveTypesPage() {
  await requireLeaveManageAccess("/admin/leave/types");
  const leaveTypes = await loadLeaveTypes();

  return (
    <div className="space-y-6">
      <LeavePageHeader
        title="Leave types"
        description="Catalogue of configurable leave types (OD-9 launch selection)."
      />
      <LeaveTypeAdmin leaveTypes={leaveTypes} />
    </div>
  );
}
