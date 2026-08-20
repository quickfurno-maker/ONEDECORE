"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { OpsNavFlags } from "../types.ts";

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
}

interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
  readonly nested?: boolean;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function buildGroups(flags: OpsNavFlags, hrefs: AdminSidebarProps["hrefs"]): readonly NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: "overview",
      label: "Overview",
      items: [{ href: "/admin", label: "Dashboard" }],
    },
  ];

  const sales: NavItem[] = [];
  if (flags.crm) {
    sales.push({ href: "/admin/crm", label: "CRM" });
  }
  if (flags.quotations) {
    sales.push({ href: "/admin/quotations", label: "Quotations" });
  }
  if (flags.projects) {
    sales.push({ href: hrefs.projects, label: "Projects" });
  }
  if (sales.length > 0) {
    groups.push({ id: "sales", label: "Sales & CRM", items: sales });
  }

  const crmNested: NavItem[] = [];
  if (flags.crm) {
    crmNested.push({ href: hrefs.crmLeads, label: "Leads" });
  }
  if (flags.crmTargets) {
    crmNested.push({ href: "/admin/crm/targets", label: "Sales Targets" });
  }
  if (flags.crmReports) {
    crmNested.push({ href: "/admin/crm/reports", label: "Reports" });
  }
  if (flags.crmImports) {
    crmNested.push({ href: "/admin/crm/imports", label: "Imports" });
  }
  if (flags.crmAssignmentRules) {
    crmNested.push({
      href: "/admin/crm/settings/assignment-rules",
      label: "Assignment Rules",
    });
  }
  if (crmNested.length > 0) {
    groups.push({ id: "crm-nested", label: "CRM", items: crmNested, nested: true });
  }

  if (flags.whatsapp) {
    groups.push({
      id: "comms",
      label: "Communication",
      items: [{ href: hrefs.whatsappInbox, label: "WhatsApp Inbox" }],
    });
  }

  const marketing: NavItem[] = [];
  if (flags.campaigns) {
    marketing.push({ href: hrefs.campaigns, label: "Campaigns" });
  }
  if (flags.landingLab) {
    marketing.push({ href: "/admin/landing-pages", label: "Landing Lab" });
  }
  if (marketing.length > 0) {
    groups.push({ id: "marketing", label: "Marketing", items: marketing });
  }

  if (flags.commerce) {
    groups.push({
      id: "commerce",
      label: "Commerce",
      items: [
        { href: "/admin/commerce", label: "Overview" },
        { href: "/admin/commerce/products", label: "Products" },
        { href: "/admin/commerce/categories", label: "Categories" },
        { href: "/admin/commerce/settings", label: "Settings" },
      ],
    });
  }

  groups.push({
    id: "content",
    label: "Content",
    items: [{ href: "/admin/portfolio", label: "Portfolio CMS" }],
  });

  const people: NavItem[] = [];
  if (flags.staff) {
    people.push({ href: "/admin/staff", label: "Staff" });
  }
  if (flags.attendance) {
    people.push({ href: hrefs.attendance, label: "Attendance" });
  }
  if (flags.leave) {
    people.push({ href: "/admin/leave", label: "Leave" });
  }
  if (people.length > 0) {
    groups.push({ id: "people", label: "People", items: people });
  }

  return groups;
}

function NavLink({
  href,
  label,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`group relative flex min-h-10 items-center rounded-[8px] px-3 text-[13px] transition duration-150 ${
        active
          ? "bg-[var(--od-gold)]/10 text-[var(--od-text)]"
          : "text-[var(--od-text-2)] hover:bg-[var(--od-hover)] hover:text-[var(--od-text)]"
      } ${collapsed ? "justify-center" : ""}`}
    >
      {active ? (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[var(--od-gold)]" />
      ) : null}
      <span className={collapsed ? "sr-only" : ""}>{label}</span>
      {collapsed ? (
        <span aria-hidden="true" className="text-[11px] font-semibold">
          {label.slice(0, 1)}
        </span>
      ) : null}
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
  const [crmOpen, setCrmOpen] = useState(true);

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-[var(--od-border)] px-4">
        <div className={collapsed ? "mx-auto text-center" : ""}>
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
          className="hidden min-h-9 min-w-9 items-center justify-center rounded-[8px] text-[var(--od-muted)] hover:bg-[var(--od-hover)] lg:flex"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>
      <nav aria-label="Operations" className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {groups.map((group) => {
          if (group.nested) {
            return (
              <div key={group.id}>
                {collapsed ? null : (
                  <button
                    type="button"
                    className="mb-1 flex w-full items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--od-muted)]"
                    onClick={() => setCrmOpen((value) => !value)}
                    aria-expanded={crmOpen}
                  >
                    {group.label}
                    <span>{crmOpen ? "–" : "+"}</span>
                  </button>
                )}
                {collapsed || crmOpen ? (
                  <div className="space-y-0.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        active={isActive(pathname, item.href)}
                        collapsed={collapsed}
                        onNavigate={onCloseMobile}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }
          return (
            <div key={group.id}>
              {collapsed ? null : (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--od-muted)]">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={isActive(pathname, item.href)}
                    collapsed={collapsed}
                    onNavigate={onCloseMobile}
                  />
                ))}
              </div>
            </div>
          );
        })}
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
