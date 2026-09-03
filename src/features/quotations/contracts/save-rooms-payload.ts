/**
 * The room-save payload the server action sends to `save_quotation_draft_items`.
 *
 * Extracted so the boundary itself is testable. It used to live inline in the
 * action and flatten every item to the old generic shape, dropping
 * `calculationBasis`, `widthFt` and `heightFt`. The basis then defaulted to
 * `quantity`, an AREA item arrived as quantity + sqft and a FIXED item as
 * quantity + fixed, and the RPC rejected both — neither could be saved through
 * the real application path at all, and no source-level assertion caught it.
 *
 * Area and line totals are never forwarded: the server derives them.
 */

import {
  validateAndFormatDimensionString,
  validateAndFormatPaiseInteger,
  validateAndFormatQuantityString,
} from "../server/quotation-decimal-utils.ts";
import type { QuotationSectionDTO } from "./types.ts";

export interface SaveRoomsItemPayload {
  readonly itemName: string;
  readonly description?: string | null;
  readonly specifications?: string | null;
  readonly calculationBasis: "area" | "quantity" | "fixed";
  readonly widthFt?: string;
  readonly heightFt?: string;
  readonly quantity?: string;
  readonly unitOfMeasure?: string;
  readonly unitRatePaise: number;
}

export interface SaveRoomsSectionPayload {
  readonly sectionName: string;
  readonly items: readonly SaveRoomsItemPayload[];
}

export function buildSaveRoomsPayload(
  sections: readonly QuotationSectionDTO[]
): readonly SaveRoomsSectionPayload[] {
  return sections.map((sec) => ({
    sectionName: sec.sectionName,
    items: sec.items.map((item): SaveRoomsItemPayload => {
      const basis = item.calculationBasis ?? "quantity";
      const unitRatePaise = validateAndFormatPaiseInteger(
        item.unitRatePaise,
        "Unit rate"
      );

      if (basis === "area") {
        return {
          itemName: item.itemName,
          description: item.description,
          specifications: item.specifications,
          calculationBasis: "area",
          // Dimensions are the ONLY inputs. The server derives the area, the
          // unit and the amount from them.
          widthFt: validateAndFormatDimensionString(item.widthFt, "Width (ft)"),
          heightFt: validateAndFormatDimensionString(item.heightFt, "Height (ft)"),
          unitRatePaise,
        };
      }

      if (basis === "fixed") {
        return {
          itemName: item.itemName,
          description: item.description,
          specifications: item.specifications,
          calculationBasis: "fixed",
          // No dimensions and no quantity: the server canonicalizes to one unit
          // at the fixed amount.
          unitRatePaise,
        };
      }

      return {
        itemName: item.itemName,
        description: item.description,
        specifications: item.specifications,
        calculationBasis: "quantity",
        quantity: validateAndFormatQuantityString(item.quantity),
        unitOfMeasure: item.unitOfMeasure,
        unitRatePaise,
      };
    }),
  }));
}
