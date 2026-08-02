import Link from "next/link";

interface CrmNavProps {
  readonly currentPath: string;
  readonly showImports?: boolean;
  readonly showAssignmentRules?: boolean;
}

const BASE_NAV_ITEMS = [{ href: "/admin/crm/leads", label: "Leads" }] as const;

export function CrmNav({
  currentPath,
  showImports = false,
  showAssignmentRules = false,
}: CrmNavProps) {
  const items = [
    ...BASE_NAV_ITEMS,
    ...(showImports
      ? [{ href: "/admin/crm/imports", label: "Imports" } as const]
      : []),
    ...(showAssignmentRules
      ? [
          {
            href: "/admin/crm/settings/assignment-rules",
            label: "Assignment Rules",
          } as const,
        ]
      : []),
  ];

  return (
    <nav aria-label="CRM workspace" className="flex flex-wrap gap-2">
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
