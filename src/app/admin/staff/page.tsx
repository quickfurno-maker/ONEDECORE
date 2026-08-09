import type { Metadata } from "next";
import Link from "next/link";
import { StaffDirectoryTable } from "@/features/staff-admin/components/StaffDirectoryTable";
import { StaffPageHeader } from "@/features/staff-admin/components/shell/StaffPageHeader";
import { getStaffAdminAccessContext, requireStaffReadAccess } from "@/features/staff-admin/server/staff-auth";
import { loadStaffList } from "@/features/staff-admin/server/staff-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff Directory | ONEDECORE",
  description: "Staff employment directory for authorized ONEDECORE administrators.",
};

export default async function StaffDirectoryPage() {
  await requireStaffReadAccess("/admin/staff");
  const [items, context] = await Promise.all([
    loadStaffList(),
    getStaffAdminAccessContext(),
  ]);

  return (
    <div className="space-y-6">
      <StaffPageHeader
        title="Staff directory"
        description="Employment profiles with role-scoped visibility enforced by database RLS."
        actions={
          context?.canManageStaff ? (
            <Link
              href="/admin/staff/new"
              className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              Add staff
            </Link>
          ) : null
        }
      />
      <StaffDirectoryTable items={items} />
    </div>
  );
}
