/**
 * Phase 7 Lane C — PDF renderer tests.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { renderQuotationDocumentHtml } from "../pdf/render-quotation-document-html.ts";
import {
  buildFinalSnapshotFixture,
  buildKitchenQuotationInput,
} from "../fixtures/synthetic-quotations.ts";

describe("Phase 7 Lane C PDF renderer", () => {
  test("renders deterministic HTML sections", () => {
    const snapshot = buildFinalSnapshotFixture(buildKitchenQuotationInput());
    const html = renderQuotationDocumentHtml(snapshot);
    assert.match(html, /ONEDECORE Quotation/);
    assert.match(html, /OD-Q-2026-SYN-0001/);
    assert.match(html, /Modular kitchen base units/);
    assert.match(html, /Grand total/);
    assert.match(html, /₹/);
    assert.doesNotMatch(html, /undefined/);
  });

  test("stable section order across renders", () => {
    const snapshot = buildFinalSnapshotFixture(buildKitchenQuotationInput(), "accepted");
    const first = renderQuotationDocumentHtml(snapshot);
    const second = renderQuotationDocumentHtml(snapshot);
    assert.equal(first, second);
  });

  test("long multi-item document includes all rows", () => {
    const snapshot = buildFinalSnapshotFixture({
      ...buildKitchenQuotationInput(),
      lineItems: Array.from({ length: 12 }, (_, index) => ({
        ...buildKitchenQuotationInput().lineItems[0],
        id: `row-${index}`,
        description: `Scope line ${index + 1}`,
        sortOrder: index + 1,
      })),
    });
    const html = renderQuotationDocumentHtml(snapshot);
    assert.match(html, /Scope line 12/);
  });
});
