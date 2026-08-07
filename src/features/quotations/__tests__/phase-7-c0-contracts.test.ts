/**
 * Phase 7 C0 — shared quotation domain contract tests.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertDiscountBasisPoints,
  assertMoneyPaise,
  assertQuantityMilli,
  assertTaxRateBasisPoints,
  isQuotationReadOnlyState,
  QUOTATION_CALCULATION_ALGORITHM_ID,
  QUOTATION_CLIENT_DECISIONS,
  QUOTATION_LIFECYCLE_STATES,
  validateClientDecisionNote,
  validateQuotationReference,
  validateRevisionNumber,
} from "../contracts/index.ts";

describe("Phase 7 C0 quotation contracts", () => {
  test("lifecycle states exclude internal approval", () => {
    assert.equal(QUOTATION_LIFECYCLE_STATES.includes("draft"), true);
    assert.equal(QUOTATION_LIFECYCLE_STATES.includes("finalized"), true);
    assert.equal(
      (QUOTATION_LIFECYCLE_STATES as readonly string[]).includes("submitted_for_approval"),
      false
    );
    assert.equal(
      (QUOTATION_LIFECYCLE_STATES as readonly string[]).includes("approved"),
      false
    );
  });

  test("read-only states include finalized and accepted", () => {
    assert.equal(isQuotationReadOnlyState("draft"), false);
    assert.equal(isQuotationReadOnlyState("finalized"), true);
    assert.equal(isQuotationReadOnlyState("accepted"), true);
  });

  test("money paise rejects non-integers", () => {
    assert.throws(() => assertMoneyPaise(10.5));
    assert.equal(assertMoneyPaise(0), 0);
    assert.equal(assertMoneyPaise(12_345), 12_345);
  });

  test("quantity milli bounds", () => {
    assert.equal(assertQuantityMilli(1000), 1000);
    assert.throws(() => assertQuantityMilli(0));
  });

  test("discount bps bounds", () => {
    assert.equal(assertDiscountBasisPoints(0), 0);
    assert.equal(assertDiscountBasisPoints(5000), 5000);
    assert.throws(() => assertDiscountBasisPoints(5001));
  });

  test("tax rate bps bounds", () => {
    assert.equal(assertTaxRateBasisPoints(1800), 1800);
    assert.throws(() => assertTaxRateBasisPoints(10001));
  });

  test("reference and revision validation", () => {
    assert.equal(validateQuotationReference("OD"), "Reference must be at least 3 characters.");
    assert.equal(validateQuotationReference("OD-Q-2026-0001"), null);
    assert.equal(validateRevisionNumber(1), null);
    assert.equal(validateRevisionNumber(0), "Revision number must be an integer between 1 and 9999.");
  });

  test("client decision note rules", () => {
    assert.equal(validateClientDecisionNote("accept", null), null);
    assert.equal(
      validateClientDecisionNote("reject", "short"),
      "Note must be at least 10 characters."
    );
    assert.equal(
      validateClientDecisionNote("request_revision", "Please revise kitchen scope."),
      null
    );
  });

  test("client decision enum is frozen", () => {
    assert.deepEqual(QUOTATION_CLIENT_DECISIONS, [
      "accept",
      "reject",
      "request_revision",
    ]);
  });

  test("calculation algorithm id is stable", () => {
    assert.equal(QUOTATION_CALCULATION_ALGORITHM_ID, "onedecore-quotation-v1");
  });
});
