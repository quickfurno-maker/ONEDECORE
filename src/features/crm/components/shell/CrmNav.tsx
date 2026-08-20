"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface CrmNavProps {
  readonly currentPath?: string;
  readonly showImports?: boolean;
  readonly showAssignmentRules?: boolean;
  readonly showTargets?: boolean;
  readonly showReports?: boolean;
  readonly targetsLabel?: string;
  readonly reportsLabel?: string;
}

const BASE_NAV_ITEMS = [{ href: "/admin/crm/leads", label: "Leads" }] as const;

export function CrmNav({
  currentPath,
  showImports = false,
  showAssignmentRules = false,
  showTargets = false,
  showReports = false,
  targetsLabel = "Sales Targets",
  reportsLabel = "Reports",
}: CrmNavProps) {
  const pathname = usePathname();
  const activePath = currentPath && currentPath !== "/admin/crm" ? currentPath : pathname;
  const items = [
    { href: "/admin/crm", label: "Overview" },
    ...BASE_NAV_ITEMS,
    ...(showTargets
      ? [{ href: "/admin/crm/targets", label: targetsLabel } as const]
      : []),
    ...(showReports
      ? [{ href: "/admin/crm/reports", label: reportsLabel } as const]
      : []),
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
    <nav aria-label="CRM workspace" className="flex flex-wrap gap-1 rounded-[10px] border border-[var(--od-border)] bg-[var(--od-surface)] p-1">
      {items.map((item) => {
        const isActive =
          item.href === "/admin/crm"
            ? activePath === "/admin/crm"
            : activePath.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`relative inline-flex min-h-10 items-center rounded-[8px] px-3 text-[13px] font-medium transition ${
              isActive
                ? "bg-[var(--od-gold)]/12 text-[var(--od-text)]"
                : "text-[var(--od-text-2)] hover:bg-[var(--od-hover)]"
            }`}
          >
            {isActive ? (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[var(--od-gold)]" />
            ) : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
