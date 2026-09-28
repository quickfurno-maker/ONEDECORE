"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface CrmNavProps {
  readonly currentPath?: string;
  readonly showImports?: boolean;
  readonly showAssignmentRules?: boolean;
  readonly showCadences?: boolean;
  readonly showTargets?: boolean;
  readonly showReports?: boolean;
  readonly showSlaSettings?: boolean;
  readonly targetsLabel?: string;
  readonly reportsLabel?: string;
}

/**
 * CRM 2B execution order: daily work first, then the two workspaces added in
 * this phase, then overview/reporting. Secondary links stay permission-gated.
 */
const BASE_NAV_ITEMS = [
  { href: "/admin/crm/my-day", label: "My Day" },
  { href: "/admin/crm/leads", label: "Leads" },
  { href: "/admin/crm/nurture", label: "Nurture" },
  { href: "/admin/crm/pipeline", label: "Pipeline" },
  { href: "/admin/crm/calendar", label: "Calendar" },
] as const;

export function CrmNav({
  currentPath,
  showImports = false,
  showAssignmentRules = false,
  showCadences = false,
  showTargets = false,
  showReports = false,
  showSlaSettings = false,
  targetsLabel = "Sales Targets",
  reportsLabel = "Reports",
}: CrmNavProps) {
  const pathname = usePathname();
  const activePath = currentPath && currentPath !== "/admin/crm" ? currentPath : pathname;
  const primaryItems = [
    ...BASE_NAV_ITEMS,
    { href: "/admin/crm", label: "Overview" },
  ];

  const managementItems = [
    ...(showCadences
      ? [{ href: "/admin/crm/cadences", label: "Cadences" } as const]
      : []),
    ...(showReports
      ? [{ href: "/admin/crm/reports", label: reportsLabel } as const]
      : []),
    ...(showTargets
      ? [{ href: "/admin/crm/targets", label: targetsLabel } as const]
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
    ...(showSlaSettings
      ? [{ href: "/admin/crm/settings/sla", label: "SLA Settings" } as const]
      : []),
  ];

  const renderItems = (
    items: ReadonlyArray<{ readonly href: string; readonly label: string }>
  ) =>
    items.map((item) => {
      const isActive =
        item.href === "/admin/crm"
          ? activePath === "/admin/crm"
          : activePath.startsWith(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          className={`relative inline-flex min-h-10 shrink-0 items-center rounded-[9px] border px-3 text-[13px] font-medium transition-all duration-150 ${
            isActive
              ? "border-[var(--crm-primary)]/25 bg-[var(--crm-primary-soft)] text-[var(--crm-primary)]"
              : "border-transparent text-[var(--crm-muted)] hover:border-[var(--crm-border)] hover:bg-[var(--crm-surface-subtle)] hover:text-[var(--crm-text)]"
          }`}
        >
          {isActive ? (
            <span
              aria-hidden
              className="absolute inset-x-3 bottom-0 h-px rounded-full bg-[var(--crm-primary)]"
            />
          ) : null}
          {item.label}
        </Link>
      );
    });

  return (
    <nav
      aria-label="CRM workspace"
      className="crm-nav -mx-1 space-y-1.5 px-2 py-2"
    >
      <div className="crm-scrollbar-x flex min-w-0 items-center gap-1 px-1">
        <span className="shrink-0 pr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--crm-muted)]">
          Work
        </span>
        <div className="flex min-w-max items-stretch gap-0.5">
          {renderItems(primaryItems)}
        </div>
      </div>
      {managementItems.length > 0 ? (
        <div className="crm-scrollbar-x flex min-w-0 items-center gap-1 px-1">
          <span className="shrink-0 pr-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--crm-muted)]">
            Manage
          </span>
          <div className="flex min-w-max items-stretch gap-0.5">
            {renderItems(managementItems)}
          </div>
        </div>
      ) : null}
    </nav>
  );
}
