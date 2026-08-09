import Link from "next/link";

interface LeaveNavProps {
  readonly currentPath: string;
  readonly showTeam?: boolean;
  readonly showTypes?: boolean;
  readonly showHolidays?: boolean;
}

export function LeaveNav({
  currentPath,
  showTeam = false,
  showTypes = false,
  showHolidays = false,
}: LeaveNavProps) {
  const items = [
    { href: "/admin/leave", label: "My leave" },
    ...(showTeam ? [{ href: "/admin/leave/team", label: "Approvals" } as const] : []),
    ...(showTypes ? [{ href: "/admin/leave/types", label: "Types" } as const] : []),
    ...(showHolidays ? [{ href: "/admin/holidays", label: "Holidays" } as const] : []),
  ];

  return (
    <nav aria-label="Leave workspace" className="flex flex-wrap gap-2">
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
