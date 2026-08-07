/**
 * UI-facing display model — derived from domain contracts, not authoritative truth.
 */

import type { QuotationCalculationResult } from "./calculation.ts";
import type { QuotationLifecycleState } from "./lifecycle.ts";
import type { QuotationLineItemDraft } from "./line-item.ts";
import type { QuotationRevisionRef } from "./reference.ts";

export interface QuotationDisplayLineItem {
  readonly id: string;
  readonly description: string;
  readonly unit: string;
  readonly quantityLabel: string;
  readonly unitPriceLabel: string;
  readonly subtotalLabel: string;
}

export interface QuotationDisplayModel {
  readonly revision: QuotationRevisionRef;
  readonly lifecycleState: QuotationLifecycleState;
  readonly clientName: string;
  readonly projectLabel: string | null;
  readonly lineItems: readonly QuotationDisplayLineItem[];
  readonly calculation: QuotationCalculationResult;
  readonly subtotalLabel: string;
  readonly discountLabel: string;
  readonly taxableBaseLabel: string;
  readonly taxLabel: string;
  readonly grandTotalLabel: string;
  readonly stateBanner: string | null;
  readonly isReadOnly: boolean;
}
