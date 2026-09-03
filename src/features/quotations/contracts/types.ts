/**
 * Phase 7A — Commercial Quotation DTO Contracts
 */

/**
 * ONE interior work item.
 *
 * `quantity`, `unitOfMeasure`, `areaSqFt` and `lineTotalPaise` are all SERVER
 * outputs — for an area item the server derives them from the dimensions. They
 * are present here so a read model can show them, never so a client can set
 * them.
 */
export interface QuotationLineItemDTO {
  readonly id?: string;
  readonly itemName: string;
  readonly description?: string | null;
  readonly specifications?: string | null;
  readonly calculationBasis?: "area" | "quantity" | "fixed";
  /** Interior dimensions in FEET. Present only on the area basis. */
  readonly widthFt?: number | string | null;
  readonly heightFt?: number | string | null;
  /** Derived, never stored separately: area = width x height. */
  readonly areaSqFt?: number | string | null;
  readonly quantity: number | string;
  readonly unitOfMeasure: string;
  readonly unitRatePaise: number;
  readonly lineTotalPaise?: number;
  readonly displayOrder?: number;
}

/** A ROOM. `sectionName` is the room or area name. */
export interface QuotationSectionDTO {
  readonly id?: string;
  readonly sectionName: string;
  readonly displayOrder?: number;
  /** Total area of the area-basis work items in this room, in sq.ft. */
  readonly areaSubtotalSqFt?: number | string | null;
  readonly subtotalPaise?: number;
  readonly items: readonly QuotationLineItemDTO[];
}

export interface QuotationPaymentScheduleMilestoneDTO {
  readonly id?: string;
  readonly milestoneName: string;
  readonly milestoneOrder?: number;
  readonly percentage?: number | string | null;
  readonly amountPaise?: number | null;
}

export type PaymentScheduleMode = "percentage" | "amount";
export type QuotationDiscountType = "none" | "flat" | "percentage";

export interface QuotationTaxProfileDTO {
  readonly id: string;
  readonly code: string;
  readonly displayName: string;
  readonly ratePercentage: number;
  readonly isActive: boolean;
}

export interface QuotationVersionDTO {
  readonly id: string;
  readonly versionNumber: number;
  readonly lockVersion: number;
  /**
   * quotation_versions supports all three. The type omitted "finalized",
   * which is what allowed callers to treat "not draft" as finalized and
   * present a superseded ARCHIVED version as the live commercial record.
   */
  readonly status: "draft" | "finalized" | "archived";
  readonly isCurrentDraft: boolean;
  readonly title: string;
  readonly clientNameSnapshot?: string | null;
  readonly clientEmailSnapshot?: string | null;
  readonly clientPhoneSnapshot?: string | null;
  readonly propertyAddressSnapshot?: string | null;
  readonly scopeSummary?: string | null;
  readonly paymentScheduleMode?: PaymentScheduleMode | null;
  readonly subtotalPaise: number;
  readonly discountType: QuotationDiscountType;
  readonly discountValuePaise: number;
  readonly discountPercentage: number | string;
  readonly discountTotalPaise: number;
  readonly taxableBasePaise: number;
  readonly taxProfileId?: string | null;
  readonly taxRatePercentage?: number | null;
  readonly taxTotalPaise?: number | null;
  readonly grandTotalPaise?: number | null;
  readonly termsAndConditions?: string | null;
  readonly inclusions: readonly string[];
  readonly exclusions: readonly string[];
  /** Present once the version is finalized; the frozen commercial record. */
  readonly finalizedAt?: string | null;
  readonly finalizedContentSha256?: string | null;
  readonly taxProfileName?: string | null;
  readonly pdfStatus?: string | null;
  /**
   * Acceptance is a fact of `quotation_acceptances`. The version STAYS
   * `finalized` after acceptance, so it must never be inferred from the
   * version status or from the lead status.
   */
  readonly isAccepted?: boolean;
  readonly acceptedAt?: string | null;
  readonly acceptedByName?: string | null;
}

export interface QuotationDraftDTO {
  readonly quotationId: string;
  readonly leadId: string;
  readonly quotationNumber: string;
  readonly rootStatus: "active" | "archived";
  readonly version: QuotationVersionDTO | null;
  readonly sections: readonly QuotationSectionDTO[];
  readonly paymentSchedules: readonly QuotationPaymentScheduleMilestoneDTO[];
}

export interface CreateQuotationDraftResult {
  readonly quotationId: string;
  readonly versionId: string;
  readonly quotationNumber: string;
  readonly versionNumber: number;
  readonly lockVersion: number;
  readonly status: string;
  readonly idempotentReplay: boolean;
}

export interface QuotationTotalsSummaryDTO {
  readonly quotationId: string;
  readonly versionId: string;
  readonly lockVersion: number;
  readonly subtotalPaise: number;
  readonly discountTotalPaise: number;
  readonly taxableBasePaise: number;
  readonly taxTotalPaise?: number | null;
  readonly grandTotalPaise?: number | null;
}
