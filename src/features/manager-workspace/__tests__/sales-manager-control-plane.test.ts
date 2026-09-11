/**
 * The Sales Manager control plane, asserted from the application side.
 *
 * WHAT THIS SUITE IS FOR
 *
 * The database suite (`49_sales_manager_control_plane_test.sql`) owns the
 * question "what may this role do". This one owns the questions the database
 * cannot answer:
 *
 *   - does the NAVIGATION follow the permission, or is a link hard-coded?
 *   - does a signed-in manager land in their own workspace, or on the owner's?
 *   - can a crafted `next` put them on the Super Admin dashboard anyway?
 *   - is the manager landing page still the manager's own dashboard, or has it
 *     quietly become the owner's?
 *
 * The last one matters more than it looks. The role boundary was lost the first
 * time by adding "just one more" surface to the manager, one feature at a time.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  ADMIN_HOME,
  MANAGER_HOME,
  STAFF_WORKSPACE_ROOTS,
  isSafeStaffRedirect,
  resolveLoginDestination,
  resolveStaffHome,
} from "../contracts/manager-home.ts";
import { MANAGER_NAV_ITEMS } from "../contracts/manager-nav.ts";
import { CRM_ROLE_PERMISSIONS } from "../../crm/contracts/permissions.ts";
import { STAFF_ROLE_PERMISSIONS } from "../../staff-admin/contracts/permissions.ts";
import { buildOpsCommandRoutes } from "../../admin-ops/nav-routes.ts";
import type { OpsNavFlags } from "../../admin-ops/types.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** Strips comments: these files DESCRIBE what they refuse to do. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

/**
 * The same idea for SQL, whose comments quote the branches they removed.
 *
 * Both comment forms: the migration explains its design in `/* ... *\/` blocks
 * as well as `--` lines, and a refusal that trips on prose is a refusal that
 * teaches you to write less prose.
 */
const sqlCode = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*/g, "");

const MIGRATION =
  "supabase/migrations/20260906120000_sales_manager_control_plane_hardening.sql";
const MANAGER_PAGE = "src/app/manager/page.tsx";
const MANAGER_LAYOUT = "src/app/manager/layout.tsx";
const MANAGER_ACCESS = "src/features/manager-workspace/server/manager-access.ts";
const ADMIN_PAGE = "src/app/admin/page.tsx";
const SIDEBAR = "src/features/admin-ops/components/AdminSidebar.tsx";
const NAV_ROUTES = "src/features/admin-ops/nav-routes.ts";
const NAV_RESOLVER = "src/features/admin-ops/server/resolve-ops-nav-flags.ts";
const LOGIN_SUBMIT = "src/features/staff-admin/server/staff-login-submit.ts";

function navFlags(overrides: Partial<OpsNavFlags> = {}): OpsNavFlags {
  return {
    crm: false,
    quotations: false,
    projects: false,
    whatsapp: false,
    campaigns: false,
    landingLab: false,
    commerce: false,
    portfolio: false,
    website: false,
    staff: false,
    attendance: false,
    leave: false,
    crmLeads: false,
    crmTargets: false,
    crmReports: false,
    crmImports: false,
    crmAssignmentRules: false,
    crmSlaSettings: false,
    createLead: false,
    createQuotation: false,
    commerceCatalog: false,
    commerceInventory: false,
    commerceSettings: false,
    ...overrides,
  };
}

/* ========================================================================== */
/* 1. Where each role lands                                                    */
/* ========================================================================== */

describe("a signed-in staff member lands in their own workspace", () => {
  test("a Sales Manager goes to the manager workspace", () => {
    assert.equal(
      resolveStaffHome({ isSalesManager: true, isSuperAdmin: false }),
      MANAGER_HOME
    );
  });

  test("the owner goes to the admin dashboard, even holding both roles", () => {
    assert.equal(
      resolveStaffHome({ isSalesManager: false, isSuperAdmin: true }),
      ADMIN_HOME
    );
    /*
     * Super Admin wins deliberately. An account holding both roles is the owner
     * account, and sending it to the manager workspace would hide the business
     * controls it is the only account that has.
     */
    assert.equal(
      resolveStaffHome({ isSalesManager: true, isSuperAdmin: true }),
      ADMIN_HOME
    );
  });

  test("every other staff role keeps the existing destination", () => {
    assert.equal(
      resolveStaffHome({ isSalesManager: false, isSuperAdmin: false }),
      ADMIN_HOME
    );
  });
});

