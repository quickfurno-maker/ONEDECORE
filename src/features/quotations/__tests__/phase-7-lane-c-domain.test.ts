/**
 * Phase 7 Lane C — calculation engine and lifecycle tests.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { calculateQuotation } from "../domain/calculate-quotation.ts";
import { canTransitionQuotationLifecycle } from "../domain/lifecycle-transitions.ts";
import { validateQuotationCalculationInput } from "../domain/validate-quotation-input.ts";
import {
  buildKitchenQuotationInput,
  buildLongMultiItemInput,
  buildWardrobeQuotationInput,
} from "../fixtures/synthetic-quotations.ts";

describe("Phase 7 Lane C calculation engine", () => {
  test("kitchen quotation golden totals", () => {
    const result = calculateQuotation(buildKitchenQuotationInput());
    assert.equal(result.subtotalPaise, 15_210_000);
    assert.equal(result.discountAmountPaise, 760_500);
    assert.equal(result.taxableBasePaise, 14_449_500);
    assert.equal(result.tax.taxAmountPaise, 2_600_910);
    assert.equal(result.grandTotalPaise, 17_050_410);
  });

  test("wardrobe quotation with zero discount", () => {
    const result = calculateQuotation(buildWardrobeQuotationInput());
    assert.equal(result.discountAmountPaise, 0);
    assert.equal(result.taxableBasePaise, result.subtotalPaise);
  });

  test("deterministic same input same output", () => {
    const input = buildKitchenQuotationInput();
    const a = calculateQuotation(input);
    const b = calculateQuotation(input);
    assert.deepEqual(a, b);
  });

  test("invalid discount rejected", () => {
    const input = buildKitchenQuotationInput();
    const invalid = {
      ...input,
      discount: { discountBps: 9_999 as never },
    };
    const validation = validateQuotationCalculationInput(invalid);
    assert.equal(validation.ok, false);
    assert.throws(() => calculateQuotation(invalid));
  });

  test("empty line items rejected", () => {
    const input = {
      ...buildKitchenQuotationInput(),
      lineItems: [],
    };
    assert.equal(validateQuotationCalculationInput(input).ok, false);
  });

  test("long multi-item quotation calculates", () => {
    const result = calculateQuotation(buildLongMultiItemInput());
    assert.equal(result.lineCalculations.length, 25);
    assert.ok(result.grandTotalPaise > result.subtotalPaise);
  });

  test("lifecycle excludes internal approval transitions", () => {
    assert.equal(canTransitionQuotationLifecycle("draft", "finalized"), true);
    assert.equal(
      canTransitionQuotationLifecycle("draft", "sent" as never),
      false
    );
    assert.equal(canTransitionQuotationLifecycle("accepted", "draft"), false);
  });
});
