import Link from "next/link";

interface AttendanceNavProps {
  readonly currentPath: string;
  readonly showTeam?: boolean;
  readonly showCalendar?: boolean;
  readonly showCorrections?: boolean;
  readonly showPolicies?: boolean;
}

export function AttendanceNav({
  currentPath,
  showTeam = false,
  showCalendar = true,
  showCorrections = false,
  showPolicies = false,
}: AttendanceNavProps) {
  const items = [
    { href: "/admin/attendance", label: "Today" },
    ...(showCalendar
      ? [{ href: "/admin/attendance/calendar", label: "Calendar" } as const]
      : []),
    ...(showTeam ? [{ href: "/admin/attendance/team", label: "Team" } as const] : []),
    ...(showCorrections
      ? [{ href: "/admin/attendance/corrections", label: "Corrections" } as const]
      : []),
    ...(showPolicies
      ? [{ href: "/admin/attendance-policies", label: "Policies" } as const]
      : []),
  ];

  return (
    <nav aria-label="Attendance workspace" className="flex flex-wrap gap-2">
      {items.map((item) => {
        const isActive = currentPath.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`min-h-11 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
              isActive
                ? "bg-neutral-800 text-neutral-50"
                : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
