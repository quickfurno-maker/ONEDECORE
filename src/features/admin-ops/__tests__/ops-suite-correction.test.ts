import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { buildLeadListHref, PIPELINE_STAGE_PREVIEW_SIZE } from "../../crm/contracts/lead-list-query.ts";
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
    createLead: true,
    createQuotation: false,
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

  test("pipeline toggle URL drops status while preserving other filters", () => {
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
      "pipeline"
    );
    assert.match(href, /view=pipeline/);
    assert.doesNotMatch(href, /status=new/);
    assert.match(href, /q=rahul/);
    assert.match(href, /followUpDue=overdue/);
    assert.match(href, /assignment=unassigned/);
  });

  test("pipeline stage totals are not derived from the 50-row page", () => {
    const leadsPage = readFileSync(
      join(root, "src/app/admin/crm/leads/page.tsx"),
      "utf8"
    );
    const board = readFileSync(
      join(root, "src/features/crm/components/leads/LeadPipelineBoard.tsx"),
      "utf8"
    );
    assert.match(leadsPage, /countLeadListForCurrentUser/);
    assert.match(leadsPage, /PIPELINE_STAGE_PREVIEW_SIZE/);
    assert.doesNotMatch(leadsPage, /pageSize: 50/);
    assert.match(board, /stage\.total/);
    assert.match(board, /View all/);
    assert.equal(PIPELINE_STAGE_PREVIEW_SIZE < 50, true);
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
});
