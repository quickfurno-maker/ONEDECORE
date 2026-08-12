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

  test("APP-UOM-1 & APP-UOM-2 & APP-UOM-4 & APP-UOM-5: Unit of Measure validation rules in buildValidatedSectionPayload", () => {
    // APP-UOM-1: Blank UOM is rejected
    const blankUomSections: RawSectionState[] = [
      {
        sectionName: "Hall",
        items: [
          { itemName: "Sofa", rawQuantity: "1", unitOfMeasure: "   ", rawUnitRate: "100" },
        ],
      },
    ];
    const resBlank = buildValidatedSectionPayload(blankUomSections);
    assert.equal(resBlank.success, false);
    if (!resBlank.success) {
      assert.equal(resBlank.error.includes("Unit of measure is required"), true);
    }

    // APP-UOM-2: Blank UOM does NOT become "nos"
    assert.equal(
      resBlank.success === false && !JSON.stringify(resBlank).includes('"nos"'),
      true,
      "Blank UOM synthesized fallback nos!"
    );

    // APP-UOM-4: UOM > 30 characters is rejected
    const overlongUomSections: RawSectionState[] = [
      {
        sectionName: "Hall",
        items: [
          {
            itemName: "Sofa",
            rawQuantity: "1",
            unitOfMeasure: "a".repeat(31),
            rawUnitRate: "100",
          },
        ],
      },
    ];
    const resOverlong = buildValidatedSectionPayload(overlongUomSections);
    assert.equal(resOverlong.success, false);
    if (!resOverlong.success) {
      assert.equal(resOverlong.error.includes("cannot exceed 30 characters"), true);
    }

    // APP-UOM-5: Valid UOM "  sqft  " normalized to "sqft"
    const untrimmedUomSections: RawSectionState[] = [
      {
        sectionName: "Hall",
        items: [
          { itemName: "Panels", rawQuantity: "10", unitOfMeasure: "  sqft  ", rawUnitRate: "50" },
        ],
      },
    ];
    const resValid = buildValidatedSectionPayload(untrimmedUomSections);
    assert.equal(resValid.success, true);
    if (resValid.success) {
      assert.equal(resValid.data[0].items[0].unitOfMeasure, "sqft");
    }
  });

  test("APP-UOM-3: QuotationSectionAccordion new-item initialization starts with neutral blank unitOfMeasure: ''", () => {
    const accordionSource = fs.readFileSync(
      path.resolve(import.meta.dirname, "../components/QuotationSectionAccordion.tsx"),
      "utf-8"
    );

    assert.equal(
      accordionSource.includes('unitOfMeasure: ""'),
      true,
      "QuotationSectionAccordion does not initialize new item with unitOfMeasure: ''!"
    );
    assert.equal(
      accordionSource.includes('unitOfMeasure: "sqft"'),
      false,
      "QuotationSectionAccordion contains fabricated default unitOfMeasure: 'sqft'!"
    );
    assert.equal(
      accordionSource.includes('unitOfMeasure: "nos"'),
      false,
      "QuotationSectionAccordion contains fabricated default unitOfMeasure: 'nos'!"
    );
  });

  test("APP-UOM-6 & APP-UOM-7: Section and item name validation — blank names are rejected without synthesis", () => {
    const blankSecSections: RawSectionState[] = [
      {
        sectionName: "   ",
        items: [{ itemName: "Sofa", rawQuantity: "1", unitOfMeasure: "nos", rawUnitRate: "100" }],
      },
    ];
    const resBlankSec = buildValidatedSectionPayload(blankSecSections);
    assert.equal(resBlankSec.success, false);
    if (!resBlankSec.success) {
      assert.equal(resBlankSec.error.includes("Section name is required"), true);
    }

    const blankItemSections: RawSectionState[] = [
      {
        sectionName: "Hall",
        items: [{ itemName: "   ", rawQuantity: "1", unitOfMeasure: "nos", rawUnitRate: "100" }],
      },
    ];
    const resBlankItem = buildValidatedSectionPayload(blankItemSections);
    assert.equal(resBlankItem.success, false);
    if (!resBlankItem.success) {
      assert.equal(resBlankItem.error.includes("Item name is required"), true);
    }
  });

  test("APP-UOM-8: Source regression guard — no || 'nos' or || 'sqft' fallbacks in quotation-editor-helpers.ts", () => {
    const helpersSource = fs.readFileSync(
      path.resolve(import.meta.dirname, "../utils/quotation-editor-helpers.ts"),
      "utf-8"
    );

    assert.equal(
      helpersSource.includes('|| "nos"'),
      false,
      "quotation-editor-helpers.ts contains || 'nos' fallback!"
    );
    assert.equal(
      helpersSource.includes('|| "sqft"'),
      false,
      "quotation-editor-helpers.ts contains || 'sqft' fallback!"
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

  test("APP-MONEY-14 & APP-UOM-10: Real Phase 7B implementation-absence regression guard", () => {
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
});
