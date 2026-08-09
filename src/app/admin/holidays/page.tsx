import type { Metadata } from "next";
import { HolidayAdmin } from "@/features/staff-leave/components/HolidayAdmin";
import { LeavePageHeader } from "@/features/staff-leave/components/shell/LeavePageHeader";
import { LeaveNav } from "@/features/staff-leave/components/shell/LeaveNav";
import { loadActiveHolidays } from "@/features/staff-leave/server/holiday-actions";
import { requireHolidayManageAccess } from "@/features/staff-leave/server/leave-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Holidays | ONEDECORE",
};

export default async function HolidaysPage() {
  await requireHolidayManageAccess("/admin/holidays");
  const holidays = await loadActiveHolidays();

  return (
    <div className="space-y-6">
      <LeaveNav currentPath="/admin/holidays" showHolidays />
      <LeavePageHeader
        title="Holiday calendar"
        description="Manage active company holidays used by attendance derivation."
      />
      <HolidayAdmin holidays={holidays} />
    </div>
  );
}
