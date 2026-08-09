import type { Metadata } from "next";
import { StaffCreateForm } from "@/features/staff-admin/components/StaffCreateForm";
import { StaffPageHeader } from "@/features/staff-admin/components/shell/StaffPageHeader";
import { requireStaffAdminAccess } from "@/features/staff-admin/server/staff-auth";
import {
  loadAttendancePolicyOptions,
  loadReportingManagerDirectory,
} from "@/features/staff-admin/server/staff-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add Staff | ONEDECORE",
};

export default async function StaffCreatePage() {
  await requireStaffAdminAccess("/admin/staff/new");

  const [managers, policies] = await Promise.all([
    loadReportingManagerDirectory(),
    loadAttendancePolicyOptions(),
  ]);

  return (
    <div className="space-y-6">
      <StaffPageHeader
        title="Add staff member"
        description="Invite a new staff member and finalize their employment profile."
      />
      <StaffCreateForm managers={managers} policies={policies} />
    </div>
  );
}
