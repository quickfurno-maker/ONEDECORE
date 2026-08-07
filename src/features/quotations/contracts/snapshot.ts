/**
 * Immutable customer-visible quotation snapshot contract.
 */

import type { QuotationCalculationResult } from "./calculation.ts";
import type { QuotationLifecycleState } from "./lifecycle.ts";
import type { QuotationLineItemDraft } from "./line-item.ts";
import type { QuotationCurrency } from "./money.ts";
import type { QuotationRevisionRef } from "./reference.ts";

export interface QuotationPartySnapshot {
  readonly displayName: string;
  readonly phoneMasked: string | null;
  readonly emailMasked: string | null;
}

export interface QuotationSiteSnapshot {
  readonly label: string;
  readonly city: string | null;
}

export interface QuotationFinalSnapshot {
  readonly revision: QuotationRevisionRef;
  readonly lifecycleState: QuotationLifecycleState;
  readonly currency: QuotationCurrency;
  readonly client: QuotationPartySnapshot;
  readonly site: QuotationSiteSnapshot | null;
  readonly lineItems: readonly QuotationLineItemDraft[];
  readonly calculation: QuotationCalculationResult;
  readonly scopeSummary: string | null;
  readonly inclusions: readonly string[];
  readonly exclusions: readonly string[];
  readonly termsText: string;
  readonly validityEndsOn: string;
  readonly warrantyText: string | null;
  readonly contentHash: string;
  readonly finalizedAt: string;
  readonly brand: {
    readonly documentTitle: string;
    readonly footerNote: string;
  };
}
