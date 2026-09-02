import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildLeadListHref } from "../../crm/contracts/lead-list-query.ts";
import { buildOpsCommandRoutes } from "../nav-routes.ts";
import type { OpsNavFlags } from "../types.ts";

const root = process.cwd();

function flags(overrides: Partial<OpsNavFlags> = {}): OpsNavFlags {
  return {
    crm: true,
    quotations: false,
    projects: false,
    whatsapp: false,
    campaigns: false,
    landingLab: false,
    commerce: false,
    staff: false,
    attendance: false,
    leave: false,
    crmLeads: true,
    crmTargets: false,
    crmReports: false,
    crmImports: false,
    crmAssignmentRules: false,
    crmSlaSettings: false,
    createLead: true,
    createQuotation: false,
    commerceCatalog: false,
    commerceInventory: false,
    commerceSettings: false,
    ...overrides,
  };
}

describe("Operations Suite correction contracts", () => {
  test("quotations nav is gated by quotations.read, not CRM read", () => {
    const resolver = readFileSync(
      join(root, "src/features/admin-ops/server/resolve-ops-nav-flags.ts"),
      "utf8"
    );
    const layout = readFileSync(join(root, "src/app/admin/layout.tsx"), "utf8");
    const dashboard = readFileSync(
      join(root, "src/features/admin-ops/server/dashboard-snapshot.ts"),
      "utf8"
    );
    const snapshotFn = readFileSync(
      join(root, "src/app/admin/page.tsx"),
      "utf8"
    );
    const overview = readFileSync(join(root, "src/app/admin/crm/page.tsx"), "utf8");
    const quick = readFileSync(
      join(root, "src/features/admin-ops/components/QuickActionsMenu.tsx"),
      "utf8"
    );

    assert.match(resolver, /quotations: quotationPermissions\.canReadQuotations/);
    assert.doesNotMatch(layout, /quotations:\s*showCrmLink/);
    assert.doesNotMatch(snapshotFn, /quotations:\s*showCrmLink/);
    assert.match(dashboard, /if \(flags\.quotations\)/);
    assert.match(dashboard, /listLeadQuotations/);
    assert.match(dashboard, /quotationAccess\.quotations/);
    assert.match(overview, /quotations: flags\.quotations/);
    assert.match(quick, /flags\.quotations/);

    const withoutQuotes = buildOpsCommandRoutes(flags({ crm: true, quotations: false }));
    assert.equal(
      withoutQuotes.some((route) => route.href === "/admin/quotations"),
      false
    );
    const withQuotes = buildOpsCommandRoutes(flags({ crm: true, quotations: true }));
    assert.equal(
      withQuotes.some((route) => route.href === "/admin/quotations"),
      true
    );
  });

  test("lead list URL clears one filter while preserving the others", () => {
    const href = buildLeadListHref(
      {
        q: "rahul",
        status: "new",
        sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        assignment: "unassigned",
        assigneeId: null,
        followUpDue: "overdue",
        page: 1,
        pageSize: 25,
      },
      "status"
    );
    assert.doesNotMatch(href, /status=new/);
    assert.match(href, /q=rahul/);
    assert.match(href, /followUpDue=overdue/);
    assert.match(href, /assignment=unassigned/);
  });

  // CRM 2B cutover: the board moved to /admin/crm/pipeline and the Leads page
  // keeps no second pipeline implementation.
  test("leads page links to the dedicated pipeline instead of previewing one", () => {
    const leadsPage = readFileSync(
      join(root, "src/app/admin/crm/leads/page.tsx"),
      "utf8"
    );
    assert.match(leadsPage, /\/admin\/crm\/pipeline/);
    assert.doesNotMatch(leadsPage, /LeadPipelineBoard/);
    assert.doesNotMatch(leadsPage, /view=pipeline/);
    assert.doesNotMatch(leadsPage, /pageSize: 50/);
    assert.equal(
      existsSync(
        join(root, "src/features/crm/components/leads/LeadPipelineBoard.tsx")
      ),
      false
    );
  });

  test("lead filter controls expose accessible names", () => {
    const src = readFileSync(
      join(root, "src/features/crm/components/leads/LeadListFilters.tsx"),
      "utf8"
    );
    assert.match(src, /aria-label="Search leads"/);
    assert.match(src, /aria-label="Filter by status"/);
    assert.match(src, /aria-label="Filter by source"/);
    assert.match(src, /aria-label="Filter by assignment"/);
    assert.match(src, /aria-label="Filter by assignee"/);
    assert.match(src, /aria-label="Filter by follow-up due"/);
  });

  test("command palette implements a focus trap", () => {
    const src = readFileSync(
      join(root, "src/features/admin-ops/components/CommandPalette.tsx"),
      "utf8"
    );
    assert.match(src, /aria-modal="true"/);
    assert.match(src, /returnFocusRef/);
    assert.match(src, /event\.key === "Tab"/);
    assert.match(src, /querySelectorAll/);
  });

  test("sidebar uses semantic icons and a single CRM parent", () => {
    const sidebar = readFileSync(
      join(root, "src/features/admin-ops/components/AdminSidebar.tsx"),
      "utf8"
    );
    const metric = readFileSync(
      join(root, "src/features/admin-ops/components/MetricCard.tsx"),
      "utf8"
    );
    assert.match(sidebar, /OpsIcon/);
    assert.doesNotMatch(sidebar, /crm-nested/);
    assert.doesNotMatch(sidebar, /label\.slice\(0, 1\)/);
    assert.doesNotMatch(metric, /label\.slice\(0, 1\)/);
    assert.match(metric, /iconForKpi/);
  });

  test("My Day is exposed in both CRM navigation surfaces", () => {
    const sidebar = readFileSync(
      join(root, "src/features/admin-ops/components/AdminSidebar.tsx"),
      "utf8"
    );
    const crmNav = readFileSync(
      join(root, "src/features/crm/components/shell/CrmNav.tsx"),
      "utf8"
    );

    assert.match(
      sidebar,
      /href: "\/admin\/crm\/my-day", label: "My Day", icon: "clock"/
    );
    assert.match(
      crmNav,
      /href: "\/admin\/crm\/my-day", label: "My Day"/
    );
  });
  test("does not add fake order or payment routes", () => {
    const routes = readFileSync(join(root, "src/features/admin-ops/nav-routes.ts"), "utf8");
    const sidebar = readFileSync(
      join(root, "src/features/admin-ops/components/AdminSidebar.tsx"),
      "utf8"
    );
    assert.doesNotMatch(routes, /\/admin\/orders/);
    assert.doesNotMatch(routes, /\/admin\/payments/);
    assert.doesNotMatch(sidebar, /\/admin\/orders/);
    assert.doesNotMatch(sidebar, /Record Payment/);
  });

  test("dashboard does not duplicate Quick Actions; top bar remains canonical", () => {
    const page = readFileSync(join(root, "src/app/admin/page.tsx"), "utf8");
    const topBar = readFileSync(
      join(root, "src/features/admin-ops/components/AdminTopBar.tsx"),
      "utf8"
    );
    assert.match(topBar, /import \{ QuickActionsMenu \} from "\.\/QuickActionsMenu\.tsx"/);
    assert.match(topBar, /<QuickActionsMenu flags=\{flags\} \/>/);
    assert.doesNotMatch(page, /QuickActionsMenu/);
    assert.match(page, /flags\.createLead/);
    assert.match(page, /\+ New Lead/);
    assert.match(page, /href="\/admin\/crm\/leads\/new"/);
  });
});
