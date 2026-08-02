/**
 * Phase 5D — bulk import approval & source-based assignment tests.
 *
 * Several architecture tests read planned application files and will pass once
 * the Phase 5D application layer lands (contracts, parser, actions, access).
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = process.cwd();

function readPlanned(relativePath: string): string {
  const absolutePath = join(root, relativePath);
  assert.ok(
    existsSync(absolutePath),
    `planned file missing (implement Phase 5D app layer): ${relativePath}`
  );
  return readFileSync(absolutePath, "utf8");
}

describe("Phase 5D migration contract", () => {
  test("migration 15 defines bulk-import source and import entry_method", () => {
    const migration = readFileSync(
      join(
        root,
        "supabase/migrations/20260802140000_crm_bulk_import_source_assignment_foundation.sql"
      ),
      "utf8"
    );
    assert.match(migration, /'bulk-import'/);
    assert.match(migration, /entry_method,\s*\n\s*assigned_to/);
    assert.match(migration, /'import'/);
    assert.doesNotMatch(migration, /entry_method.*bulk_import/);
    assert.match(migration, /lead\.bulk_imported/);
    assert.match(migration, /'source_rule'/);
  });

  test("pgTAP test 09 exists with d-prefix fixtures", () => {
    const testSql = readFileSync(
      join(
        root,
        "supabase/tests/database/09_crm_bulk_import_source_assignment_test.sql"
      ),
      "utf8"
    );
    assert.match(testSql, /phase5d/);
    assert.match(testSql, /d1111111-1111-1111-1111-111111111111/);
    assert.match(testSql, /select plan\(84\)/);
  });
});

describe("Phase 5D permissions (planned CRM_ROLE_PERMISSIONS extension)", () => {
  test("bulk import granted to manager/admin roles only", () => {
    const permissionsSrc = readPlanned("src/features/crm/contracts/permissions.ts");
    assert.match(permissionsSrc, /leads\.bulk_import/);
    assert.match(permissionsSrc, /super_admin:[\s\S]*leads\.bulk_import/);
    assert.match(permissionsSrc, /sales_manager:[\s\S]*leads\.bulk_import/);
    assert.match(permissionsSrc, /management:[\s\S]*leads\.bulk_import/);
    assert.doesNotMatch(
      permissionsSrc,
      /sales_executive:[\s\S]*leads\.bulk_import/
    );
    assert.doesNotMatch(permissionsSrc, /designer:[\s\S]*leads\.bulk_import/);
  });

  test("bulk import approve limited to super_admin", () => {
    const permissionsSrc = readPlanned("src/features/crm/contracts/permissions.ts");
    assert.match(permissionsSrc, /leads\.bulk_import_approve/);
    assert.match(
      permissionsSrc,
      /super_admin:[\s\S]*leads\.bulk_import_approve/
    );
    assert.doesNotMatch(
      permissionsSrc,
      /sales_manager:[\s\S]*leads\.bulk_import_approve/
    );
  });

  test("assignment rules manage limited to super_admin", () => {
    const permissionsSrc = readPlanned("src/features/crm/contracts/permissions.ts");
    assert.match(permissionsSrc, /leads\.assignment_rules\.manage/);
    assert.match(
      permissionsSrc,
      /super_admin:[\s\S]*leads\.assignment_rules\.manage/
    );
    assert.doesNotMatch(
      permissionsSrc,
      /management:[\s\S]*leads\.assignment_rules\.manage/
    );
  });
});

describe("Phase 5D lead-import contracts", () => {
  test("file limits match migration caps", async () => {
    const contracts = await import("../contracts/lead-import-contracts.ts");
    assert.equal(contracts.LEAD_IMPORT_MAX_FILE_BYTES, 5_242_880);
    assert.equal(contracts.LEAD_IMPORT_MAX_ROWS, 1000);
    assert.equal(contracts.LEAD_IMPORT_MAX_COLUMNS, 50);
    assert.deepEqual(contracts.LEAD_IMPORT_ALLOWED_FILE_TYPES, ["csv", "xlsx"]);
  });

  test("imported lead transport uses entry_method import and source bulk-import", async () => {
    const contracts = await import("../contracts/lead-import-contracts.ts");
    assert.equal(contracts.LEAD_IMPORT_ENTRY_METHOD, "import");
    assert.equal(contracts.LEAD_IMPORT_LEAD_SOURCE, "bulk-import");
    assert.ok(
      contracts.LEAD_IMPORT_BATCH_STATUSES.includes("pending_super_admin_approval")
    );
    assert.ok(contracts.LEAD_IMPORT_MAPPING_TARGET_FIELDS.includes("submitted_name"));
  });

  test("mapping validation rejects unknown target fields", async () => {
    const { validateLeadImportMappingInput } = await import(
      "../contracts/lead-import-contracts.ts"
    );
    const errors = validateLeadImportMappingInput({
      mapping: { ColumnA: "not_a_real_field" },
      defaultSourceId: null,
    });
    assert.ok(errors.some((entry) => entry.field === "mapping"));
  });
});

describe("Phase 5D assignment-rule contracts", () => {
  test("assignment rule input validates priority and service code", async () => {
    const { validateCreateLeadAssignmentRuleInput } = await import(
      "../contracts/assignment-rule-contracts.ts"
    );
    const errors = validateCreateLeadAssignmentRuleInput({
      sourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      targetUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      priority: 0,
      serviceCode: "invalid-service",
      locality: null,
      budgetComfortCode: null,
    });
    assert.ok(errors.some((entry) => entry.field === "priority"));
    assert.ok(errors.some((entry) => entry.field === "serviceCode"));
  });
});

describe("Phase 5D parser module", () => {
  test("lead-import-file-parser exports csv and xlsx parsers with server-only guard", () => {
    const parserSrc = readPlanned("src/features/crm/server/lead-import-file-parser.ts");
    assert.match(parserSrc, /server-only/);
    assert.match(parserSrc, /csv-parse/);
    assert.match(parserSrc, /exceljs/i);
    assert.match(parserSrc, /LEAD_IMPORT_LIMITS/);
    assert.match(parserSrc, /formulas are not accepted/i);
    assert.match(parserSrc, /bom:\s*true/i);
  });

  test("xlsx mapping uses header-keyed records like csv", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const {
      applyMappingToRawRecords,
      parseXlsxRecordsForMapping,
    } = await import("../server/lead-import-file-parser.ts");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Leads");
    sheet.addRow([
      "Name",
      "Phone",
      "Email",
      "Service",
      "Property",
      "Timeline",
      "Locality",
    ]);
    sheet.addRow([
      "XLSX Mapping QA",
      "+919500009999",
      "xlsx-mapping-qa@example.test",
      "interior-design",
      "residential",
      "1-3-months",
      "Koramangala",
    ]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const { headers, records } = await parseXlsxRecordsForMapping(buffer);
    assert.deepEqual(headers, [
      "Name",
      "Phone",
      "Email",
      "Service",
      "Property",
      "Timeline",
      "Locality",
    ]);
    assert.equal(records.length, 1);
    assert.equal(records[0]?.Name, "XLSX Mapping QA");

    const mapped = applyMappingToRawRecords(headers, records, {
      Name: "submitted_name",
      Phone: "phone",
      Email: "email",
      Service: "service_code",
      Property: "property_code",
      Timeline: "timeline_code",
      Locality: "locality",
    });
    assert.equal(mapped.length, 1);
    assert.equal(mapped[0]?.submittedName, "XLSX Mapping QA");
    assert.equal(mapped[0]?.phone, "+919500009999");
    assert.equal(mapped[0]?.serviceCode, "interior-design");
  });

  test("save mapping action uses xlsx records-for-mapping helper", () => {
    const actionsSrc = readPlanned("src/features/crm/server/crm-import-actions.ts");
    assert.match(actionsSrc, /parseXlsxRecordsForMapping/);
    assert.doesNotMatch(actionsSrc, /submitted_name: row\.submittedName/);
  });
});

describe("Phase 5D crm-access capability flags", () => {
  test("crm-access exposes bulk import and assignment rule flags", () => {
    const src = readPlanned("src/features/crm/contracts/crm-access.ts");
    assert.match(src, /canBulkImportLeads/);
    assert.match(src, /canApproveLeadImports/);
    assert.match(src, /canManageLeadAssignmentRules/);
  });

  test("crm-permissions probes bulk import permissions", () => {
    const src = readPlanned("src/features/crm/server/crm-permissions.ts");
    assert.match(src, /probeBulkImportPermissions/);
    assert.match(src, /leads\.bulk_import/);
    assert.match(src, /leads\.bulk_import_approve/);
    assert.match(src, /leads\.assignment_rules\.manage/);
  });
});

describe("Phase 5D server architecture", () => {
  test("import service modules exist", () => {
    const files = [
      "src/features/crm/server/crm-import-service.ts",
      "src/features/crm/server/crm-import-queries.ts",
      "src/features/crm/server/crm-assignment-rule-service.ts",
    ];
    for (const file of files) {
      assert.ok(readPlanned(file).length > 0);
    }
  });

  test("crm-errors maps import and assignment rule postgres tokens", () => {
    const errorsSrc = readPlanned("src/features/crm/server/crm-errors.ts");
    assert.match(errorsSrc, /IMPORT_STALE_REVISION/);
    assert.match(errorsSrc, /ASSIGNMENT_RULE_/);
    assert.match(errorsSrc, /crm_import_/i);
    assert.match(errorsSrc, /ACTIVE_DUPLICATE/);
  });

  test("crm-import-actions exports async functions only", () => {
    const actionsSrc = readPlanned("src/features/crm/server/crm-import-actions.ts");

    assert.match(actionsSrc, /"use server"/);
    assert.doesNotMatch(actionsSrc, /export\s*\{/);

    const runtimeValueExports = [
      ...actionsSrc.matchAll(
        /export\s+(?:const|let|var|class|enum|type(?!\s+\w+\s*=)|function(?!\s+async))\s+/g
      ),
    ];
    assert.equal(
      runtimeValueExports.length,
      0,
      `unexpected runtime exports: ${runtimeValueExports.map((match) => match[0]).join(", ")}`
    );

    const asyncActionExports =
      actionsSrc.match(/export\s+async\s+function\s+\w+/g) ?? [];
    assert.ok(asyncActionExports.length >= 3);
  });

  test("crm-assignment-rule-actions exports async functions only", () => {
    const actionsSrc = readPlanned(
      "src/features/crm/server/crm-assignment-rule-actions.ts"
    );

    assert.match(actionsSrc, /"use server"/);
    assert.doesNotMatch(actionsSrc, /export\s*\{/);

    const runtimeValueExports = [
      ...actionsSrc.matchAll(
        /export\s+(?:const|let|var|class|enum|type(?!\s+\w+\s*=)|function(?!\s+async))\s+/g
      ),
    ];
    assert.equal(runtimeValueExports.length, 0);

    const asyncActionExports =
      actionsSrc.match(/export\s+async\s+function\s+\w+/g) ?? [];
    assert.ok(asyncActionExports.length >= 2);
  });

  test("assignment rule modules do not implement round robin", () => {
    const files = [
      "src/features/crm/server/crm-assignment-rule-service.ts",
      "src/features/crm/server/crm-assignment-rule-actions.ts",
      "src/features/crm/contracts/assignment-rule-contracts.ts",
    ];
    for (const file of files) {
      const src = readPlanned(file);
      assert.doesNotMatch(src, /round[\s_-]?robin/i);
      assert.match(src, /source_rule|source-based|sourceId/i);
    }
  });

  test("import UI routes are server gated", () => {
    const listPage = readPlanned("src/app/admin/crm/imports/page.tsx");
    const newPage = readPlanned("src/app/admin/crm/imports/new/page.tsx");
    const rulesPage = readPlanned(
      "src/app/admin/crm/settings/assignment-rules/page.tsx"
    );
    assert.match(listPage, /canBulkImportLeads|requireCrmBulkImportAccess/);
    assert.match(newPage, /canBulkImportLeads|requireCrmBulkImportAccess/);
    assert.match(rulesPage, /canManageLeadAssignmentRules|requireCrmAssignmentRuleAccess/);
  });

  test("import wizard documents zero consent assumption", () => {
    const wizardSrc = readPlanned(
      "src/features/crm/components/imports/ImportWizard.tsx"
    );
    assert.match(wizardSrc, /Bulk import does not record marketing/i);
    assert.match(wizardSrc, /WhatsApp consent/i);
    assert.doesNotMatch(wizardSrc, /consent.*checkbox/i);
  });
});
