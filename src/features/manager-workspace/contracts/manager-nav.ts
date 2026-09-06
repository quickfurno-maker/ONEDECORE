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
 * So the manager's workspace has its OWN list. Every destination here is a
 * surface the role is already authorised for, and each of those routes still
 * enforces its own permission when opened: this list decides what is offered,
 * never what is allowed.
 */

export interface ManagerNavItem {
  readonly href: string;
  readonly label: string;
  readonly detail: string;
}

export const MANAGER_NAV_ITEMS: readonly ManagerNavItem[] = [
  {
    href: "/manager",
    label: "Dashboard",
    detail: "Today's sales position for your team.",
  },
  {
    href: "/admin/crm/leads",
    label: "Enquiries",
    detail: "Work the sales pipeline, assign enquiries and record follow-ups.",
  },
  {
    href: "/admin/quotations",
    label: "Quotations",
    detail: "Prepare, finalise and send customer quotations.",
  },
  {
    href: "/admin/whatsapp/inbox",
    label: "WhatsApp Inbox",
    detail: "Reply to customers and route conversations across the team.",
  },
  {
    href: "/admin/crm/reports",
    label: "Reports",
    detail: "Sales reporting and targets for your team.",
  },
  {
    // Status only. Execution is the assigned Project Manager's, and the page
    // this points at serves the manager a dedicated read model rather than the
    // project workspace.
    href: "/admin/projects",
    label: "Project Status",
    detail: "Where each live project has reached, and who is running it.",
  },
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
];

/** The subset offered as buttons under the dashboard itself. */
export const MANAGER_QUICK_ACTIONS: readonly ManagerNavItem[] =
  MANAGER_NAV_ITEMS.filter((item) => item.href !== "/manager");

/**
 * `/manager` is only active on `/manager` itself; everything else matches its
 * own subtree, so a deep CRM route still highlights Enquiries.
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
