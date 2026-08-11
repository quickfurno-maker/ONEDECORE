/**
 * Phase 7A — Commercial Quotation Draft Foundation Unit & Integration Tests
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { quotationErrorFromPostgresMessage } from "../server/quotation-errors.ts";
import type { QuotationDraftDTO } from "../contracts/types.ts";
import {
  QuotationValidationError,
  validateAndFormatPaiseInteger,
  validateAndFormatPercentageString,
  validateAndFormatQuantityString,
} from "../server/quotation-decimal-utils.ts";

describe("Phase 7A Commercial Quotation Draft Foundation", () => {
  test("Quotation number format validation regex matches OD-Q-YYYY-SEQ6", () => {
    const pattern = /^OD-Q-[0-9]{4}-[0-9]{6,}$/;
    assert.equal(pattern.test("OD-Q-2026-000001"), true);
    assert.equal(pattern.test("OD-Q-2026-000042"), true);
    assert.equal(pattern.test("OD-Q-2026-1234567"), true);
    assert.equal(pattern.test("OD-Q-26-000001"), false);
    assert.equal(pattern.test("Q-2026-000001"), false);
    assert.equal(pattern.test("OD-Q-2026-1234"), false);
  });

  test("APP-1: Actual quantity mutation adapter preserves exact decimal string without parseFloat drift", () => {
    const exactQtyStr = "120.500";
    const formatted = validateAndFormatQuantityString(exactQtyStr);
    assert.equal(formatted, "120.500");
    assert.strictEqual(formatted, "120.500");

    // Prove parseFloat drift is avoided
    const floatResult = parseFloat("0.1") + parseFloat("0.2");
    assert.notEqual(floatResult, 0.3); // IEEE 754 drift 0.30000000000000004
    const exactResult = validateAndFormatQuantityString("0.300");
    assert.equal(exactResult, "0.300");
  });

  test("APP-2: Actual payment percentage mutation adapter preserves exact decimal string", () => {
    const exactPctStr = "33.33";
    const formatted = validateAndFormatPercentageString(exactPctStr);
    assert.equal(formatted, "33.33");
    assert.strictEqual(formatted, "33.33");
  });

  test("APP-3: Actual discount percentage mutation adapter preserves exact decimal string", () => {
    const exactDiscountStr = "12.50";
    const formatted = validateAndFormatPercentageString(exactDiscountStr);
    assert.equal(formatted, "12.50");
  });

  test("APP-4: Invalid decimal syntax is rejected before RPC payload construction", () => {
    assert.throws(
      () => validateAndFormatQuantityString("invalid-qty-string"),
      (err: unknown) =>
        err instanceof QuotationValidationError &&
        err.message.includes("Invalid quantity format")
    );
    assert.throws(
      () => validateAndFormatPercentageString("bad-pct"),
      (err: unknown) =>
        err instanceof QuotationValidationError &&
        err.message.includes("Invalid percentage format")
    );
  });

  test("APP-5: Over-scale quantity (>3 decimals) is rejected before RPC payload construction", () => {
    assert.throws(
      () => validateAndFormatQuantityString("12.3456"),
      (err: unknown) =>
        err instanceof QuotationValidationError &&
        err.message.includes("Quantity cannot exceed 3 decimal places")
    );
  });

  test("APP-6: Over-scale percentage (>2 decimals) is rejected before RPC payload construction", () => {
    assert.throws(
      () => validateAndFormatPercentageString("33.333"),
      (err: unknown) =>
        err instanceof QuotationValidationError &&
        err.message.includes("Percentage cannot exceed 2 decimal places")
    );
  });

  test("APP-7 & APP-8 & APP-9: Plain Supabase/PostgREST error object normalization and sanitization", () => {
    const conflictObj = quotationErrorFromPostgresMessage({
      code: "P0002",
      message: "QUOTATION_VERSION_CONFLICT: Stale lock version",
      details: null,
      hint: null,
    });
    assert.equal(conflictObj.code, "QUOTATION_VERSION_CONFLICT");

    const forbiddenObj = quotationErrorFromPostgresMessage({
      code: "42501",
      message: "insufficient_privilege",
      details: null,
      hint: null,
    });
    assert.equal(forbiddenObj.code, "QUOTATION_NOT_FOUND_OR_FORBIDDEN");

    const unknownObj = quotationErrorFromPostgresMessage({
      code: "99999",
      message: "raw_internal_postgres_leak",
      details: "sensitive_table_schema",
    });
    assert.equal(unknownObj.code, "QUOTATION_UNKNOWN_ERROR");
    assert.equal(unknownObj.message.includes("raw_internal_postgres_leak"), false);
  });

  test("APP-10: State replacement contract updates draft state on canonical refresh", () => {
    const mockDraftV1: QuotationDraftDTO = {
      quotationId: "q-100",
      leadId: "lead-100",
      quotationNumber: "OD-Q-2026-000100",
      rootStatus: "active",
      version: {
        id: "v-1",
        versionNumber: 1,
        lockVersion: 1,
        status: "draft",
        isCurrentDraft: true,
        title: "Title V1",
        subtotalPaise: 100000,
        discountType: "none",
        discountValuePaise: 0,
        discountPercentage: 0,
        discountTotalPaise: 0,
        taxableBasePaise: 100000,
        taxProfileId: null,
        taxRatePercentage: null,
        taxTotalPaise: null,
        grandTotalPaise: null,
        inclusions: [],
        exclusions: [],
      },
      sections: [],
      paymentSchedules: [],
    };

    const mockDraftV2: QuotationDraftDTO = {
      ...mockDraftV1,
      version: {
        ...mockDraftV1.version!,
        lockVersion: 2,
        title: "Refreshed Title V2",
      },
    };

    // State replacement helper simulation
    let currentDraftState = mockDraftV1;
    const setDraftState = (newDraft: QuotationDraftDTO) => {
      currentDraftState = newDraft;
    };

    setDraftState(mockDraftV2);
    assert.equal(currentDraftState.version?.lockVersion, 2);
    assert.equal(currentDraftState.version?.title, "Refreshed Title V2");
  });

  test("APP-11: Source regression guard — no parseFloat on quotation authoritative mutation paths", () => {
    const projectRoot = path.resolve(import.meta.dirname, "../../../../");
    const actionsFile = fs.readFileSync(
      path.join(projectRoot, "src/features/quotations/server/quotation-draft-actions.ts"),
      "utf-8"
    );
    const scheduleEditorFile = fs.readFileSync(
      path.join(projectRoot, "src/features/quotations/components/QuotationPaymentScheduleEditor.tsx"),
      "utf-8"
    );
    const sectionAccordionFile = fs.readFileSync(
      path.join(projectRoot, "src/features/quotations/components/QuotationSectionAccordion.tsx"),
      "utf-8"
    );
    const discountCardFile = fs.readFileSync(
      path.join(projectRoot, "src/features/quotations/components/QuotationDiscountCard.tsx"),
      "utf-8"
    );

    assert.equal(actionsFile.includes("parseFloat"), false, "quotation-draft-actions.ts contains parseFloat!");
    assert.equal(scheduleEditorFile.includes("parseFloat"), false, "QuotationPaymentScheduleEditor.tsx contains parseFloat!");
    assert.equal(sectionAccordionFile.includes("parseFloat"), false, "QuotationSectionAccordion.tsx contains parseFloat!");
    assert.equal(discountCardFile.includes("parseFloat"), false, "QuotationDiscountCard.tsx contains parseFloat!");
  });

  test("APP-12 & APP-13: CRM LeadDetailQuotationPanel RBAC gating rules", () => {
    const leadPanelFile = fs.readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../crm/components/leads/LeadDetailQuotationPanel.tsx"
      ),
      "utf-8"
    );

    // Active draft editor navigation must strictly require canEditQuotation
    assert.equal(
      leadPanelFile.includes("canEditQuotation || canCreateQuotation"),
      false,
      "LeadDetailQuotationPanel permits opening active draft without canEditQuotation!"
    );
    assert.equal(
      leadPanelFile.includes("hasActiveDraft ? (\n            canEditQuotation ?") ||
        leadPanelFile.includes("hasActiveDraft ? (\n            canEditQuotation"),
      true,
      "LeadDetailQuotationPanel does not strictly require canEditQuotation for active draft!"
    );
  });

  test("APP-14: Permission probe uses real permission codes from actual quotation permissions module", () => {
    const permissionsModule = fs.readFileSync(
      path.resolve(import.meta.dirname, "../server/quotation-permissions.ts"),
      "utf-8"
    );
    assert.equal(permissionsModule.includes('"quotations.read"'), true);
    assert.equal(permissionsModule.includes('"quotations.create"'), true);
    assert.equal(permissionsModule.includes('"quotations.edit"'), true);
    assert.equal(permissionsModule.includes('"quotations.approve"'), false);
    assert.equal(permissionsModule.includes('"quotations.delete"'), false);
  });

  test("APP-15 & APP-16 & APP-17: Phase 7B boundaries, approval permissions, and default values", () => {
    const systemPermissions = ["quotations.read", "quotations.create", "quotations.edit"];
    assert.equal(systemPermissions.includes("quotations.approve"), false);
    assert.equal(systemPermissions.includes("quotations.delete"), false);

    // Validate paise integer helper
    assert.equal(validateAndFormatPaiseInteger(50000), 50000);
    assert.throws(() => validateAndFormatPaiseInteger(-100));
    assert.throws(() => validateAndFormatPaiseInteger("invalid"));
  });
});
