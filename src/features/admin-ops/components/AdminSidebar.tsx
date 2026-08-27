"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { OpsNavFlags } from "../types.ts";
import { OpsIcon, iconForHref, type OpsIconName } from "./OpsIcon.tsx";

interface AdminSidebarProps {
  readonly flags: OpsNavFlags;
  readonly hrefs: {
    readonly crmLeads: string;
    readonly whatsappInbox: string;
    readonly attendance: string;
    readonly projects: string;
    readonly campaigns: string;
  };
  readonly collapsed: boolean;
  readonly onToggleCollapse: () => void;
  readonly mobileOpen: boolean;
  readonly onCloseMobile: () => void;
}

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: OpsIconName;
  readonly children?: readonly NavItem[];
}

interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  if (href === "/admin/crm") {
    return pathname === "/admin/crm";
  }
  if (href === "/admin/commerce") {
    return pathname === "/admin/commerce";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function buildGroups(flags: OpsNavFlags, hrefs: AdminSidebarProps["hrefs"]): readonly NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: "overview",
      label: "Overview",
      items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }],
    },
  ];

  const sales: NavItem[] = [];
  if (flags.crm) {
    const children: NavItem[] = [
      { href: "/admin/crm", label: "Overview", icon: "crm" },
      { href: "/admin/crm/my-day", label: "My Day", icon: "clock" },
      { href: hrefs.crmLeads, label: "Leads", icon: "leads" },
    ];
    if (flags.crmTargets) {
      children.push({ href: "/admin/crm/targets", label: "Sales Targets", icon: "targets" });
    }
    if (flags.crmReports) {
      children.push({ href: "/admin/crm/reports", label: "Reports", icon: "reports" });
    }
    if (flags.crmImports) {
      children.push({ href: "/admin/crm/imports", label: "Imports", icon: "imports" });
    }
    if (flags.crmAssignmentRules) {
      children.push({
        href: "/admin/crm/settings/assignment-rules",
        label: "Assignment Rules",
        icon: "rules",
      });
    }
    sales.push({ href: "/admin/crm", label: "CRM", icon: "crm", children });
  }
  if (flags.quotations) {
    sales.push({ href: "/admin/quotations", label: "Quotations", icon: "quotations" });
  }
  if (flags.projects) {
    sales.push({ href: hrefs.projects, label: "Projects", icon: "projects" });
  }
  if (sales.length > 0) {
    groups.push({ id: "sales", label: "Sales & CRM", items: sales });
  }

  if (flags.whatsapp) {
    groups.push({
      id: "comms",
      label: "Communication",
      items: [{ href: hrefs.whatsappInbox, label: "WhatsApp Inbox", icon: "whatsapp" }],
    });
  }

  const marketing: NavItem[] = [];
  if (flags.campaigns) {
    marketing.push({ href: hrefs.campaigns, label: "Campaigns", icon: "campaigns" });
  }
  if (flags.landingLab) {
    marketing.push({ href: "/admin/landing-pages", label: "Landing Lab", icon: "landing" });
  }
  if (marketing.length > 0) {
    groups.push({ id: "marketing", label: "Marketing", items: marketing });
  }

  if (flags.commerce) {
    groups.push({
      id: "commerce",
      label: "Commerce",
      items: [
        {
          href: "/admin/commerce",
          label: "Commerce",
          icon: "commerce",
          children: [
            { href: "/admin/commerce", label: "Overview", icon: "commerce" },
            { href: "/admin/commerce/products", label: "Products", icon: "products" },
            { href: "/admin/commerce/categories", label: "Categories", icon: "categories" },
            { href: "/admin/commerce/settings", label: "Settings", icon: "settings" },
          ],
        },
      ],
    });
  }

  groups.push({
    id: "content",
    label: "Content",
    items: [{ href: "/admin/portfolio", label: "Portfolio CMS", icon: "portfolio" }],
  });

  const people: NavItem[] = [];
  if (flags.staff) {
    people.push({ href: "/admin/staff", label: "Staff", icon: "staff" });
  }
  if (flags.attendance) {
    people.push({ href: hrefs.attendance, label: "Attendance", icon: "attendance" });
  }
  if (flags.leave) {
    people.push({ href: "/admin/leave", label: "Leave", icon: "leave" });
  }
  if (people.length > 0) {
    groups.push({ id: "people", label: "People", items: people });
  }

  return groups;
}

