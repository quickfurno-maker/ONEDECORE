import Link from "next/link";

interface StaffNavProps {
  readonly currentPath: string;
  readonly showCreate?: boolean;
}

export function StaffNav({ currentPath, showCreate = false }: StaffNavProps) {
  const items = [
    { href: "/admin/staff", label: "Directory" },
    ...(showCreate ? [{ href: "/admin/staff/new", label: "Add staff" } as const] : []),
  ];

  return (
    <nav aria-label="Staff administration" className="flex flex-wrap gap-2">
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
