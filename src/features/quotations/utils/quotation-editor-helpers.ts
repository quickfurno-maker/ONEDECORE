/**
 * Phase 7A — Commercial Quotation UI Editor Helpers
 * Pure validation and payload construction helpers ensuring raw editor text and canonical paise remain separate.
 */

import { parseQuotationInrToPaiseExact } from "../contracts/money.ts";
import type {
  PaymentScheduleMode,
  QuotationLineItemDTO,
  QuotationPaymentScheduleMilestoneDTO,
  QuotationSectionDTO,
} from "../contracts/types.ts";
import {
  validateAndFormatPercentageString,
  validateAndFormatQuantityString,
} from "../server/quotation-decimal-utils.ts";

export interface RawMilestoneState {
  readonly id?: string;
  readonly milestoneName: string;
  readonly milestoneOrder?: number;
  readonly rawPercentage: string;
  readonly rawAmount: string;
}

export interface RawLineItemState {
  readonly id?: string;
  readonly itemName: string;
  readonly description?: string | null;
  readonly specifications?: string | null;
  readonly rawQuantity: string;
  readonly unitOfMeasure: string;
  readonly rawUnitRate: string;
  readonly displayOrder?: number;
}

export interface RawSectionState {
  readonly id?: string;
  readonly sectionName: string;
  readonly displayOrder?: number;
  readonly items: readonly RawLineItemState[];
}

export type HelperResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: string };

/**
 * Validates raw flat discount input string.
 * Returns exact paise integer or validation error message.
 * Never silently defaults invalid text to 0.
 */
export function validateFlatDiscountInput(rawInput: string): HelperResult<number> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { success: false, error: "Flat discount amount is required" };
  }

  const paise = parseQuotationInrToPaiseExact(trimmed);
  if (paise === null) {
    return {
      success: false,
      error: "Invalid flat discount amount (must be non-negative with max 2 decimal places)",
    };
  }

  return { success: true, data: paise };
}

/**
 * Validates raw discount percentage input string.
 * Returns exact percentage string or validation error message.
 */
export function validatePercentageDiscountInput(rawInput: string): HelperResult<string> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { success: false, error: "Discount percentage is required" };
  }

  try {
    const pctStr = validateAndFormatPercentageString(trimmed);
    return { success: true, data: pctStr };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid discount percentage";
    return { success: false, error: msg };
  }
}

/**
 * Validates raw payment schedule milestones and constructs canonical DTO payload.
 * Blocks submission if any amount or percentage input is invalid or blank.
 */