function NavLink({
  href,
  label,
  icon,
  active,
  groupActive,
  collapsed,
  nested,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: OpsIconName;
  active: boolean;
  groupActive?: boolean;
  collapsed: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`group relative flex min-h-10 items-center gap-3 rounded-[8px] px-3 text-[13px] outline-none transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-gold)] ${
        active
          ? "bg-[var(--od-gold)]/10 text-[var(--od-text)]"
          : groupActive
            ? "text-[var(--od-text)]"
            : "text-[var(--od-text-2)] hover:bg-[var(--od-hover)] hover:text-[var(--od-text)]"
      } ${collapsed ? "justify-center px-0" : ""} ${nested && !collapsed ? "pl-9" : ""}`}
    >
      {active ? (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--od-gold)]" />
      ) : null}
      <span className={active ? "text-[var(--od-gold)]" : groupActive ? "text-[var(--od-gold)]/80" : "text-current"}>
        <OpsIcon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className={collapsed ? "sr-only" : ""}>{label}</span>
    </Link>
  );
}

export function AdminSidebar({
  flags,
  hrefs,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const groups = buildGroups(flags, hrefs);
  const [openParents, setOpenParents] = useState<Record<string, boolean>>({
    "/admin/crm": true,
    "/admin/commerce": true,
  });

  const body = (
    <div className="flex h-full flex-col">
      <div
        className={`relative flex h-16 items-center border-b border-[var(--od-border)] ${
          collapsed ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        <div className={collapsed ? "text-center" : "min-w-0 pl-0.5"}>
          <p className="font-serif text-lg font-semibold tracking-tight text-[var(--od-gold)]">
            {collapsed ? "OD" : "ONEDECORE"}
          </p>
          {collapsed ? null : (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--od-muted)]">
              Operations Suite
            </p>
          )}
        </div>
        <button
          type="button"
          className={`hidden min-h-9 min-w-9 items-center justify-center rounded-[8px] text-[var(--od-muted)] hover:bg-[var(--od-hover)] hover:text-[var(--od-text)] lg:flex ${
            collapsed ? "absolute right-1.5" : ""
          }`}
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <OpsIcon name={collapsed ? "expand" : "collapse"} className="h-4 w-4" />
        </button>
      </div>
      <nav aria-label="Operations" className="ops-scrollbar flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {groups.map((group) => (
          <div key={group.id}>
            {collapsed ? null : (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--od-muted)]">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                if (item.children && item.children.length > 0) {
                  const expanded = openParents[item.href] !== false;
                  return (
                    <div key={item.href}>
                      <div className="flex items-center">
                        <div className="min-w-0 flex-1">
                          <NavLink
                            href={item.href}
                            label={item.label}
                            icon={item.icon}
                            active={false}
                            groupActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                            collapsed={collapsed}
                            onNavigate={onCloseMobile}
                          />
                        </div>
                        {collapsed ? null : (
                          <button
                            type="button"
                            className="mr-1 flex min-h-8 min-w-8 items-center justify-center rounded-[6px] text-[var(--od-muted)] hover:bg-[var(--od-hover)]"
                            aria-expanded={expanded}
                            aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                            onClick={() =>
                              setOpenParents((value) => ({ ...value, [item.href]: !expanded }))
                            }
                          >
                            <OpsIcon name="chevron" className={`h-3.5 w-3.5 transition ${expanded ? "rotate-90" : ""}`} />
                          </button>
                        )}
                      </div>
                      {collapsed || !expanded
                        ? null
                        : item.children.map((child) => (
                              <NavLink
                                key={`${item.href}-${child.href}-${child.label}`}
                                href={child.href}
                                label={child.label}
                                icon={child.icon}
                                active={isActive(pathname, child.href)}
                                collapsed={false}
                                nested
                                onNavigate={onCloseMobile}
                              />
                            ))}
                    </div>
                  );
                }
                return (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon ?? iconForHref(item.href)}
                    active={isActive(pathname, item.href)}
                    collapsed={collapsed}
                    onNavigate={onCloseMobile}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close navigation"
          onClick={onCloseMobile}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 border-r border-[var(--od-border)] bg-[var(--od-sidebar)] transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "lg:w-[76px]" : "lg:w-[248px]"} w-[248px]`}
      >
        {body}
      </aside>
    </>
  );
}
