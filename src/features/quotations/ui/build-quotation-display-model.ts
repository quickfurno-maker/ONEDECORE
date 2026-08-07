/**
 * Maps domain calculation output to UI display model.
 */

import type { QuotationCalculationInput, QuotationCalculationResult } from "../contracts/calculation.ts";
import type { QuotationDisplayModel } from "../contracts/display.ts";
import { isQuotationReadOnlyState, type QuotationLifecycleState } from "../contracts/lifecycle.ts";
import type { QuotationRevisionRef } from "../contracts/reference.ts";
import { formatInrFromPaise } from "../contracts/money.ts";
import { formatQuantityFromMilli } from "../domain/format.ts";

export function buildQuotationDisplayModel(args: {
  revision: QuotationRevisionRef;
  lifecycleState: QuotationLifecycleState;
  clientName: string;
  projectLabel: string | null;
  input: QuotationCalculationInput;
  calculation: QuotationCalculationResult;
}): QuotationDisplayModel {
  const lineMap = new Map(
    args.calculation.lineCalculations.map((line) => [line.lineItemId, line.subtotalPaise])
  );

  return {
    revision: args.revision,
    lifecycleState: args.lifecycleState,
    clientName: args.clientName,
    projectLabel: args.projectLabel,
    lineItems: args.input.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      unit: item.unit,
      quantityLabel: formatQuantityFromMilli(item.quantityMilli),
      unitPriceLabel: formatInrFromPaise(item.unitPricePaise),
      subtotalLabel: formatInrFromPaise(lineMap.get(item.id) ?? 0),
    })),
    calculation: args.calculation,
    subtotalLabel: formatInrFromPaise(args.calculation.subtotalPaise),
    discountLabel: formatInrFromPaise(args.calculation.discountAmountPaise),
    taxableBaseLabel: formatInrFromPaise(args.calculation.taxableBasePaise),
    taxLabel: formatInrFromPaise(args.calculation.tax.taxAmountPaise),
    grandTotalLabel: formatInrFromPaise(args.calculation.grandTotalPaise),
    stateBanner: lifecycleBanner(args.lifecycleState),
    isReadOnly: isQuotationReadOnlyState(args.lifecycleState),
  };
}

function lifecycleBanner(state: QuotationLifecycleState): string | null {
  switch (state) {
    case "draft":
      return "Draft — prebuild only, not persisted";
    case "finalized":
      return "Finalized — read-only customer snapshot";
    case "superseded":
      return "Superseded by a newer revision";
    case "accepted":
      return "Accepted by client";
    case "rejected":
      return "Rejected by client";
    case "revision_requested":
      return "Client requested a revision";
    case "expired":
      return "Validity expired";
    default:
      return null;
  }
}
