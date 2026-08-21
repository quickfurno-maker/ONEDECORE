import type { OpsCommandRoute, OpsNavFlags } from "./types.ts";

export function buildOpsCommandRoutes(flags: OpsNavFlags): readonly OpsCommandRoute[] {
  const routes: OpsCommandRoute[] = [
    { href: "/admin", label: "Dashboard", group: "Overview" },
    { href: "/admin/portfolio", label: "Portfolio CMS", group: "Content" },
  ];

  if (flags.crm) {
    routes.push({ href: "/admin/crm", label: "CRM Overview", group: "Sales & CRM" });
    routes.push({ href: "/admin/crm/leads", label: "Leads", group: "Sales & CRM" });
  }
  if (flags.crmTargets) {
    routes.push({ href: "/admin/crm/targets", label: "Sales Targets", group: "Sales & CRM" });
  }
  if (flags.crmReports) {
    routes.push({ href: "/admin/crm/reports", label: "Reports", group: "Sales & CRM" });
  }
  if (flags.crmImports) {
    routes.push({ href: "/admin/crm/imports", label: "Imports", group: "Sales & CRM" });
  }
  if (flags.crmAssignmentRules) {
    routes.push({
      href: "/admin/crm/settings/assignment-rules",
      label: "Assignment Rules",
      group: "Sales & CRM",
    });
  }
  if (flags.quotations) {
    routes.push({ href: "/admin/quotations", label: "Quotations", group: "Sales & CRM" });
  }
  if (flags.projects) {
    routes.push({ href: "/admin/projects", label: "Projects", group: "Sales & CRM" });
  }
  if (flags.whatsapp) {
    routes.push({ href: "/admin/whatsapp/inbox", label: "WhatsApp Inbox", group: "Communication" });
  }
  if (flags.campaigns) {
    routes.push({ href: "/admin/campaigns", label: "Campaigns", group: "Marketing" });
  }
  if (flags.landingLab) {
    routes.push({ href: "/admin/landing-pages", label: "Landing Lab", group: "Marketing" });
  }
  if (flags.commerce) {
    routes.push({ href: "/admin/commerce", label: "Commerce Overview", group: "Commerce" });
    routes.push({ href: "/admin/commerce/products", label: "Products", group: "Commerce" });
    routes.push({ href: "/admin/commerce/categories", label: "Categories", group: "Commerce" });
    routes.push({ href: "/admin/commerce/settings", label: "Commerce Settings", group: "Commerce" });
  }
  if (flags.staff) {
    routes.push({ href: "/admin/staff", label: "Staff", group: "People" });
  }
  if (flags.attendance) {
    routes.push({ href: "/admin/attendance", label: "Attendance", group: "People" });
  }
  if (flags.leave) {
    routes.push({ href: "/admin/leave", label: "Leave", group: "People" });
  }

  return routes;
}