describe("a crafted or stale next cannot put a manager on the owner dashboard", () => {
  const manager = { isSalesManager: true, isSuperAdmin: false } as const;

  test("a bare /admin is treated as the default, not a request", () => {
    assert.equal(resolveLoginDestination("/admin", manager), MANAGER_HOME);
  });

  test("a deeper /admin path the manager works in is preserved", () => {
    // These routes are individually permission-guarded; if the manager is not
    // entitled, that route refuses them on its own terms.
    for (const path of ["/admin/crm/leads", "/admin/quotations", "/admin/leave"]) {
      assert.equal(resolveLoginDestination(path, manager), path);
    }
  });

  test("the owner is unaffected by the same inputs", () => {
    const owner = { isSalesManager: false, isSuperAdmin: true } as const;
    assert.equal(resolveLoginDestination("/admin", owner), ADMIN_HOME);
    assert.equal(resolveLoginDestination("/admin/staff", owner), "/admin/staff");
  });
});

describe("the safe-redirect allowlist", () => {
  test("both staff workspaces are allowed and nothing else is", () => {
    assert.deepEqual([...STAFF_WORKSPACE_ROOTS], ["/admin", "/manager"]);
    for (const path of [
      "/admin",
      "/manager",
      "/admin/crm/leads",
      "/manager/anything",
    ]) {
      assert.equal(isSafeStaffRedirect(path), true, path);
    }
  });

  test("a protocol-relative path is refused", () => {
    /*
     * `/admin//evil.example.com` is resolved by a browser as a URL on ANOTHER
     * ORIGIN. A bare prefix test would hand back an open redirect.
     */
    for (const path of [
      "/admin//evil.example.com",
      "/manager//evil.example.com",
      "//evil.example.com",
      "https://evil.example.com",
      "/adminfoo",
      "/managerial",
      "/",
      "",
      null,
      undefined,
    ]) {
      assert.equal(isSafeStaffRedirect(path), false, String(path));
    }
  });

  test("the Proxy and the server helper share ONE copy of the rule", () => {
    // Two implementations of an allowlist is how one of them ends up looser.
    for (const rel of ["src/lib/supabase/proxy.ts", "src/server/auth/authorize.ts"]) {
      assert.match(read(rel), /isSafeStaffRedirect/, rel);
    }
    // The Proxy still tests `pathname.startsWith("/admin")` to decide WHICH
    // requests it guards — that is routing, not an allowlist. What it must not
    // keep is its own copy of the redirect-target rule.
    assert.doesNotMatch(
      code(read("src/lib/supabase/proxy.ts")),
      /nextParam\s*&&\s*nextParam\.startsWith/,
      "the Proxy must not keep its own safe-next prefix test"
    );
  });
});