export function buildValidatedPaymentSchedulePayload(
  mode: PaymentScheduleMode,
  rawMilestones: readonly RawMilestoneState[]
): HelperResult<readonly QuotationPaymentScheduleMilestoneDTO[]> {
  if (rawMilestones.length === 0) {
    return { success: true, data: [] };
  }

  const validatedMilestones: QuotationPaymentScheduleMilestoneDTO[] = [];

  for (let idx = 0; idx < rawMilestones.length; idx++) {
    const m = rawMilestones[idx];
    const name = m.milestoneName.trim();
    if (!name) {
      return {
        success: false,
        error: `Milestone name is required for milestone ${idx + 1}`,
      };
    }
    if (name.length > 150) {
      return {
        success: false,
        error: `Milestone name for milestone ${idx + 1} cannot exceed 150 characters`,
      };
    }

    if (mode === "amount") {
      const trimmedAmount = m.rawAmount.trim();
      if (!trimmedAmount) {
        return {
          success: false,
          error: `Amount is required for milestone "${name}"`,
        };
      }
      const paise = parseQuotationInrToPaiseExact(trimmedAmount);
      if (paise === null) {
        return {
          success: false,
          error: `Invalid amount "${m.rawAmount}" for milestone "${name}" (max 2 decimal places)`,
        };
      }
      validatedMilestones.push({
        id: m.id,
        milestoneName: name,
        milestoneOrder: m.milestoneOrder ?? idx,
        percentage: null,
        amountPaise: paise,
      });
    } else {
      const trimmedPct = m.rawPercentage.trim();
      if (!trimmedPct) {
        return {
          success: false,
          error: `Percentage is required for milestone "${name}"`,
        };
      }
      try {
        const pctStr = validateAndFormatPercentageString(trimmedPct);
        validatedMilestones.push({
          id: m.id,
          milestoneName: name,
          milestoneOrder: m.milestoneOrder ?? idx,
          percentage: pctStr,
          amountPaise: null,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid percentage";
        return {
          success: false,
          error: `Invalid percentage "${m.rawPercentage}" for milestone "${name}": ${msg}`,
        };
      }
    }
  }

  return { success: true, data: validatedMilestones };
}

/**
 * Validates raw line item sections and constructs canonical DTO payload.
 * Blocks submission if any line item unit rate, quantity, UOM, section name, or item name is invalid or blank.
 * Never synthesizes default UOM ("nos", "sqft") or default names.
 */
export function buildValidatedSectionPayload(
  rawSections: readonly RawSectionState[]
): HelperResult<readonly QuotationSectionDTO[]> {
  const validatedSections: QuotationSectionDTO[] = [];

  for (let sIdx = 0; sIdx < rawSections.length; sIdx++) {
    const s = rawSections[sIdx];
    const secName = s.sectionName.trim();
    if (!secName) {
      return {
        success: false,
        error: `Section name is required for section ${sIdx + 1}`,
      };
    }
    if (secName.length > 150) {
      return {
        success: false,
        error: `Section name for section ${sIdx + 1} cannot exceed 150 characters`,
      };
    }

    const validatedItems: QuotationLineItemDTO[] = [];

    for (let iIdx = 0; iIdx < s.items.length; iIdx++) {
      const item = s.items[iIdx];
      const itemName = item.itemName.trim();
      if (!itemName) {
        return {
          success: false,
          error: `Item name is required in section "${secName}"`,
        };
      }
      if (itemName.length > 200) {
        return {
          success: false,
          error: `Item name "${itemName}" in section "${secName}" cannot exceed 200 characters`,
        };
      }

      // Validate Unit of Measure (UOM)
      const trimmedUom = item.unitOfMeasure.trim();
      if (!trimmedUom) {
        return {
          success: false,
          error: `Unit of measure is required for item "${itemName}" in section "${secName}"`,
        };
      }
      if (trimmedUom.length > 30) {
        return {
          success: false,
          error: `Unit of measure for item "${itemName}" in section "${secName}" cannot exceed 30 characters`,
        };
      }

      // Validate quantity
      const trimmedQty = item.rawQuantity.trim();
      if (!trimmedQty) {
        return {
          success: false,
          error: `Quantity is required for item "${itemName}" in section "${secName}"`,
        };
      }
      let validQty: string;
      try {
        validQty = validateAndFormatQuantityString(trimmedQty);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid quantity";
        return {
          success: false,
          error: `Invalid quantity "${item.rawQuantity}" for item "${itemName}" in section "${secName}": ${msg}`,
        };
      }

      // Validate unit rate
      const trimmedRate = item.rawUnitRate.trim();
      if (!trimmedRate) {
        return {
          success: false,
          error: `Unit rate is required for item "${itemName}" in section "${secName}"`,
        };
      }
      const paise = parseQuotationInrToPaiseExact(trimmedRate);
      if (paise === null) {
        return {
          success: false,
          error: `Invalid unit rate "${item.rawUnitRate}" for item "${itemName}" in section "${secName}" (max 2 decimal places)`,
        };
      }

      validatedItems.push({
        id: item.id,
        itemName,
        description: item.description ?? null,
        specifications: item.specifications ?? null,
        quantity: validQty,
        unitOfMeasure: trimmedUom,
        unitRatePaise: paise,
        displayOrder: item.displayOrder ?? iIdx,
      });
    }

    validatedSections.push({
      id: s.id,
      sectionName: secName,
      displayOrder: s.displayOrder ?? sIdx,
      items: validatedItems,
    });
  }

  return { success: true, data: validatedSections };
}
