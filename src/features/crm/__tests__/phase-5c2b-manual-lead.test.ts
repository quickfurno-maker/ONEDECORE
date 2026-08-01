/**
 * Phase 5C2B — manual lead creation & duplicate-safe flow tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { CRM_ROLE_PERMISSIONS } from "../contracts/permissions.ts";
import {
  validateManualLeadDuplicatePreviewInput,
  validateManualLeadFormInput,
} from "../contracts/manual-lead-contracts.ts";

const root = process.cwd();

describe("Phase 5C2B permissions", () => {
  test("leads.create granted to sales roles only", () => {
    assert.ok(CRM_ROLE_PERMISSIONS.super_admin.includes("leads.create"));
    assert.ok(CRM_ROLE_PERMISSIONS.sales_manager.includes("leads.create"));
    assert.ok(CRM_ROLE_PERMISSIONS.sales_executive.includes("leads.create"));
    assert.ok(CRM_ROLE_PERMISSIONS.management.includes("leads.create"));
    assert.ok(CRM_ROLE_PERMISSIONS.sales.includes("leads.create"));
    assert.equal(CRM_ROLE_PERMISSIONS.project_manager.includes("leads.create"), false);
    assert.equal(CRM_ROLE_PERMISSIONS.designer.includes("leads.create"), false);
  });

  test("duplicate override limited to manager/admin roles", () => {
    assert.ok(CRM_ROLE_PERMISSIONS.super_admin.includes("leads.duplicate_override"));
    assert.ok(CRM_ROLE_PERMISSIONS.sales_manager.includes("leads.duplicate_override"));
    assert.ok(CRM_ROLE_PERMISSIONS.management.includes("leads.duplicate_override"));
    assert.equal(CRM_ROLE_PERMISSIONS.sales_executive.includes("leads.duplicate_override"), false);
    assert.equal(CRM_ROLE_PERMISSIONS.sales.includes("leads.duplicate_override"), false);
  });
});

describe("Phase 5C2B contracts", () => {
  test("duplicate preview requires contact channel", () => {
    const errors = validateManualLeadDuplicatePreviewInput({
      phone: null,
      email: null,
      serviceCode: "complete-home-interiors",
      propertyCode: "apartment-2bhk",
      locality: null,
    });
    assert.ok(errors.some((entry) => entry.field === "contact"));
  });

  test("override reason validation enforced", () => {
    const errors = validateManualLeadFormInput(
      {
        submittedName: "Test Client",
        phone: "+919876543210",
        email: null,
        serviceCode: "complete-home-interiors",
        propertyCode: "apartment-2bhk",
        timelineCode: "within-3-months",
        primarySourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        locality: null,
        budgetComfortCode: null,
        roomCodes: [],
        message: null,
        sourceDetail: null,
        assigneeId: null,
        duplicateOverride: true,
        duplicateOverrideReason: "short",
      },
      { mode: "manager", allowSelf: true }
    );
    assert.ok(errors.some((entry) => entry.field === "duplicateOverrideReason"));
  });
});

describe("Phase 5C2B assignee policy", () => {
  test("manual lead service derives executive/manager/admin policies", () => {
    const serviceSrc = readFileSync(
      join(root, "src/features/crm/server/crm-manual-lead-service.ts"),
      "utf8"
    );
    assert.match(serviceSrc, /mode: "executive_self"/);
    assert.match(serviceSrc, /mode: "manager"/);
    assert.match(serviceSrc, /mode: "admin"/);
    assert.match(serviceSrc, /canManageLeadSources/);
  });
});

describe("Phase 5C2B server architecture", () => {
  test("manual lead modules exist", () => {
    const files = [
      "src/features/crm/contracts/manual-lead-contracts.ts",
      "src/features/crm/server/crm-manual-lead-service.ts",
      "src/features/crm/server/crm-manual-lead-actions.ts",
      "src/app/admin/crm/leads/new/page.tsx",
      "src/features/crm/components/leads/ManualLeadForm.tsx",
      "src/features/crm/components/leads/ManualLeadDuplicateNotice.tsx",
    ];
    for (const file of files) {
      assert.ok(readFileSync(join(root, file), "utf8").length > 0);
    }
  });

  test("crm-access exposes create and override flags", () => {
    const src = readFileSync(
      join(root, "src/features/crm/contracts/crm-access.ts"),
      "utf8"
    );
    assert.match(src, /canCreateLeads/);
    assert.match(src, /canOverrideLeadDuplicate/);
  });

  test("new route is server gated", () => {
    const pageSrc = readFileSync(
      join(root, "src/app/admin/crm/leads/new/page.tsx"),
      "utf8"
    );
    assert.match(pageSrc, /requireCrmCreateAccess/);
  });

  test("form shows consent non-assumption notice", () => {
    const formSrc = readFileSync(
      join(root, "src/features/crm/components/leads/ManualLeadForm.tsx"),
      "utf8"
    );
    assert.match(formSrc, /does not record marketing or WhatsApp consent/i);
    assert.doesNotMatch(formSrc, /consent.*checkbox/i);
  });

  test("executive form excludes assignee selector", () => {
    const formSrc = readFileSync(
      join(root, "src/features/crm/components/leads/ManualLeadForm.tsx"),
      "utf8"
    );
    assert.match(formSrc, /executive_self/);
    assert.match(formSrc, /assigned to you/i);
  });

  test("duplicate notice handles ACTIVE_DUPLICATE hard block", () => {
    const noticeSrc = readFileSync(
      join(root, "src/features/crm/components/leads/ManualLeadDuplicateNotice.tsx"),
      "utf8"
    );
    assert.match(noticeSrc, /ACTIVE_DUPLICATE/);
    assert.match(noticeSrc, /not\s+allowed/i);
  });

  test("lead list exposes New lead action behind canCreateLeads", () => {
    const listSrc = readFileSync(
      join(root, "src/app/admin/crm/leads/page.tsx"),
      "utf8"
    );
    assert.match(listSrc, /canCreateLeads/);
    assert.match(listSrc, /\/admin\/crm\/leads\/new/);
  });

  test("errors map manual lead postgres tokens", () => {
    const errorsSrc = readFileSync(
      join(root, "src/features/crm/server/crm-errors.ts"),
      "utf8"
    );
    assert.match(errorsSrc, /ACTIVE_DUPLICATE/);
    assert.match(errorsSrc, /CONTACT_IDENTITY_CONFLICT/);
    assert.match(errorsSrc, /DUPLICATE_OVERRIDE_REQUIRED/);
  });
});
