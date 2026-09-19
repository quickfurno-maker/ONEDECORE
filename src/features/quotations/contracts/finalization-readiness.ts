import type { QuotationDraftDTO, QuotationTaxProfileDTO } from "./types";

export interface QuotationFinalizationReadiness {
  readonly ready: boolean;
  readonly blockers: readonly string[];
}

export function getQuotationFinalizationReadiness(
  draft: QuotationDraftDTO,
  taxProfiles: readonly QuotationTaxProfileDTO[],
  maxDiscountPercentage: number | null
): QuotationFinalizationReadiness {
  const version = draft.version;
  if (!version || version.status !== "draft") {
    return { ready: false, blockers: ["Only the current draft version can be finalized."] };
  }

  const blockers: string[] = [];
  if (!version.clientNameSnapshot?.trim()) blockers.push("Client name is missing from the quotation snapshot.");
  if (!version.clientPhoneSnapshot?.trim()) blockers.push("Client phone is missing from the quotation snapshot.");
  if (!version.title?.trim()) blockers.push("Quotation title is required.");

  const itemCount = draft.sections.reduce((total, room) => total + room.items.length, 0);
  if (itemCount === 0) blockers.push("Add at least one room work item.");

  if (maxDiscountPercentage == null) {
    blockers.push("Super Admin maximum discount governance is not configured.");
  } else if (version.discountType === "percentage" && Number(version.discountPercentage) > maxDiscountPercentage) {
    blockers.push(`Discount exceeds the configured ${maxDiscountPercentage}% maximum.`);
  } else if (version.discountType === "flat" && version.subtotalPaise > 0) {
    const effective = (version.discountTotalPaise * 100) / version.subtotalPaise;
    if (effective > maxDiscountPercentage) blockers.push(`Flat discount exceeds the configured ${maxDiscountPercentage}% maximum.`);
  }

  if (!version.taxProfileId) {
    blockers.push("Select an active tax profile.");
  } else if (!taxProfiles.some((profile) => profile.id === version.taxProfileId && profile.isActive)) {
    blockers.push("The selected tax profile is inactive or unavailable.");
  }

  if (draft.paymentSchedules.length === 0 || !version.paymentScheduleMode) {
    blockers.push("Add a payment schedule.");
  } else if (version.paymentScheduleMode === "percentage") {
    const total = draft.paymentSchedules.reduce((sum, row) => sum + Number(row.percentage ?? 0), 0);
    if (Math.abs(total - 100) > 0.000001) blockers.push("Payment schedule percentages must total exactly 100%.");
  } else if (version.paymentScheduleMode === "amount" && version.grandTotalPaise != null) {
    const total = draft.paymentSchedules.reduce((sum, row) => sum + Number(row.amountPaise ?? 0), 0);
    if (total !== version.grandTotalPaise) blockers.push("Payment schedule amounts must equal the grand total.");
  }

  return { ready: blockers.length === 0, blockers };
}
