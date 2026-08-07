/**
 * Privacy-safe synthetic quotation fixtures for tests and UI prebuild.
 */

import { createHash } from "node:crypto";
import {
  assertMoneyPaise,
  assertQuantityMilli,
  type QuotationCalculationInput,
  type QuotationFinalSnapshot,
  type QuotationLineItemDraft,
  QUOTATION_CURRENCY,
} from "../contracts/index.ts";
import { calculateQuotation } from "../domain/calculate-quotation.ts";

function line(
  id: string,
  description: string,
  unit: string,
  quantityMilli: number,
  unitPricePaise: number,
  sortOrder: number
): QuotationLineItemDraft {
  return {
    id,
    description,
    unit,
    quantityMilli: assertQuantityMilli(quantityMilli),
    unitPricePaise: assertMoneyPaise(unitPricePaise),
    sortOrder,
  };
}

export function buildKitchenQuotationInput(): QuotationCalculationInput {
  return {
    lineItems: [
      line("k1", "Modular kitchen base units", "rft", 24000, 280000, 1),
      line("k2", "Quartz countertop supply & install", "sqft", 42000, 95000, 2),
      line("k3", "Hardware and accessories package", "lump_sum", 1000, 4500000, 3),
    ],
    discount: { discountBps: 500 as never },
    tax: { taxRateBps: 1800 as never },
  };
}

export function buildWardrobeQuotationInput(): QuotationCalculationInput {
  return {
    lineItems: [
      line("w1", "Walk-in wardrobe sliding system", "sqft", 96000, 125000, 1),
      line("w2", "Internal accessories and lighting", "lump_sum", 1000, 1850000, 2),
    ],
    discount: { discountBps: 0 as never },
    tax: { taxRateBps: 1800 as never },
  };
}

export function buildLongMultiItemInput(): QuotationCalculationInput {
  const items: QuotationLineItemDraft[] = [];
  for (let index = 0; index < 25; index += 1) {
    items.push(
      line(
        `m${index}`,
        `Interior scope item ${index + 1} with detailed specification text`,
        "each",
        1000 + index * 100,
        150000 + index * 1000,
        index + 1
      )
    );
  }
  return {
    lineItems: items,
    discount: { discountBps: 250 as never },
    tax: { taxRateBps: 1800 as never },
  };
}

export function buildFinalSnapshotFixture(
  input: QuotationCalculationInput,
  lifecycleState: QuotationFinalSnapshot["lifecycleState"] = "finalized"
): QuotationFinalSnapshot {
  const calculation = calculateQuotation(input);
  const content = JSON.stringify({ input, calculation });
  return {
    revision: {
      quotationReference: "OD-Q-2026-SYN-0001",
      revisionNumber: 1,
      supersededByRevisionNumber: null,
    },
    lifecycleState,
    currency: QUOTATION_CURRENCY,
    client: {
      displayName: "Sample Client A",
      phoneMasked: "+91 ***** **42",
      emailMasked: "c***@example.test",
    },
    site: {
      label: "Residence — Sector 57",
      city: "Gurugram",
    },
    lineItems: input.lineItems,
    calculation,
    scopeSummary: "Premium interior scope for synthetic testing only.",
    inclusions: ["Site protection", "Standard installation"],
    exclusions: ["Civil alterations", "Appliance supply"],
    termsText: "Indicative commercial terms for prebuild testing. Not a live quotation.",
    validityEndsOn: "2026-09-07",
    warrantyText: "Warranty references follow governed catalogue when live.",
    contentHash: createHash("sha256").update(content).digest("hex"),
    finalizedAt: "2026-08-07T12:00:00.000Z",
    brand: {
      documentTitle: "ONEDECORE Quotation",
      footerNote: "Migration-independent prebuild document — not customer delivery.",
    },
  };
}
