/**
 * Phase 7A — Commercial Quotation DTO Contracts
 */

export interface QuotationLineItemDTO {
  readonly id?: string;
  readonly itemName: string;
  readonly description?: string | null;
  readonly specifications?: string | null;
  readonly quantity: number | string;
  readonly unitOfMeasure: string;
  readonly unitRatePaise: number;
  readonly lineTotalPaise?: number;
  readonly displayOrder?: number;
}

export interface QuotationSectionDTO {
  readonly id?: string;
  readonly sectionName: string;
  readonly displayOrder?: number;
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
  readonly status: "draft" | "archived";
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