describe("the login route resolves the destination by role", () => {
  test("it asks for the role and uses the shared contract", () => {
    const src = code(read(LOGIN_SUBMIT));
    assert.match(src, /has_active_role/);
    assert.match(src, /p_role_code: "sales_manager"/);
    assert.match(src, /p_role_code: "super_admin"/);
    assert.match(src, /resolveLoginDestination/);
    // Both portals resolve it: a manager may hold either identity contract.
    assert.equal(
      (src.match(/resolveStaffLoginDestination\(supabase, safeNext\)/g) ?? []).length,
      2,
      "both the admin and staff success paths must resolve the destination"
    );
  });

  test("the PR #148 native-form contract is untouched", () => {
    // The login form must keep submitting its credentials. This suite changes
    // the DESTINATION, never the transport.
    const form = code(read("src/app/auth/login/login-form.tsx"));
    assert.match(form, /method="post"/);
    assert.match(form, /action="\/auth\/login\/submit"/);
    assert.match(form, /readOnly=\{isPending\}/);
    assert.doesNotMatch(form, /disabled=\{isPending\}[\s\S]*id="identifier"/);
    assert.doesNotMatch(form, /"use server"|useActionState|fetch\(/);
  });
});

/* ========================================================================== */
/* 2. The manager workspace itself                                             */
/* ========================================================================== */

describe("/manager is gated by the Sales Manager role", () => {
  test("the layout guards every route beneath it", () => {
    const layout = code(read(MANAGER_LAYOUT));
    assert.match(layout, /await requireSalesManager\(\)/);
    // A layout that renders is a layout that already proved who is looking.
    assert.match(layout, /export default async function ManagerLayout/);
  });

  test("the page guards itself as well as the layout", () => {
    assert.match(code(read(MANAGER_PAGE)), /await requireSalesManager\(\)/);
  });

  test("the gate asks for the role, and an inactive one cannot pass", () => {
    const access = code(read(MANAGER_ACCESS));
    assert.match(access, /p_role_code: "sales_manager"/);
    assert.match(access, /if \(!isSalesManager\)/);
    assert.match(access, /kind: "denied"/);
    // `has_active_role` resolves through private.has_role, which already
    // requires an active profile and a login that has not been revoked.
    assert.match(access, /has_active_role/);
  });

  test("an unauthenticated visitor returns here after signing in", () => {
    const access = code(read(MANAGER_ACCESS));
    assert.match(access, /\/auth\/login\?portal=staff&next=/);
    assert.match(access, /encodeURIComponent\(MANAGER_HOME\)/);
  });

  test("someone authenticated but not a manager is not bounced to login", () => {
    // They already have a session; sending them back to a form they just
    // satisfied would be a loop, not an answer.
    assert.match(code(read(MANAGER_ACCESS)), /redirect\("\/auth\/forbidden"\)/);
  });
});

describe("the manager landing page is a dedicated manager dashboard, not the owner dashboard", () => {
  const page = read(MANAGER_PAGE);

  /**
   * `ManagerMetricCard` contains `MetricCard`. The manager is entitled to its
   * own card; the question here is whether the OWNER's symbol is used, so the
   * match is anchored on identifier boundaries rather than on a substring.
   */
  const usesIdentifier = (source: string, name: string) =>
    new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`).test(source);

  test("it names the workspace and the role", () => {
    assert.match(page, /ONEDECORE Manager Workspace/);
    assert.match(page, /Sales Manager/);
    assert.match(page, /identity\.displayName/);
  });

  test("it is a dashboard, built from the manager's own snapshot", () => {
    /*
     * The page used to be a list of links, on the argument that a dashboard
     * would be borrowed from the owner. It is a dashboard now — and the way it
     * avoids being the owner's is that its data comes from a manager-specific
     * service composing canonical CRM read models, not from the owner's
     * loader.
     */
    assert.match(page, /loadManagerDashboardSnapshot\(access\)/);
    assert.match(page, /buildManagerKpiStrip\(snapshot\)/);
    for (const component of [
      "ManagerShell",
      "ManagerMetricCard",
      "ManagerAttentionPanel",
      "ManagerSalesPerformance",
      "ManagerTeamWorkload",
      "ManagerProjectStatus",
      "ManagerQuickActions",
    ]) {
      assert.ok(
        page.includes(`<${component}`),
        `the manager dashboard must render its own ${component}`
      );
    }
  });

  test("it borrows NO panel from the Super Admin dashboard", () => {
    /*
     * The Super Admin dashboard's panels are the owner's view of the whole
     * business. Borrowing any of them here would re-create, one panel at a
     * time, exactly the boundary problem this change exists to fix — and
     * "hidden by a prop" is not a boundary.
     */
    for (const owned of [
      "MetricCard",
      "PipelinePanel",
      "NeedsAttentionPanel",
      "ActivityFeed",
      "SourceDonut",
      "RecentLeadsPanel",
      "TargetPanel",
      "loadOpsDashboardSnapshot",
      "OpsKpiItem",
      "AdminShell",
    ]) {
      assert.ok(
        !usesIdentifier(page, owned),
        `the manager page must not render ${owned}`
      );
    }
  });

  test("it links to nothing the role has lost", () => {
    for (const forbidden of [
      "/admin/campaigns",
      "/admin/landing-pages",
      "/admin/portfolio",
      "/admin/commerce",
      "/admin/crm/imports",
      "/admin/staff",
      "/admin/salary",
      "/admin/attendance-policies",
      "/admin/holidays",
      "/admin/crm/settings",
    ]) {
      assert.ok(!page.includes(forbidden), `the manager page must not link ${forbidden}`);
    }
  });

  test("it stays a read surface", () => {
    // A dashboard that grew a mutation would have grown an authority too.
    assert.doesNotMatch(page, /"use server"/);
    assert.doesNotMatch(page, /<form/);
  });

  test("sign-out is the existing ordinary POST, now in the manager top bar", () => {
    const topBar = read(
      "src/features/manager-workspace/components/ManagerTopBar.tsx"
    );
    assert.match(topBar, /method="post"/);
    assert.match(topBar, /action="\/auth\/signout"/);
  });
});

describe("a manager asking for /admin is sent to their own workspace", () => {
  test("the owner dashboard redirects them", () => {
    const src = code(read(ADMIN_PAGE));
    assert.match(src, /resolveManagerAccess\(\)/);
    assert.match(src, /redirect\(MANAGER_HOME\)/);
    // The owner is explicitly excluded from the redirect.
    assert.match(src, /!managerAccess\.access\.isSuperAdmin/);
  });

  test("only the dashboard redirects, not every /admin route", () => {
    /*
     * CRM, quotations, WhatsApp, attendance and leave all live under /admin and
     * the manager legitimately works in them. Blanket-forbidding /admin/* would
     * take away the job along with the dashboard.
     */
    for (const rel of [
      "src/app/admin/layout.tsx",
      "src/app/admin/crm/layout.tsx",
      "src/app/admin/leave/layout.tsx",
    ]) {
      assert.ok(
        !read(rel).includes("MANAGER_HOME"),
        `${rel} must not redirect the manager away`
      );
    }
  });
});

/* ========================================================================== */
/* 3. Navigation follows the permission                                        */
/* ========================================================================== */

describe("Portfolio CMS is permission-derived like everything else", () => {
  test("the command palette offers it only with the flag", () => {
    const withoutPortfolio = buildOpsCommandRoutes(navFlags());
    assert.equal(
      withoutPortfolio.some((route) => route.href === "/admin/portfolio"),
      false,
      "Portfolio CMS was hard-coded for every staff member"
    );

    const withPortfolio = buildOpsCommandRoutes(navFlags({ portfolio: true }));
    assert.equal(
      withPortfolio.some((route) => route.href === "/admin/portfolio"),
      true
    );
  });

  test("the sidebar group is conditional too", () => {
    const sidebar = code(read(SIDEBAR));
    assert.match(sidebar, /if \(flags\.portfolio\)/);
    // The palette and the sidebar must agree, or the palette becomes the way
    // around the sidebar.
    assert.match(code(read(NAV_ROUTES)), /if \(flags\.portfolio\)/);
  });

  test("the flag comes from the same permission the page checks", () => {
    const resolver = code(read(NAV_RESOLVER));
    assert.match(resolver, /portfolio\.manage/);
    assert.match(resolver, /claims\?\.isActive === true/);
    assert.match(
      read("src/app/admin/portfolio/page.tsx"),
      /permissions\.includes\("portfolio\.manage"\)/
    );
  });
});

describe("a manager sees no control plane they no longer hold", () => {
  test("the removed surfaces are all flag-gated already", () => {
    const routes = buildOpsCommandRoutes(navFlags({ crm: true, quotations: true }));
    const hrefs = routes.map((route) => route.href);
    for (const gone of [
      "/admin/campaigns",
      "/admin/landing-pages",
      "/admin/commerce",
      "/admin/crm/imports",
      "/admin/portfolio",
      "/admin/crm/settings/assignment-rules",
    ]) {
      assert.equal(hrefs.includes(gone), false, `${gone} must be permission-gated`);
    }
    // And the sales work the manager keeps is still offered.
    assert.ok(hrefs.includes("/admin/crm/leads"));
    assert.ok(hrefs.includes("/admin/quotations"));
  });
});

/* ========================================================================== */
/* 4. The TypeScript mirrors match the migration                               */
/* ========================================================================== */

describe("the permission mirrors say what the migration says", () => {
  test("the manager lost the owner control plane", () => {
    const manager = CRM_ROLE_PERMISSIONS.sales_manager;
    for (const gone of ["leads.bulk_import", "leads.duplicate_override", "leads.delete"] as const) {
      assert.equal(manager.includes(gone), false, `sales_manager must not hold ${gone}`);
    }
  });

  test("the manager kept the sales job, including CLOSED LOST", () => {
    const manager = CRM_ROLE_PERMISSIONS.sales_manager;
    for (const kept of [
      "leads.read_all",
      "leads.manage",
      "leads.create",
      "leads.assign",
      "leads.transition",
      "crm.notes.manage",
      "crm.follow_ups.manage",
      "crm.reporting.read",
      "sales_targets.read",
      "crm.cadences.manage",
    ] as const) {
      assert.ok(manager.includes(kept), `sales_manager must keep ${kept}`);
    }
    // Sales targets are READ ONLY for this role.
    assert.equal(manager.includes("sales_targets.manage"), false);
  });

  test("Closed Lost and Delete are different authorities", () => {
    // The sales team transitions; only the owner deletes.
    assert.ok(CRM_ROLE_PERMISSIONS.sales_executive.includes("leads.transition"));
    assert.ok(CRM_ROLE_PERMISSIONS.sales_manager.includes("leads.transition"));
    assert.ok(CRM_ROLE_PERMISSIONS.super_admin.includes("leads.delete"));

    for (const role of [
      "sales_manager",
      "sales_executive",
      "management",
      "sales",
      "project_manager",
      "designer",
      "project_operations",
    ] as const) {
      assert.equal(
        CRM_ROLE_PERMISSIONS[role].includes("leads.delete"),
        false,
        `${role} may not delete an enquiry`
      );
    }
  });

  test("the legacy management role lost bulk import too", () => {
    assert.equal(CRM_ROLE_PERMISSIONS.management.includes("leads.bulk_import"), false);
  });

  test("the workforce mirror is self and direct reports only", () => {
    const manager = STAFF_ROLE_PERMISSIONS.sales_manager;
    assert.deepEqual(
      [...manager].sort(),
      [
        "attendance.self",
        "attendance.team.read",
        "leave.self",
        "leave.team.approve",
        "staff.read",
      ].sort()
    );
    for (const gone of [
      "staff.manage",
      "staff.credentials.manage",
      "attendance.read.all",
      "attendance.correct.all",
      "attendance.correct.team",
      "attendance.policies.manage",
      "leave.manage",
      "holidays.manage",
    ] as const) {
      assert.equal(manager.includes(gone), false, `sales_manager must not hold ${gone}`);
    }
  });
});

describe("the migration removes what it says it removes", () => {
  const sql = read(MIGRATION);

  test("it is forward-only and edits no applied migration", () => {
    assert.match(sql, /^-- ONEDECORE — Sales Manager control plane hardening/);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /drop function/i);
    // `create or replace` throughout, so no grant is silently taken away.
    assert.match(sql, /create or replace function/);
  });

  test("it does NOT widen any row policy to carry high-level status", () => {
    /*
     * An earlier draft added a `projects.read_high_level` branch to
     * `private.project_can_view`. RLS is ROW-level: a branch named "high level"
     * inside a full-table policy grants the whole row — every column of
     * `projects`, and the entire history in `project_manager_assignments`.
     *
     * The manager loses those tables by losing `projects.read`, which every
     * branch of that predicate is keyed on, and the predicate is left alone.
     */
    // Comments stripped: this section EXPLAINS the predicate it deliberately
    // leaves alone, and naming a table in prose is not touching it.
    const executable = sqlCode(sql);
    assert.doesNotMatch(executable, /create or replace function private\.project_can_view\b/);
    assert.doesNotMatch(executable, /create policy/i);
    assert.doesNotMatch(executable, /project_events/);
    assert.doesNotMatch(executable, /project_manager_assignments/);
  });

  test("every revoked code is named", () => {
    const revocation = sql.slice(
      sql.indexOf("r.code = 'sales_manager'"),
      sql.indexOf("-- D. Revocation")
    );
    for (const gone of [
      "campaigns.read",
      "campaigns.draft",
      "campaigns.request_approval",
      "campaigns.approve",
      "campaigns.execute",
      "campaigns.pause",
      "campaigns.metrics.read",
      "marketing_consents.manage",
      "landing_pages.read",
      "landing_pages.manage",
      "landing_pages.publish",
      "landing_experiments.manage",
      "landing_analytics.read",
      "leads.bulk_import",
      "leads.duplicate_override",
      "commerce.read",
      "commerce.orders.manage",
      "commerce.payments.read",
      "commerce.catalog.manage",
      "commerce.inventory.manage",
      "commerce.settings.manage",
      "projects.read",
      "projects.assign_pm",
      "project_design.read",
      "project_design.staff",
      "project_execution.read",
      "project_execution.cancel",
    ]) {
      assert.match(revocation, new RegExp(`'${gone.replace(/\./g, "\\.")}'`), gone);
    }
  });

  test("leads.transition is never revoked", () => {
    // Closed Lost is the sales team's, and this migration must not take it.
    assert.doesNotMatch(sql, /'leads\.transition'/);
  });

  test("leads.delete is granted to super_admin and to no one else", () => {
    const grant = sql.slice(sql.indexOf("-- B. Grants"), sql.indexOf("-- C. Revocations"));
    assert.match(grant, /r\.code = 'super_admin'\s*\n\s*and p\.code = 'leads\.delete'/);
    for (const role of ["sales_manager", "sales_executive", "management"]) {
      assert.doesNotMatch(
        grant,
        new RegExp(`'${role}'[\\s\\S]{0,120}'leads\\.delete'`),
        `${role} must not appear near the leads.delete grant`
      );
    }
  });

  test("the staff directories are gated by permission, not by role", () => {
    // Comments stripped: this section EXPLAINS the role branch it removed.
    const directories = sqlCode(sql.slice(sql.indexOf("-- F. Staff directories")));
    assert.doesNotMatch(directories, /has_role\('sales_manager'\)/);
    assert.match(directories, /authorize\('projects\.assign_pm'\)/);
    assert.match(directories, /authorize\('project_design\.staff'\)/);
  });

  test("high-level status is a read model with an ENUMERATED field set", () => {
    assert.match(sql, /create or replace function public\.list_project_high_level_status\(\)/);
    assert.match(sql, /create or replace function public\.get_project_high_level_status\(p_project_id uuid\)/);

    const model = sqlCode(
      sql.slice(sql.indexOf("-- E. Project visibility"), sql.indexOf("-- F. Staff"))
    );

    // Authority is the permission, checked in both entry points, with no role
    // list beside it to drift out of step.
    assert.equal(
      (model.match(/authorize\('projects\.read_high_level'\)/g) ?? []).length,
      2,
      "both entry points must check the permission"
    );
    assert.ok(
      !sqlCode(model).includes("has_role("),
      "the read model must not carry a role list next to the permission"
    );

    // Every field the manager may see, named one at a time. `select *` or a row
    // type would widen this silently the next time a column is added.
    for (const field of [
      "project_id",
      "project_number",
      "status",
      "client_display_name",
      "quotation_number",
      "commercial_grand_total_paise",
      "current_project_manager",
      "current_lead_designer",
      "handover_accepted_at",
      "design_state",
      "execution_state",
      "execution_initialization_status",
    ]) {
      assert.match(model, new RegExp(`'${field}'`), field);
    }
    assert.doesNotMatch(model, /select \*/);
    assert.doesNotMatch(model, /%rowtype/);

    // And what it must never reach.
    for (const forbidden of [
      "project_events",
      "project_manager_assignments",
      "project_design_evidence",
      "project_design_deliverable_versions",
      "project_execution_evidence",
      "snag",
    ]) {
      assert.ok(
        !model.includes(forbidden),
        `the high-level read model must not touch ${forbidden}`
      );
    }
  });

  test("it applies no managed write and adds no delete path", () => {
    assert.doesNotMatch(sql, /delete from public\.leads/i);
    assert.doesNotMatch(sql, /deleted_at/i);
    assert.doesNotMatch(sql, /service_role/i);
  });
});

/* ========================================================================== */
/* 5. The project routes, which are where the boundary is actually felt        */
/* ========================================================================== */

const PROJECT_LIST_PAGE = "src/app/admin/projects/page.tsx";
const PROJECT_DETAIL_PAGE = "src/app/admin/projects/[projectId]/page.tsx";
const HIGH_LEVEL_QUERIES = "src/features/projects/server/project-high-level-queries.ts";
const HIGH_LEVEL_CARD =
  "src/features/projects/components/high-level/ProjectHighLevelStatusCard.tsx";

describe("the project list page serves the manager its own read model", () => {
  const page = read(PROJECT_LIST_PAGE);

  test("a high-level-only caller is allowed in", () => {
    /*
     * Both routes previously denied unless `canReadProjects || canReadDesign`,
     * so a Sales Manager who followed the Projects link — which the nav now
     * shows them — landed on /auth/forbidden.
     */
    assert.match(page, /permissions\.canReadProjectsHighLevel/);
    const branch = page.slice(page.indexOf("const highLevelOnly"));
    assert.match(branch, /!permissions\.canReadProjects/);
    assert.match(branch, /!permissions\.canReadDesign/);
  });

  test("the manager branch returns BEFORE any operational query runs", () => {
    const branchAt = page.indexOf("if (highLevelOnly)");
    const listProjectsAt = page.indexOf("await listProjects()");
    const pendingAt = page.indexOf("listPendingProjectMaterializations()");
    assert.ok(branchAt > 0, "the manager branch must exist");
    assert.ok(branchAt < listProjectsAt, "the branch must precede listProjects");
    assert.ok(branchAt < pendingAt, "the branch must precede the repair queue");
    assert.match(page, /await listProjectHighLevelStatus\(\)/);
  });

  test("the manager is not a project repair operator", () => {
    /*
     * Repairing a stuck Closed-Won materialisation was gated on
     * `isSuperAdmin || isSalesManager`. That made the manager a repair
     * operator, which was never the role.
     */
    assert.doesNotMatch(code(page), /isSuperAdmin \|\| permissions\.isSalesManager/);
    assert.doesNotMatch(code(page), /permissions\.isSalesManager/);
    const managerBranch = page.slice(
      page.indexOf("if (highLevelOnly)"),
      page.indexOf("if (!permissions.canReadProjects")
    );
    for (const forbidden of [
      "ProjectMaterializationRepairQueue",
      "listPendingProjectMaterializations",
      "listProjects(",
    ]) {
      assert.ok(
        !managerBranch.includes(forbidden),
        `the manager branch must not use ${forbidden}`
      );
    }
  });

  test("the owner keeps the repair queue", () => {
    assert.match(page, /permissions\.isSuperAdmin\s*\?\s*\n?\s*await listPendingProjectMaterializations/);
    assert.match(page, /<ProjectMaterializationRepairQueue/);
  });
});

describe("the project detail page branches before the workspace is built", () => {
  const page = read(PROJECT_DETAIL_PAGE);

  test("the manager branch is explicit and comes first", () => {
    const branchAt = page.indexOf("if (managerHighLevelOnly)");
    assert.ok(branchAt > 0, "an explicit manager branch must exist");
    assert.match(page, /await getProjectHighLevelStatus\(projectId\)/);
    assert.match(page, /<ProjectHighLevelStatusCard/);

    for (const operational of [
      "getProjectHandoverDetail(projectId)",
      "listAssignableProjectManagers()",
      "getProjectDesignWorkspace(",
      "getProjectExecutionWorkspace(",
      "buildHandoverDisplayModel(",
    ]) {
      const at = page.indexOf(operational);
      assert.ok(at > branchAt, `${operational} must run AFTER the manager branch`);
    }
  });

  test("the manager branch reads nothing operational", () => {
    const managerBranch = page.slice(
      page.indexOf("if (managerHighLevelOnly)"),
      page.indexOf("if (!permissions.canReadProjects")
    );
    for (const forbidden of [
      "getProjectHandoverDetail",
      "listAssignableProjectManagers",
      "getProjectDesignWorkspace",
      "getProjectExecutionWorkspace",
      "ProjectHandoverWorkspace",
      "ProjectDesignWorkspace",
      "LiveProjectExecutionWorkspace",
      "detail.assignments",
      "detail.events",
    ]) {
      assert.ok(
        !managerBranch.includes(forbidden),
        `the manager branch must not touch ${forbidden}`
      );
    }
  });

  test("the broad roles keep the workspace they have today", () => {
    // Unchanged below the branch: the owner, the assigned PM, the assigned
    // designer and the credited sales executive all render exactly as before.
    assert.match(page, /<ProjectHandoverWorkspace/);
    assert.match(page, /<ProjectDesignWorkspace/);
    assert.match(page, /<LiveProjectExecutionWorkspace/);
    assert.match(page, /const highLevelOnly = role === "sales_executive"/);
  });
});

describe("the high-level read model carries no authority of its own", () => {
  test("it calls the RPC and maps an explicit field list", () => {
    const src = read(HIGH_LEVEL_QUERIES);
    assert.match(src, /rpc\("list_project_high_level_status"\)/);
    assert.match(src, /rpc\("get_project_high_level_status"/);
    // No service role, and no second permission check to drift from the RPC's.
    assert.doesNotMatch(src, /service_role|createAdminClient/);
    assert.doesNotMatch(code(src), /authorize\(/);
  });

  test("the status card renders no control at all", () => {
    const card = code(read(HIGH_LEVEL_CARD));
    for (const control of [
      "<button",
      "<form",
      "onClick",
      "action=",
      "canAssign",
      "canCancel",
      "canStaff",
      "useState",
    ]) {
      assert.ok(!card.includes(control), `the status card must not contain ${control}`);
    }
  });
});

describe("the manager home offers Project Status", () => {
  test("it links the status page and nothing operational", () => {
    /*
     * The links used to live in an array on the page itself. They live in the
     * navigation contract now — the dashboard, the sidebar and the quick
     * actions all read the same list — so the question is asked of the list.
     */
    const hrefs = MANAGER_NAV_ITEMS.map((item) => item.href);
    assert.ok(hrefs.includes("/admin/projects"));
    assert.ok(
      MANAGER_NAV_ITEMS.some((item) => item.label === "Project Status"),
      "the manager is offered project STATUS, not the project workspace"
    );
    assert.deepEqual(
      hrefs.filter((href) => href.startsWith("/admin/projects")),
      ["/admin/projects"],
      "the only project link is the status list"
    );
    for (const href of hrefs) {
      assert.ok(
        !/repair|assign|cancel|staff|execution/i.test(href),
        `the manager home must not link ${href}`
      );
    }
  });
});
