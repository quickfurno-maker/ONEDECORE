/**
 * Phase 7 Lane D — UI contract and adapter tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { createDomainQuotationCalculationAdapter } from "../adapters/quotation-calculation-adapter.ts";
import { buildQuotationDisplayModel } from "../ui/build-quotation-display-model.ts";
import {
  buildFinalSnapshotFixture,
  buildKitchenQuotationInput,
} from "../fixtures/synthetic-quotations.ts";
import { renderQuotationDocumentHtml } from "../pdf/render-quotation-document-html.ts";

const root = process.cwd();

describe("Phase 7 Lane D calculation adapter integration", () => {
  test("display model totals match domain engine", () => {
    const input = buildKitchenQuotationInput();
    const adapter = createDomainQuotationCalculationAdapter();
    const calculation = adapter.calculate(input);
    const model = buildQuotationDisplayModel({
      revision: {
        quotationReference: "OD-Q-TEST-0001",
        revisionNumber: 1,
        supersededByRevisionNumber: null,
      },
      lifecycleState: "draft",
      clientName: "Sample Client",
      projectLabel: "Test Project",
      input,
      calculation,
    });
    assert.equal(model.grandTotalLabel, "₹1,70,504");
    assert.equal(model.isReadOnly, false);
  });

  test("finalized state is read-only in display model", () => {
    const input = buildKitchenQuotationInput();
    const calculation = createDomainQuotationCalculationAdapter().calculate(input);
    const model = buildQuotationDisplayModel({
      revision: {
        quotationReference: "OD-Q-TEST-0002",
        revisionNumber: 2,
        supersededByRevisionNumber: null,
      },
      lifecycleState: "finalized",
      clientName: "Sample Client",
      projectLabel: null,
      input,
      calculation,
    });
    assert.equal(model.isReadOnly, true);
    assert.match(model.stateBanner ?? "", /read-only/i);
  });
});

describe("Phase 7 Lane D component contracts", () => {
  test("editor shell uses adapter and validation summary", () => {
    const src = readFileSync(
      join(root, "src/features/quotations/components/QuotationEditorShell.tsx"),
      "utf8"
    );
    assert.match(src, /adapter\.calculate/);
    assert.match(src, /QuotationValidationSummary/);
    assert.match(src, /readOnly = lifecycleState !== "draft"/);
    assert.doesNotMatch(src, /supabase/i);
  });

  test("client decision panel requires confirmation paths", () => {
    const src = readFileSync(
      join(root, "src/features/quotations/components/ClientDecisionPanel.tsx"),
      "utf8"
    );
    assert.match(src, /Accept quotation/);
    assert.match(src, /Request revision/);
    assert.match(src, /aria-live/);
    assert.match(src, /if \(pending\) return/);
  });

  test("document preview uses deterministic HTML renderer", () => {
    const snapshot = buildFinalSnapshotFixture(buildKitchenQuotationInput());
    const html = renderQuotationDocumentHtml(snapshot);
    assert.match(html, /ONEDECORE Quotation/);
    const previewSrc = readFileSync(
      join(root, "src/features/quotations/components/QuotationDocumentPreview.tsx"),
      "utf8"
    );
    assert.match(previewSrc, /renderQuotationDocumentHtml/);
    assert.match(previewSrc, /sandbox=""/);
  });

  test("no public quotation routes activated", () => {
    const paths = [
      "src/app/admin",
      "src/app/(public)",
      "src/app/page.tsx",
    ];
    for (const rel of paths) {
      try {
        readFileSync(join(root, rel), "utf8");
      } catch {
        // path may not exist — acceptable
      }
    }
    assert.equal(
      (() => {
        try {
          readFileSync(join(root, "src/app/quotations/page.tsx"), "utf8");
          return true;
        } catch {
          return false;
        }
      })(),
      false
    );
  });
});
