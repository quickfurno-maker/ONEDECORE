import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getQuotationFinalizationReadiness } from "../contracts/finalization-readiness.ts";

const baseDraft = {
  quotationId: "q1", leadId: "l1", quotationNumber: "OD-Q-2026-000001", rootStatus: "active" as const,
  version: {
    id: "v1", versionNumber: 1, lockVersion: 1, status: "draft" as const, isCurrentDraft: true,
    title: "Interior estimate", clientNameSnapshot: "Test Client", clientPhoneSnapshot: "+919999999999",
    subtotalPaise: 100000, discountType: "none" as const, discountValuePaise: 0, discountPercentage: 0,
    discountTotalPaise: 0, taxableBasePaise: 100000, taxProfileId: "tax1", taxRatePercentage: 18,
    taxTotalPaise: 18000, grandTotalPaise: 118000, paymentScheduleMode: "percentage" as const,
    inclusions: [], exclusions: [],
  },
  sections: [{ sectionName: "Kitchen", items: [{ itemName: "Carcass", calculationBasis: "area" as const, widthFt: 10, heightFt: 2, quantity: 20, unitOfMeasure: "sqft", unitRatePaise: 5000 }] }],
  paymentSchedules: [{ milestoneName: "Advance", percentage: 50 }, { milestoneName: "Completion", percentage: 50 }],
};
const taxes = [{ id: "tax1", code: "TEST", displayName: "Test tax", ratePercentage: 18, isActive: true }];

test("finalization readiness is green only when commercial prerequisites are complete", () => {
  const result = getQuotationFinalizationReadiness(baseDraft, taxes, 10);
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test("finalization readiness names owner-governance blockers", () => {
  const result = getQuotationFinalizationReadiness({ ...baseDraft, version: { ...baseDraft.version!, taxProfileId: null } }, [], null);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((item) => item.includes("maximum discount")));
  assert.ok(result.blockers.some((item) => item.includes("tax profile")));
});

test("finalization readiness catches empty work and broken payment percentages", () => {
  const result = getQuotationFinalizationReadiness({ ...baseDraft, sections: [], paymentSchedules: [{ milestoneName: "Advance", percentage: 90 }] }, taxes, 10);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some((item) => item.includes("work item")));
  assert.ok(result.blockers.some((item) => item.includes("100%")));
});

test("commercial settings refresh server truth after successful governance writes", () => {
  const source = readFileSync(
    join(process.cwd(), "src/features/quotations/components/QuotationCommercialSettingsAdmin.tsx"),
    "utf8"
  );
  assert.match(source, /useRouter/);
  assert.equal(
    (source.match(/router\.refresh\(\)/g) ?? []).length,
    3,
    "max-discount save, tax-profile create and activation toggle must each refresh server props"
  );
});
