import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffDetailPanel } from "@/features/staff-admin/components/StaffDetailPanel";
import { StaffPageHeader } from "@/features/staff-admin/components/shell/StaffPageHeader";
import {
  getStaffAdminAccessContext,
  requireStaffReadAccess,
} from "@/features/staff-admin/server/staff-auth";
import { probeCanManageStaffCredentials } from "@/features/staff-admin/server/staff-permissions";
import {
  loadAttendancePolicyOptions,
  loadReportingManagerDirectory,
  loadStaffCredentialOperation,
  loadStaffDetail,
} from "@/features/staff-admin/server/staff-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff Detail | ONEDECORE",
};

interface StaffDetailPageProps {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function StaffDetailPage({ params }: StaffDetailPageProps) {
  await requireStaffReadAccess("/admin/staff");
  const { id } = await params;

  const [staff, context, managers, policies] = await Promise.all([
    loadStaffDetail(id),
    getStaffAdminAccessContext(),
    loadReportingManagerDirectory(),
    loadAttendancePolicyOptions(),
  ]);

  // Credential administration is Super Admin only and is checked again in
  // every RPC, so this only decides whether the controls are rendered.
  const canManageCredentials = await probeCanManageStaffCredentials();
  // Surfaces a half-finished credential operation so it can be retried.
  const pendingCredentialOperation = canManageCredentials
    ? await loadStaffCredentialOperation(id)
    : null;

  if (!staff) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <StaffPageHeader
        title={staff.displayName}
        description={`${staff.employeeCode} · ${staff.designation}`}
      />
      <StaffDetailPanel
        staff={staff}
        canManage={context?.canManageStaff ?? false}
        canManageCredentials={canManageCredentials}
        pendingCredentialOperation={pendingCredentialOperation}
        managers={managers}
        policies={policies}
      />
    </div>
  );
}
