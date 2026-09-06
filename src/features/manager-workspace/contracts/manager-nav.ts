/**
 * The Sales Manager's navigation, written down once.
 *
 * WHY THIS IS NOT `resolveOpsNavFlags`
 *
 * The Super Admin sidebar is built from permission flags across the whole
 * product — Content, Commerce, Marketing, Payroll — and shows or hides groups
 * accordingly. Pointing the manager at it would make their boundary a function
 * of which flags happened to be false, and a flag that flips by accident is a
 * boundary that opens by accident.
 *
 * So the manager's workspace has its OWN grouped list. Every destination here
 * is a surface the role is already authorised for, and each of those routes
 * still enforces its own permission when opened: this list decides what is
 * OFFERED, never what is allowed.
 *
 * WHAT EACH ENTRY IS AUTHORISED BY
 *
 *   /admin/crm/my-day, /leads, /pipeline, /calendar   `requireCrmReadAccess`
 *   /admin/crm/leads/new                              `requireCrmCreateAccess`
 *                                                     (`leads.create`, retained)
 *   /admin/crm/targets       `requireCrmSalesTargetsAccess` — the role holds
 *                            `sales_targets.read` and NOT `sales_targets.manage`,
 *                            so this is a read surface for a manager.
 *   /admin/crm/reports       `crm.reporting.read`
 *   /admin/quotations        the quotations workspace's own guard
 *   /admin/whatsapp/inbox    the inbox's own guard
 *   /admin/projects          `projects.read_high_level` — status, not the
 *                            project workspace
 *   /admin/attendance        `attendance.self` + `attendance.team.read`
 *   /admin/leave             `leave.self` + `leave.team.approve`
 *   /admin/salary            `requireSalaryAccess`. The role holds `salary.self`
 *                            and NOT `salary.manage`, so this is the manager's
 *                            OWN salary and nothing else. There is deliberately
 *                            no payroll entry here of any kind.
 */

export interface ManagerNavItem {
  readonly href: string;
  readonly label: string;
  readonly detail: string;
}

export interface ManagerNavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly ManagerNavItem[];
}

export const MANAGER_NAV_GROUPS: readonly ManagerNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      {
        href: "/manager",
        label: "Dashboard",
        detail: "Today's sales position for your team.",
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      {
        href: "/admin/crm/my-day",
        label: "My Day",
        detail: "Today's follow-ups and the enquiries that need a decision.",
      },
      {
        href: "/admin/crm/leads",
        label: "Enquiries",
        detail: "Work the sales pipeline, assign enquiries and record follow-ups.",
      },
      {
        href: "/admin/crm/pipeline",
        label: "Pipeline",
        detail: "Every open enquiry by stage.",
      },
      {
        href: "/admin/crm/calendar",
        label: "Calendar",
        detail: "Scheduled follow-ups and consultations.",
      },
      {
        href: "/admin/quotations",
        label: "Quotations",
        detail: "Prepare, finalise and send customer quotations.",
      },
      {
        // Read-only for this role: `sales_targets.read` without
        // `sales_targets.manage`. Setting a target stays the owner's.
        href: "/admin/crm/targets",
        label: "Sales Targets",
        detail: "This month's targets and attainment for your team.",
      },
      {
        href: "/admin/crm/reports",
        label: "Reports",
        detail: "Sales reporting and analytics for your team.",
      },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    items: [
      {
        href: "/admin/whatsapp/inbox",
        label: "WhatsApp",
        detail: "Reply to customers and route conversations across the team.",
      },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    items: [
      {
        // Status only. Execution is the assigned Project Manager's, and the
        // page this points at serves the manager a dedicated read model rather
        // than the project workspace.
        href: "/admin/projects",
        label: "Project Status",
        detail: "Where each live project has reached, and who is running it.",
      },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      {
        href: "/admin/attendance",
        label: "Attendance",
        detail: "Your own attendance and your team's.",
      },
      {
        href: "/admin/leave",
        label: "Leave",
        detail: "Your leave, and approvals for your direct reports.",
      },
    ],
  },
  {
    id: "account",
    label: "My account",
    items: [
      {
        // SELF ONLY. `salary.self` without `salary.manage`: this is the
        // manager's own salary and payment history. Payroll administration is
        // not offered here, and the route refuses it regardless.
        href: "/admin/salary",
        label: "My Salary",
        detail: "Your own salary statements and payment history.",
      },
    ],
  },
];

/** The grouped model, flattened. The sidebar renders the groups. */
export const MANAGER_NAV_ITEMS: readonly ManagerNavItem[] =
  MANAGER_NAV_GROUPS.flatMap((group) => group.items);

/**
 * Starting a new enquiry by hand.
 *
 * A quick action rather than a sidebar entry: it is a thing the manager DOES
 * occasionally, not a place they live. `requireCrmCreateAccess` on the target
 * route is what actually permits it.
 */
export const MANAGER_NEW_ENQUIRY: ManagerNavItem = {
  href: "/admin/crm/leads/new",
  label: "New Enquiry",
  detail: "Log an enquiry that arrived outside the website.",
};

/** The buttons under the dashboard: the one action, then the workspaces. */
export const MANAGER_QUICK_ACTIONS: readonly ManagerNavItem[] = [
  MANAGER_NEW_ENQUIRY,
  ...MANAGER_NAV_ITEMS.filter((item) => item.href !== "/manager"),
];

/**
 * `/manager` is only active on `/manager` itself; everything else matches its
 * own subtree, so a deep CRM route still highlights its own section.
 */
export function isManagerNavItemActive(
  item: ManagerNavItem,
  pathname: string
): boolean {
  if (item.href === "/manager") {
    return pathname === "/manager";
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
