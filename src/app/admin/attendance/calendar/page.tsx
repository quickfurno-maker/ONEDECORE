import type { Metadata } from "next";
import { AttendanceCalendar } from "@/features/staff-attendance/components/AttendanceCalendar";
import { AttendancePageHeader } from "@/features/staff-attendance/components/shell/AttendancePageHeader";
import { resolveAttendanceBusinessDate } from "@/features/staff-attendance/contracts/dto";
import { loadMonth } from "@/features/staff-attendance/server/attendance-actions";
import { requireAttendanceCalendarAccess } from "@/features/staff-attendance/server/attendance-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Attendance Calendar | ONEDECORE",
};

interface AttendanceCalendarPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseMonthParam(
  value: string | string[] | undefined,
  fallback: number
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : fallback;
}

function parseYearParam(
  value: string | string[] | undefined,
  fallback: number
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : fallback;
}

export default async function AttendanceCalendarPage({
  searchParams,
}: AttendanceCalendarPageProps) {
  await requireAttendanceCalendarAccess("/admin/attendance/calendar");
  const resolved = await searchParams;
  const businessDate = resolveAttendanceBusinessDate();
  const [fallbackYear, fallbackMonth] = businessDate.split("-").map(Number);
  const year = parseYearParam(resolved.year, fallbackYear);
  const month = parseMonthParam(resolved.month, fallbackMonth);
  const summary = await loadMonth({ year, month });

  return (
    <div className="space-y-6">
      <AttendancePageHeader
        title="Calendar"
        description="Monthly attendance summary with operational totals only."
      />
      <AttendanceCalendar summary={summary} year={year} month={month} />
    </div>
  );
}
