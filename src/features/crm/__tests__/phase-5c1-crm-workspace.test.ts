/**
 * Phase 5C1 — premium CRM shell and read-only lead workspace tests.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  CRM_LEAD_LIST_FORBIDDEN_FIELDS,
  CRM_LEAD_LIST_ITEM_PUBLIC_KEYS,
  mapLeadRowToListItem,
  type CrmLeadListRow,
} from "../contracts/lead-dtos.ts";
import {
  escapeIlikePattern,
  buildLeadTextSearchOrFilter,
  LEAD_LIST_MAX_PAGE_SIZE,
  LEAD_LIST_MAX_SEARCH_LENGTH,
  parseLeadListQuery,
} from "../contracts/lead-list-query.ts";
import { hasCrmLeadReadAccess } from "../contracts/crm-access.ts";
import { CRM_ROLE_PERMISSIONS } from "../contracts/permissions.ts";

const root = process.cwd();

function sampleLeadRow(overrides: Partial<CrmLeadListRow> = {}): CrmLeadListRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "new",
    submitted_name: "Test Lead",
    service_code: "complete-home-interiors",
    locality: "Koregaon Park",
    assigned_to: null,
    entry_method: "public_form",
    primary_source_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    lead_sources: { display_name: "Website" },
    created_at: "2026-07-30T10:00:00.000Z",
    updated_at: "2026-07-30T10:00:00.000Z",
    ...overrides,
  };
}

function fileExists(relativePath: string): boolean {
  try {
    return statSync(join(root, relativePath)).isFile();
  } catch {
    return false;
  }
}

describe("Phase 5C1 migration and contracts", () => {
  test("migration 12 exists and grants admin.access to canonical sales roles", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260731120000_crm_workspace_access_foundation.sql"
      ),
      "utf8"
    );

    assert.match(migration, /sales_manager/);
    assert.match(migration, /sales_executive/);
    assert.match(migration, /admin\.access/);
    assert.match(migration, /list_crm_assignable_executives/);
    assert.match(migration, /crm_has_broad_lead_read/);
    assert.doesNotMatch(migration, /project_manager/);
    assert.doesNotMatch(migration, /designer/);
  });

  test("pgTAP test 06 exists", () => {
    assert.ok(
      fileExists("supabase/tests/database/06_crm_workspace_access_foundation_test.sql")
    );
  });
});

describe("Phase 5C1 CRM authorization contracts", () => {
  test("super_admin, sales_manager, and sales_executive have CRM read paths", () => {
    assert.ok(CRM_ROLE_PERMISSIONS.super_admin.includes("leads.read_all"));
    assert.ok(CRM_ROLE_PERMISSIONS.sales_manager.includes("leads.read_all"));
    assert.ok(CRM_ROLE_PERMISSIONS.sales_executive.includes("leads.read_assigned"));
  });

  test("project_manager and designer remain without CRM read grants", () => {
    assert.deepEqual(CRM_ROLE_PERMISSIONS.project_manager, []);
    assert.deepEqual(CRM_ROLE_PERMISSIONS.designer, []);
  });

  test("CRM access context distinguishes broad and assigned scopes", () => {
    assert.equal(
      hasCrmLeadReadAccess({
        userId: "u1",
        email: null,
        canReadBroad: true,
        canReadAssigned: false,
        canReadSources: true,
        canReadActivities: true,
        canReadConsents: true,
        canAssignLeads: false,
        canCreateLeads: false,
        canOverrideLeadDuplicate: false,
        canManageLeadSources: false,
      }),
      true
    );
    assert.equal(
      hasCrmLeadReadAccess({
        userId: "u2",
        email: null,
        canReadBroad: false,
        canReadAssigned: true,
        canReadSources: true,
        canReadActivities: true,
        canReadConsents: true,
        canAssignLeads: false,
        canCreateLeads: false,
        canOverrideLeadDuplicate: false,
        canManageLeadSources: false,
      }),
      true
    );
    assert.equal(
      hasCrmLeadReadAccess({
        userId: "u3",
        email: null,
        canReadBroad: false,
        canReadAssigned: false,
        canReadSources: false,
        canReadActivities: false,
        canReadConsents: false,
        canAssignLeads: false,
        canCreateLeads: false,
        canOverrideLeadDuplicate: false,
        canManageLeadSources: false,
      }),
      false
    );
  });

  test("claims helper probes CRM permissions", () => {
    const claimsSrc = readFileSync(join(root, "src/server/auth/claims.ts"), "utf8");
    assert.match(claimsSrc, /leads\.read_all/);
    assert.match(claimsSrc, /leads\.read_assigned/);
    assert.match(claimsSrc, /sources\.read/);
    assert.match(claimsSrc, /crm\.activities\.read/);
  });

  test("crm-auth uses getStaffClaims aligned session path", () => {
    const authSrc = readFileSync(
      join(root, "src/features/crm/server/crm-auth.ts"),
      "utf8"
    );
    assert.match(authSrc, /getStaffClaims/);
    assert.doesNotMatch(authSrc, /getUser\(/);
  });

  test("crm repository avoids getUser for reads", () => {
    const repoSrc = readFileSync(
      join(root, "src/features/crm/server/crm-lead-repository.ts"),
      "utf8"
    );
    assert.doesNotMatch(repoSrc, /getUser\(/);
    assert.match(repoSrc, /getCrmAccessContext/);
  });
});

describe("Phase 5C1 lead list query parsing", () => {
  test("normalizes search whitespace and caps length", () => {
    const query = parseLeadListQuery({
      q: `  hello   world ${"x".repeat(120)}  `,
    });
    assert.equal(query.q?.startsWith("hello world"), true);
    assert.equal(query.q!.length, LEAD_LIST_MAX_SEARCH_LENGTH);
  });

  test("accepts valid status and rejects invalid status", () => {
    assert.equal(parseLeadListQuery({ status: "qualified" }).status, "qualified");
    assert.equal(parseLeadListQuery({ status: "bogus" }).status, null);
  });

  test("accepts valid UUID assignee and source filters", () => {
    const uuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    assert.equal(parseLeadListQuery({ assigneeId: uuid }).assigneeId, uuid);
    assert.equal(parseLeadListQuery({ assigneeId: "not-a-uuid" }).assigneeId, null);
    assert.equal(parseLeadListQuery({ sourceId: uuid }).sourceId, uuid);
  });

  test("caps page size at 50", () => {
    assert.equal(parseLeadListQuery({ pageSize: "100" }).pageSize, LEAD_LIST_MAX_PAGE_SIZE);
    assert.equal(parseLeadListQuery({ pageSize: "10" }).pageSize, 10);
  });

  test("escapes ilike metacharacters", () => {
    assert.equal(escapeIlikePattern("100%_done"), "100\\%\\_done");
  });

  test("builds quoted PostgREST OR filter for documentation parity", () => {
    const filter = buildLeadTextSearchOrFilter('O"Brien, Pune (west) 50%');
    assert.match(filter, /submitted_name\.ilike\."%/);
    assert.match(filter, /O""Brien, Pune \(west\) 50\\%/);
  });

  test("server list query avoids raw PostgREST or interpolation", () => {
    const src = readFileSync(
      join(root, "src/features/crm/server/crm-lead-queries.ts"),
      "utf8"
    );
    assert.match(src, /fetchLeadIdsForTextSearch/);
    assert.match(src, /\.ilike\("submitted_name"/);
    assert.doesNotMatch(src, /\.or\(buildLeadTextSearchOrFilter/);
  });
});

describe("Phase 5C1 lead list DTO safety", () => {
  test("list mapper exposes only approved public keys", () => {
    const item = mapLeadRowToListItem(sampleLeadRow());
    assert.deepEqual(Object.keys(item).sort(), [...CRM_LEAD_LIST_ITEM_PUBLIC_KEYS].sort());
  });

  test("list DTO excludes personal detail and audit payload fields", () => {
    const serialised = JSON.stringify(mapLeadRowToListItem(sampleLeadRow()));
    for (const field of CRM_LEAD_LIST_FORBIDDEN_FIELDS) {
      assert.equal(serialised.includes(field), false, `must not expose ${field}`);
    }
    assert.equal(serialised.includes("submittedEmail"), false);
    assert.equal(serialised.includes("submitted_email"), false);
  });
});

describe("Phase 5C1 route and UI contracts", () => {
  const requiredRoutes = [
    "src/app/admin/crm/layout.tsx",
    "src/app/admin/crm/page.tsx",
    "src/app/admin/crm/leads/page.tsx",
    "src/app/admin/crm/leads/loading.tsx",
    "src/app/admin/crm/leads/error.tsx",
    "src/app/admin/crm/leads/[leadId]/page.tsx",
    "src/app/admin/crm/leads/[leadId]/loading.tsx",
    "src/app/admin/crm/leads/[leadId]/not-found.tsx",
  ];

  for (const route of requiredRoutes) {
    test(`route file exists: ${route}`, () => {
      assert.ok(fileExists(route));
    });
  }

  test("CRM index redirects to leads", () => {
    const pageSrc = readFileSync(join(root, "src/app/admin/crm/page.tsx"), "utf8");
    assert.match(pageSrc, /redirect\("\/admin\/crm\/leads"\)/);
  });

  test("lead detail uses notFound for inaccessible leads", () => {
    const pageSrc = readFileSync(
      join(root, "src/app/admin/crm/leads/[leadId]/page.tsx"),
      "utf8"
    );
    assert.match(pageSrc, /notFound\(/);
  });

  test("admin navigation adds CRM link behind permission probe", () => {
    const layoutSrc = readFileSync(join(root, "src/app/admin/layout.tsx"), "utf8");
    assert.match(layoutSrc, /hasAnyCrmLeadReadPermission/);
    assert.match(layoutSrc, /\/admin\/crm\/leads/);
  });

  test("detail workspace does not render mutation controls except assignment panel", () => {
    const detailComponents = readdirSync(
      join(root, "src/features/crm/components/leads")
    ).filter(
      (name) =>
        name.startsWith("LeadDetail") &&
        name !== "LeadDetailAssignmentPanel.tsx"
    );

    for (const fileName of detailComponents) {
      const src = readFileSync(
        join(root, "src/features/crm/components/leads", fileName),
        "utf8"
      );
      assert.doesNotMatch(src, /type=\"submit\"/i);
      assert.doesNotMatch(src, /assignLead/i);
      assert.doesNotMatch(src, /transitionLead/i);
      assert.doesNotMatch(src, /createLeadFollowUp/i);
    }
  });

  test("consent summary component does not expose evidence JSON", () => {
    const src = readFileSync(
      join(root, "src/features/crm/components/leads/LeadDetailConsentSummary.tsx"),
      "utf8"
    );
    assert.doesNotMatch(src, /evidence/);
  });
});

describe("Phase 5C1 regression guards", () => {
  test("public homepage entry file unchanged in scope", () => {
    assert.ok(fileExists("src/app/page.tsx"));
    const homeSrc = readFileSync(join(root, "src/app/page.tsx"), "utf8");
    assert.doesNotMatch(homeSrc, /\/admin\/crm/);
  });

  test("portfolio public routes remain present", () => {
    assert.ok(fileExists("src/app/portfolio/page.tsx"));
    assert.ok(fileExists("src/app/portfolio/[slug]/page.tsx"));
  });

  test("migrations 1 through 11 remain present and migration 12 is additive", () => {
    const migrations = readdirSync(join(root, "supabase/migrations")).filter((name) =>
      name.endsWith(".sql")
    );
    assert.ok(migrations.includes("20260731120000_crm_workspace_access_foundation.sql"));
    assert.equal(
      migrations.filter((name) => name < "20260731120000").length >= 11,
      true
    );
  });

  test("no new quotation, WhatsApp, or project conversion modules added under CRM", () => {
    const createdPaths = [
      "src/app/admin/crm/layout.tsx",
      "src/app/admin/crm/page.tsx",
      "src/app/admin/crm/leads/page.tsx",
      "src/features/crm/server/crm-auth.ts",
      "src/features/crm/server/crm-lead-queries.ts",
      "src/features/crm/server/crm-permissions.ts",
      "src/features/crm/server/crm-attribution-summary.ts",
      "supabase/migrations/20260731120000_crm_workspace_access_foundation.sql",
    ];

    for (const relativePath of createdPaths) {
      assert.ok(fileExists(relativePath), `${relativePath} should exist`);
      const src = readFileSync(join(root, relativePath), "utf8");
      assert.doesNotMatch(src, /whatsapp/i);
      assert.doesNotMatch(src, /\bquotation\b/i);
      assert.doesNotMatch(src, /\bproject conversion\b/i);
    }
  });
});
