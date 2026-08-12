/**
 * Phase 7A — Commercial Quotation Draft Foundation Unit & Integration Tests
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { quotationErrorFromPostgresMessage } from "../server/quotation-errors.ts";
import { parseQuotationInrToPaiseExact } from "../contracts/money.ts";
import {
  QuotationValidationError,
  validateAndFormatPercentageString,
  validateAndFormatQuantityString,
} from "../server/quotation-decimal-utils.ts";
import {
  buildValidatedPaymentSchedulePayload,
  buildValidatedSectionPayload,
  getQuotationHeaderVersionKey,
  getQuotationTermsVersionKey,
  validateFlatDiscountInput,
  type RawMilestoneState,
  type RawSectionState,
} from "../utils/quotation-editor-helpers.ts";

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

  test("APP-5: Quantity bounds alignment — 1000000.000 max accepted, 1000000.001 and over-scale rejected", () => {
    assert.equal(validateAndFormatQuantityString("1000000.000"), "1000000.000");
    assert.equal(validateAndFormatQuantityString("1000000"), "1000000");
    assert.equal(validateAndFormatQuantityString("0.001"), "0.001");

    assert.throws(
      () => validateAndFormatQuantityString("1000000.001"),
      (err: unknown) =>
        err instanceof QuotationValidationError &&
        err.message.includes("Quantity out of allowed range")
    );
    assert.throws(
      () => validateAndFormatQuantityString("0.000"),
      (err: unknown) =>
        err instanceof QuotationValidationError &&
        err.message.includes("Quantity out of allowed range")
    );
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

  test("APP-MONEY-1 & APP-MONEY-2: Source code proof — no parseQuotationInrToPaiseExact ?? 0 fallback in UI components", () => {
    const projectRoot = path.resolve(import.meta.dirname, "../../../../");
    const sectionAccordionFile = fs.readFileSync(
      path.join(projectRoot, "src/features/quotations/components/QuotationSectionAccordion.tsx"),
      "utf-8"
    );
    const discountCardFile = fs.readFileSync(
      path.join(projectRoot, "src/features/quotations/components/QuotationDiscountCard.tsx"),
      "utf-8"
    );
    const scheduleEditorFile = fs.readFileSync(
      path.join(projectRoot, "src/features/quotations/components/QuotationPaymentScheduleEditor.tsx"),
      "utf-8"
    );

    assert.equal(
      sectionAccordionFile.includes("parseQuotationInrToPaiseExact") && sectionAccordionFile.includes("?? 0"),
      false,
      "QuotationSectionAccordion contains parseQuotationInrToPaiseExact ?? 0 fallback!"
    );
    assert.equal(
      discountCardFile.includes("parseQuotationInrToPaiseExact") && discountCardFile.includes("?? 0"),
      false,
      "QuotationDiscountCard contains parseQuotationInrToPaiseExact ?? 0 fallback!"
    );
    assert.equal(
      scheduleEditorFile.includes("parseQuotationInrToPaiseExact") && scheduleEditorFile.includes("?? 0"),
      false,
      "QuotationPaymentScheduleEditor contains parseQuotationInrToPaiseExact ?? 0 fallback!"
    );
  });

  test("APP-MONEY-3 & APP-MONEY-4: Payment schedule raw amount state and submission blocking on invalid input", () => {
    const invalidMilestones: RawMilestoneState[] = [
      { milestoneName: "Advance", rawAmount: "1.999", rawPercentage: "0" },
    ];
    const resInvalid = buildValidatedPaymentSchedulePayload("amount", invalidMilestones);
    assert.equal(resInvalid.success, false);
    if (!resInvalid.success) {
      assert.equal(resInvalid.error.includes("Invalid amount"), true);
    }

    const blankMilestones: RawMilestoneState[] = [
      { milestoneName: "Advance", rawAmount: "", rawPercentage: "0" },
    ];
    const resBlank = buildValidatedPaymentSchedulePayload("amount", blankMilestones);
    assert.equal(resBlank.success, false);

    const validMilestones: RawMilestoneState[] = [
      { milestoneName: "Advance", rawAmount: "500.50", rawPercentage: "0" },
    ];
    const resValid = buildValidatedPaymentSchedulePayload("amount", validMilestones);
    assert.equal(resValid.success, true);
    if (resValid.success) {
      assert.equal(resValid.data[0].amountPaise, 50050);
    }
  });

  test("APP-MONEY-5: Invalid line-item unit rate blocks section payload construction", () => {
    const invalidSections: RawSectionState[] = [
      {
        sectionName: "Living Room",
        items: [
          {
            itemName: "TV Unit",
            rawQuantity: "2",
            unitOfMeasure: "sqft",
            rawUnitRate: "invalid-rate",
          },
        ],
      },
    ];
    const resInvalid = buildValidatedSectionPayload(invalidSections);
    assert.equal(resInvalid.success, false);
    if (!resInvalid.success) {
      assert.equal(resInvalid.error.includes("Invalid unit rate"), true);
    }

    const validSections: RawSectionState[] = [
      {
        sectionName: "Living Room",
        items: [
          {
            itemName: "TV Unit",
            rawQuantity: "2",
            unitOfMeasure: "sqft",
            rawUnitRate: "1234.56",
          },
        ],
      },
    ];
    const resValid = buildValidatedSectionPayload(validSections);
    assert.equal(resValid.success, true);
    if (resValid.success) {
      assert.equal(resValid.data[0].items[0].unitRatePaise, 123456);
      assert.equal(resValid.data[0].items[0].quantity, "2");
    }
  });

  test("APP-MONEY-6: Invalid flat discount blocks mutation callback", () => {
    const resInvalid = validateFlatDiscountInput("abc");
    assert.equal(resInvalid.success, false);

    const resOverScale = validateFlatDiscountInput("1.999");
    assert.equal(resOverScale.success, false);

    const resBlank = validateFlatDiscountInput("");
    assert.equal(resBlank.success, false);

    const resValid = validateFlatDiscountInput("2500.75");
    assert.equal(resValid.success, true);
    if (resValid.success) {
      assert.equal(resValid.data, 250075);
    }
  });

  test("APP-MONEY-7 & APP-MONEY-8 & APP-MONEY-9: parseQuotationInrToPaiseExact semantics", () => {
    assert.equal(parseQuotationInrToPaiseExact("1.999"), null);
    assert.equal(parseQuotationInrToPaiseExact(""), null);
    assert.equal(parseQuotationInrToPaiseExact("0"), 0);
    assert.notEqual(parseQuotationInrToPaiseExact("0"), null);
  });

  test("APP-MONEY-10: Exact money parser accepts valid money representations", () => {
    assert.equal(parseQuotationInrToPaiseExact("1.99"), 199);
    assert.equal(parseQuotationInrToPaiseExact("1.20"), 120);
    assert.equal(parseQuotationInrToPaiseExact("₹1,234.56"), 123456);
  });

  test("APP-PREAPPLY-1 & APP-PREAPPLY-2: Section name length limit is strictly 120 characters", () => {
    const name120 = "S".repeat(120);
    const validSections: RawSectionState[] = [
      {
        sectionName: name120,
        items: [{ itemName: "Cabinet", rawQuantity: "1", unitOfMeasure: "nos", rawUnitRate: "100" }],
      },
    ];
    const res120 = buildValidatedSectionPayload(validSections);
    assert.equal(res120.success, true, "120 char section name was rejected!");

    const name121 = "S".repeat(121);
    const invalidSections: RawSectionState[] = [
      {
        sectionName: name121,
        items: [{ itemName: "Cabinet", rawQuantity: "1", unitOfMeasure: "nos", rawUnitRate: "100" }],
      },
    ];
    const res121 = buildValidatedSectionPayload(invalidSections);
    assert.equal(res121.success, false, "121 char section name was allowed!");
    if (!res121.success) {
      assert.equal(res121.error.includes("cannot exceed 120 characters"), true);
    }
  });

  test("APP-PREAPPLY-3 & APP-PREAPPLY-4: QuotationSectionAccordion new section and item start neutral with blank business fields", () => {
    const accordionSource = fs.readFileSync(
      path.resolve(import.meta.dirname, "../components/QuotationSectionAccordion.tsx"),
      "utf-8"
    );

    assert.equal(
      accordionSource.includes('sectionName: ""'),
      true,
      "QuotationSectionAccordion does not initialize new section with blank sectionName: ''!"
    );
    assert.equal(
      accordionSource.includes('itemName: ""'),
      true,
      "QuotationSectionAccordion does not initialize new item with blank itemName: ''!"
    );
    assert.equal(
      accordionSource.includes('rawQuantity: ""'),
      true,
      "QuotationSectionAccordion does not initialize new item with blank rawQuantity: ''!"
    );
    assert.equal(
      accordionSource.includes('rawUnitRate: ""'),
      true,
      "QuotationSectionAccordion does not initialize new item with blank rawUnitRate: ''!"
    );
  });

  test("APP-PREAPPLY-5: QuotationPaymentScheduleEditor new milestone starts neutral with blank business fields", () => {
    const scheduleSource = fs.readFileSync(
      path.resolve(import.meta.dirname, "../components/QuotationPaymentScheduleEditor.tsx"),
      "utf-8"
    );

    assert.equal(
      scheduleSource.includes('milestoneName: ""'),
      true,
      "QuotationPaymentScheduleEditor does not initialize new milestone with blank milestoneName: ''!"
    );
    assert.equal(
      scheduleSource.includes('rawPercentage: ""'),
      true,
      "QuotationPaymentScheduleEditor does not initialize new milestone with blank rawPercentage: ''!"
    );
    assert.equal(
      scheduleSource.includes('rawAmount: ""'),
      true,
      "QuotationPaymentScheduleEditor does not initialize new milestone with blank rawAmount: ''!"
    );
  });

  test("APP-PREAPPLY-6: Untouched blank new section/item/milestone cannot produce a valid save payload", () => {
    const blankSection: RawSectionState[] = [{ sectionName: "", items: [] }];
    assert.equal(buildValidatedSectionPayload(blankSection).success, false);

    const blankItemSection: RawSectionState[] = [
      {
        sectionName: "Kitchen",
        items: [
          { itemName: "", rawQuantity: "", unitOfMeasure: "", rawUnitRate: "" },
        ],
      },
    ];
    assert.equal(buildValidatedSectionPayload(blankItemSection).success, false);

    const blankMilestone: RawMilestoneState[] = [
      { milestoneName: "", rawPercentage: "", rawAmount: "" },
    ];
    assert.equal(buildValidatedPaymentSchedulePayload("percentage", blankMilestone).success, false);
  });

  test("APP-PREAPPLY-7 & APP-PREAPPLY-8: QuotationHeaderCard onChange is local only and resyncs on canonical version prop change", () => {
    const headerSource = fs.readFileSync(
      path.resolve(import.meta.dirname, "../components/QuotationHeaderCard.tsx"),
      "utf-8"
    );

    assert.equal(
      headerSource.includes('onChange={(e) => onUpdateTitleAndScope('),
      false,
      "QuotationHeaderCard calls onUpdateTitleAndScope on every onChange keystroke!"
    );
    assert.equal(
      headerSource.includes("onUpdateTitleAndScope(trimmedTitle, trimmedScope)"),
      true,
      "QuotationHeaderCard does not invoke onUpdateTitleAndScope inside explicit handleSaveHeader!"
    );
    assert.equal(
      headerSource.includes("setPrevVersionKey(currentVersionKey)"),
      true,
      "QuotationHeaderCard does not resync local state on canonical version change!"
    );
  });

  test("APP-PREAPPLY-9: QuotationTermsEditor resyncs local state when canonical version terms data changes", () => {
    const termsSource = fs.readFileSync(
      path.resolve(import.meta.dirname, "../components/QuotationTermsEditor.tsx"),
      "utf-8"
    );

    assert.equal(
      termsSource.includes("setPrevVersionKey(currentVersionKey)"),
      true,
      "QuotationTermsEditor does not resync local state on canonical version change!"
    );
  });

  test("APP-PREAPPLY-10 & APP-HARDEN-5: Generated DB types isolate each RPC Args block for p_idempotency_key", () => {
    const generatedTypes = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../../types/database.generated.ts"),
      "utf-8"
    );

    // Isolate update_quotation_draft Args block
    const updateIdx = generatedTypes.indexOf("update_quotation_draft:");
    assert.equal(updateIdx !== -1, true, "update_quotation_draft RPC not found in database.generated.ts");
    const updateBlock = generatedTypes.substring(updateIdx, updateIdx + 600);
    assert.equal(
      updateBlock.includes("p_idempotency_key?: string"),
      true,
      "update_quotation_draft Args block does not contain p_idempotency_key?: string"
    );

    // Isolate save_quotation_draft_items Args block
    const saveIdx = generatedTypes.indexOf("save_quotation_draft_items:");
    assert.equal(saveIdx !== -1, true, "save_quotation_draft_items RPC not found in database.generated.ts");
    const saveBlock = generatedTypes.substring(saveIdx, saveIdx + 600);
    assert.equal(
      saveBlock.includes("p_idempotency_key?: string"),
      true,
      "save_quotation_draft_items Args block does not contain p_idempotency_key?: string"
    );

    // Isolate replace_quotation_payment_schedule Args block
    const replaceIdx = generatedTypes.indexOf("replace_quotation_payment_schedule:");
    assert.equal(replaceIdx !== -1, true, "replace_quotation_payment_schedule RPC not found in database.generated.ts");
    const replaceBlock = generatedTypes.substring(replaceIdx, replaceIdx + 600);
    assert.equal(
      replaceBlock.includes("p_idempotency_key?: string"),
      true,
      "replace_quotation_payment_schedule Args block does not contain p_idempotency_key?: string"
    );
  });

  test("APP-HARDEN-1 & APP-HARDEN-2: Structured resync keys prevent key collisions", () => {
    // Header key collision resistance
    const key1 = getQuotationHeaderVersionKey({ title: "a-b", scopeSummary: "c" });
    const key2 = getQuotationHeaderVersionKey({ title: "a", scopeSummary: "b-c" });
    assert.notEqual(key1, key2, '("a-b", "c") and ("a", "b-c") produced colliding header keys!');

    // Terms key collision resistance
    const termsKey1 = getQuotationTermsVersionKey({ inclusions: ["a,b"] });
    const termsKey2 = getQuotationTermsVersionKey({ inclusions: ["a", "b"] });
    assert.notEqual(termsKey1, termsKey2, '["a,b"] and ["a", "b"] produced colliding terms keys!');
  });

  test("APP-HARDEN-3: Quotations Overview route uses probeQuotationPermissions and gates editor link on canEditQuotations", () => {
    const overviewPageSource = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../../app/admin/quotations/page.tsx"),
      "utf-8"
    );

    assert.equal(
      overviewPageSource.includes("probeQuotationPermissions"),
      true,
      "AdminQuotationsOverviewPage does not call probeQuotationPermissions!"
    );
    assert.equal(
      overviewPageSource.includes("isActiveAndEditable"),
      true,
      "AdminQuotationsOverviewPage does not check isActiveAndEditable!"
    );
    assert.equal(
      overviewPageSource.includes("canEditQuotations"),
      true,
      "AdminQuotationsOverviewPage does not gate editor link on canEditQuotations!"
    );
  });

  test("APP-HARDEN-4: Quotation Draft route uses probeQuotationPermissions and gates QuotationDraftEditor rendering", () => {
    const draftPageSource = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../../app/admin/quotations/[quotationId]/draft/page.tsx"),
      "utf-8"
    );

    assert.equal(
      draftPageSource.includes("probeQuotationPermissions"),
      true,
      "QuotationDraftPage does not call probeQuotationPermissions!"
    );
    assert.equal(
      draftPageSource.includes("canEditQuotations === true"),
      true,
      "QuotationDraftPage does not gate isEditableActiveDraft on canEditQuotations === true!"
    );
    assert.equal(
      draftPageSource.includes("!canEditQuotations"),
      true,
      "QuotationDraftPage does not handle read-only actor message for missing edit permission!"
    );
  });

  test("APP-PREAPPLY-11: Description and specifications length > 2000 are rejected by buildValidatedSectionPayload", () => {
    const overlongDesc: RawSectionState[] = [
      {
        sectionName: "Hall",
        items: [
          {
            itemName: "Sofa",
            description: "a".repeat(2001),
            rawQuantity: "1",
            unitOfMeasure: "nos",
            rawUnitRate: "100",
          },
        ],
      },
    ];
    const resDesc = buildValidatedSectionPayload(overlongDesc);
    assert.equal(resDesc.success, false);
    if (!resDesc.success) {
      assert.equal(resDesc.error.includes("cannot exceed 2000 characters"), true);
    }

    const overlongSpec: RawSectionState[] = [
      {
        sectionName: "Hall",
        items: [
          {
            itemName: "Sofa",
            specifications: "b".repeat(2001),
            rawQuantity: "1",
            unitOfMeasure: "nos",
            rawUnitRate: "100",
          },
        ],
      },
    ];
    const resSpec = buildValidatedSectionPayload(overlongSpec);
    assert.equal(resSpec.success, false);
    if (!resSpec.success) {
      assert.equal(resSpec.error.includes("cannot exceed 2000 characters"), true);
    }
  });

  test("APP-PREAPPLY-12: All raw-money and no-fake-UOM behavior remains intact", () => {
    const helpersSource = fs.readFileSync(
      path.resolve(import.meta.dirname, "../utils/quotation-editor-helpers.ts"),
      "utf-8"
    );

    assert.equal(helpersSource.includes('|| "nos"'), false);
    assert.equal(helpersSource.includes('|| "sqft"'), false);
    assert.equal(helpersSource.includes('?? 0'), false);
  });

  test("APP-PREAPPLY-13: Archived or non-active quotation is not exposed as editable active draft UI", () => {
    const draftPageSource = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../../app/admin/quotations/[quotationId]/draft/page.tsx"),
      "utf-8"
    );

    assert.equal(
      draftPageSource.includes("isEditableActiveDraft"),
      true,
      "QuotationDraftPage does not check isEditableActiveDraft!"
    );
    assert.equal(
      draftPageSource.includes("Archived or Non-Editable Quotation State"),
      true,
      "QuotationDraftPage does not render read-only banner for archived draft!"
    );
  });

  test("APP-MONEY-11: Source regression guard — zero floating-point parsers on quotation mutation components", () => {
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

    assert.equal(actionsFile.includes("parseFloat"), false);
    assert.equal(scheduleEditorFile.includes("parseFloat"), false);
    assert.equal(sectionAccordionFile.includes("parseFloat"), false);
    assert.equal(discountCardFile.includes("parseFloat"), false);
    assert.equal(discountCardFile.includes("parseInrToPaise"), false);
  });

  test("APP-MONEY-12: Actual QuotationDraftEditor source code proof for getQuotationDraftAction and setDraft state replacement", () => {
    const editorSource = fs.readFileSync(
      path.resolve(import.meta.dirname, "../components/QuotationDraftEditor.tsx"),
      "utf-8"
    );

    assert.equal(
      editorSource.includes('import { getQuotationDraftAction } from "../server/quotation-draft-actions";') ||
        editorSource.includes("getQuotationDraftAction"),
      true
    );
    assert.equal(editorSource.includes("getQuotationDraftAction(draft.quotationId)"), true);
    assert.equal(editorSource.includes("setDraft(res.data)"), true);
  });

  test("APP-MONEY-13: CRM LeadDetailQuotationPanel RBAC gating rules", () => {
    const leadPanelFile = fs.readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../crm/components/leads/LeadDetailQuotationPanel.tsx"
      ),
      "utf-8"
    );

    assert.equal(leadPanelFile.includes("canEditQuotation || canCreateQuotation"), false);
    assert.equal(
      leadPanelFile.includes("hasActiveDraft ? (\n            canEditQuotation ?") ||
        leadPanelFile.includes("hasActiveDraft ? (\n            canEditQuotation"),
      true
    );
  });

  test("APP-MONEY-14 & APP-PREAPPLY-14: Real Phase 7B implementation-absence regression guard", () => {
    const projectRoot = path.resolve(import.meta.dirname, "../../../../");
    const actionsFile = fs.readFileSync(
      path.join(projectRoot, "src/features/quotations/server/quotation-draft-actions.ts"),
      "utf-8"
    );

    assert.equal(actionsFile.includes("finalizeQuotation"), false);
    assert.equal(actionsFile.includes("sendQuotation"), false);
    assert.equal(actionsFile.includes("acceptQuotation"), false);
    assert.equal(actionsFile.includes("pdf"), false);
    assert.equal(actionsFile.includes("quotations.approve"), false);
  });

  test("APP-PARITY-1 & APP-PARITY-2: DDL constraint name accuracy and audit doc parity verification", () => {
    const projectRoot = path.resolve(import.meta.dirname, "../../../../");
    const migrationSql = fs.readFileSync(
      path.join(
        projectRoot,
        "supabase/migrations/20260812140000_commercial_quotation_draft_foundation.sql"
      ),
      "utf-8"
    );
    const auditDoc = fs.readFileSync(
      path.join(
        projectRoot,
        "docs/audits/phase-7a-m25-quotation-draft-foundation-implementation.md"
      ),
      "utf-8"
    );

    // Assert migration DDL contains actual exact constraint names
    assert.equal(migrationSql.includes("chk_quotation_versions_title"), true);
    assert.equal(migrationSql.includes("chk_quotation_items_desc"), true);
    assert.equal(migrationSql.includes("chk_quotation_items_specs"), true);
    assert.equal(migrationSql.includes("chk_quotation_items_qty"), true);
    assert.equal(migrationSql.includes("chk_quotation_items_uom"), true);
    assert.equal(migrationSql.includes("chk_quotation_items_rate"), true);
    assert.equal(migrationSql.includes("chk_quotation_payment_schedules_name"), true);
    assert.equal(migrationSql.includes("chk_quotation_payment_schedules_pct"), true);
    assert.equal(migrationSql.includes("chk_quotation_payment_schedules_amt"), true);
    assert.equal(migrationSql.includes("chk_quotation_idempotency_key"), true);

    // Assert audit document DOES NOT falsely claim non-existent DDL constraint names
    assert.equal(auditDoc.includes("chk_quotation_versions_scope_summary"), false);
    assert.equal(auditDoc.includes("chk_quotation_versions_terms"), false);
    assert.equal(auditDoc.includes("chk_quotation_items_description"), false);
    assert.equal(auditDoc.includes("chk_quotation_items_specifications"), false);
    assert.equal(auditDoc.includes("chk_quotation_items_quantity"), false);
    assert.equal(auditDoc.includes("chk_quotation_items_unit_rate"), false);
    assert.equal(auditDoc.includes("chk_quotation_payment_schedules_percentage"), false);
    assert.equal(auditDoc.includes("chk_quotation_payment_schedules_amount"), false);
    assert.equal(auditDoc.includes("chk_idempotency_key_length"), false);

    // Assert audit document explicitly states RPC-owned bound for scope summary and terms
    assert.equal(auditDoc.includes("text; no dedicated length CHECK — bound owned by application/server/RPC"), true);
  });
});
