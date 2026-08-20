export type OpsIconName =
  | "dashboard"
  | "crm"
  | "leads"
  | "targets"
  | "reports"
  | "imports"
  | "rules"
  | "quotations"
  | "projects"
  | "whatsapp"
  | "campaigns"
  | "landing"
  | "commerce"
  | "products"
  | "categories"
  | "settings"
  | "portfolio"
  | "staff"
  | "attendance"
  | "leave"
  | "search"
  | "spark"
  | "menu"
  | "collapse"
  | "expand"
  | "chevron"
  | "users"
  | "opportunity"
  | "document"
  | "briefcase"
  | "message"
  | "goal"
  | "alert"
  | "clock";

const PATHS: Record<OpsIconName, string> = {
  dashboard:
    "M4 4h6v8H4V4zm10 0h6v5h-6V4zM4 14h6v6H4v-6zm10 7v-9h6v9h-6z",
  crm: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 8a8 8 0 0 1 16 0",
  leads:
    "M8 10a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm11-1h-4m2-2v4M3 20a5 5 0 0 1 10 0M16 20a4 4 0 0 1 5 0",
  targets: "M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9zm0-5a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0-3v0",
  reports: "M4 19V5h12l4 4v10H4zm12-14v4h4M8 11h8M8 15h5",
  imports: "M12 4v10m0 0 4-4m-4 4-4-4M5 20h14",
  rules: "M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01",
  quotations: "M7 3h8l5 5v13H7V3zm8 0v5h5M9 13h6M9 17h4",
  projects: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-12 0h16v12H4V7z",
  whatsapp:
    "M5 19l1.5-4A8 8 0 1 1 12 20a8.2 8.2 0 0 1-3.2-.6L5 19zm4.2-8.2c.2 1.8 2.4 3.6 2.6 3.7",
  campaigns: "M4 10v4h3l5 4V6L7 10H4zm13 1a3 3 0 0 1 0 2m2-4a6 6 0 0 1 0 6",
  landing: "M4 20h16M7 20V8l5-4 5 4v12",
  commerce: "M4 7h16l-1.5 11H5.5L4 7zm4-3h8l1 3H7l1-3z",
  products: "M4 8l8-4 8 4v8l-8 4-8-4V8zm8 4v8m0-8L4 8m8 4 8-4",
  categories: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z",
  settings:
    "M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm8 4c0-.3 0-.7-.1-1l2-1.5-2-3.5-2.4.5a8 8 0 0 0-1.7-1L13.4 2h-2.8L10.2 4.5a8 8 0 0 0-1.7 1L6.1 5l-2 3.5L6.1 10A8 8 0 0 0 6 12c0 .3 0 .7.1 1l-2 1.5 2 3.5 2.4-.5a8 8 0 0 0 1.7 1L10.6 22h2.8l.4-2.5a8 8 0 0 0 1.7-1l2.4.5 2-3.5-2-1.5c.1-.3.1-.7.1-1z",
  portfolio: "M4 8h16v11H4V8zm4-3h8v3H8V5z",
  staff: "M12 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM5 20a7 7 0 0 1 14 0",
  attendance: "M8 3v3M16 3v3M5 8h14M6 5h12v15H6V5zm3 7h6M9 16h4",
  leave: "M8 3v3M16 3v3M5 8h14M6 5h12v15H6V5zm4 6 2 2 4-4",
  search: "M11 18a7 7 0 1 1 7-7 7 7 0 0 1-7 7zm10 3-4.3-4.3",
  spark: "M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z",
  menu: "M5 7h14M5 12h14M5 17h14",
  collapse: "M14 6l-6 6 6 6",
  expand: "M10 6l6 6-6 6",
  chevron: "M9 6l6 6-6 6",
  users:
    "M8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm10-1a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM3 20a5 5 0 0 1 10 0m6 0a5 5 0 0 0-4-4.9",
  opportunity: "M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9zm0 0V12l5-3",
  document: "M7 3h8l5 5v13H7V3zm8 0v5h5M9 13h6M9 17h4",
  briefcase: "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-12 0h16v12H4V7zm0 4h16",
  message: "M5 6h14v10H8l-3 3V6z",
  goal: "M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9zm0-12v4l3 2",
  alert: "M12 9v4m0 4h.01M10.3 4.7 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.7a2 2 0 0 0-3.4 0z",
  clock: "M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9zm0-13v5l3 2",
};

export function OpsIcon({
  name,
  className = "h-5 w-5",
}: {
  readonly name: OpsIconName;
  readonly className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function iconForHref(href: string): OpsIconName {
  if (href === "/admin") return "dashboard";
  if (href === "/admin/crm") return "crm";
  if (href.startsWith("/admin/crm/leads")) return "leads";
  if (href.startsWith("/admin/crm/targets")) return "targets";
  if (href.startsWith("/admin/crm/reports")) return "reports";
  if (href.startsWith("/admin/crm/imports")) return "imports";
  if (href.includes("assignment-rules")) return "rules";
  if (href.startsWith("/admin/quotations")) return "quotations";
  if (href.startsWith("/admin/projects")) return "projects";
  if (href.startsWith("/admin/whatsapp")) return "whatsapp";
  if (href.startsWith("/admin/campaigns")) return "campaigns";
  if (href.startsWith("/admin/landing-pages")) return "landing";
  if (href === "/admin/commerce") return "commerce";
  if (href.includes("/products")) return "products";
  if (href.includes("/categories")) return "categories";
  if (href.includes("/settings")) return "settings";
  if (href.startsWith("/admin/portfolio")) return "portfolio";
  if (href.startsWith("/admin/staff")) return "staff";
  if (href.startsWith("/admin/attendance")) return "attendance";
  if (href.startsWith("/admin/leave")) return "leave";
  return "dashboard";
}

export function iconForKpi(id: string): OpsIconName {
  if (id === "new-leads") return "users";
  if (id === "open") return "opportunity";
  if (id === "quotations") return "document";
  if (id === "projects") return "briefcase";
  if (id === "whatsapp") return "message";
  if (id === "target") return "goal";
  return "dashboard";
}
