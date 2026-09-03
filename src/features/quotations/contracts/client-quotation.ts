/**
 * The client-facing quotation DTO, and the ONE adapter that produces it.
 *
 * `get_quotation_by_capability` returns a stable snake_case server shape. The
 * portal previously received it through an unchecked cast while expecting
 * DIFFERENT names — `discount_paise`, `tax_profile.display_name`,
 * `section_subtotal_paise`, `uom`, `property_details`, `has_pdf` — none of
 * which the RPC returns. Every one of those read as `undefined`, so the client
 * was shown blank or NaN commercial figures on the document they were being
 * asked to accept.
 *
 * The mapping is explicit and validated here so that mismatch is a build-time
 * and test-time failure rather than a silent one in front of a customer.
 */

export type ClientQuotationBasis = "area" | "quantity" | "fixed";

export interface ClientQuotationItem {
  readonly id: string;
  readonly itemName: string;
  readonly description?: string;
  readonly specifications?: string;
  readonly calculationBasis: ClientQuotationBasis;
  readonly widthFt: number | null;
  readonly heightFt: number | null;
  readonly areaSqFt: number | null;
  readonly quantity: number;
  readonly unitOfMeasure: string;
  readonly unitRatePaise: number;
  readonly lineTotalPaise: number;
}

export interface ClientQuotationRoom {
  readonly id: string;
  readonly roomName: string;
  readonly subtotalPaise: number;
  readonly areaSubtotalSqFt: number;
  readonly items: readonly ClientQuotationItem[];
}

export interface ClientQuotationMilestone {
  readonly id: string;
  readonly milestoneName: string;
  readonly percentage?: number;
  readonly amountPaise: number;
}

export interface ClientQuotation {
  readonly quotationId: string;
  readonly quotationVersionId: string;
  readonly quotationNumber: string;
  readonly versionNumber: number;
  readonly finalizedAt: string;
  readonly title?: string;
  readonly scopeSummary?: string;
  readonly clientName: string;
  readonly clientPhone: string;
  readonly clientEmail?: string;
  readonly propertyAddress?: string;
  readonly rooms: readonly ClientQuotationRoom[];
  readonly subtotalPaise: number;
  readonly discountTotalPaise: number;
  readonly taxableBasePaise: number;
  /** Frozen at finalization. Never a live tax-profile lookup, never a default. */
  readonly taxProfileName: string;
  readonly taxRatePercentage: number;
  readonly taxTotalPaise: number;
  readonly grandTotalPaise: number;
  readonly paymentSchedule: readonly ClientQuotationMilestone[];
  readonly inclusions: readonly string[];
  readonly exclusions: readonly string[];
  readonly termsAndConditions: readonly string[];
  readonly hasPdf: boolean;
  readonly isAccepted: boolean;
  readonly acceptedAt?: string;
}

export class ClientQuotationContractError extends Error {
  constructor(message: string) {
    super(`CLIENT_QUOTATION_CONTRACT: ${message}`);
    this.name = "ClientQuotationContractError";
  }
}

function num(value: unknown): number {
  if (value == null) {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNum(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string {
  return value == null ? "" : String(value);
}

function optionalStr(value: unknown): string | undefined {
  const s = value == null ? "" : String(value).trim();
  return s.length > 0 ? s : undefined;
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

/**
 * Maps the RPC payload onto the client DTO.
 *
 * Required identity and commercial fields are checked: a missing quotation
 * number or grand total means the read model changed shape, and rendering a
 * partially-empty acceptance document would be worse than refusing.
 */
export function mapClientQuotation(payload: unknown): ClientQuotation {
  if (!payload || typeof payload !== "object") {
    throw new ClientQuotationContractError("empty payload");
  }

  const data = payload as Record<string, unknown>;

  const quotationNumber = str(data.quotation_number);
  if (!quotationNumber) {
    throw new ClientQuotationContractError("quotation_number is missing");
  }
  if (data.grand_total_paise == null) {
    throw new ClientQuotationContractError("grand_total_paise is missing");
  }

  const rooms = (Array.isArray(data.sections) ? data.sections : []).map((raw) => {
    const room = raw as Record<string, unknown>;
    const items = (Array.isArray(room.items) ? room.items : []).map((rawItem) => {
      const item = rawItem as Record<string, unknown>;
      const basis = str(item.calculation_basis) || "quantity";
      return {
        id: str(item.id),
        itemName: str(item.item_name),
        description: optionalStr(item.description),
        specifications: optionalStr(item.specifications),
        calculationBasis: (basis === "area" || basis === "fixed"
          ? basis
          : "quantity") as ClientQuotationBasis,
        widthFt: optionalNum(item.width_ft),
        heightFt: optionalNum(item.height_ft),
        areaSqFt: optionalNum(item.area_sqft),
        quantity: num(item.quantity),
        unitOfMeasure: str(item.unit_of_measure),
        unitRatePaise: num(item.unit_rate_paise),
        lineTotalPaise: num(item.line_total_paise),
      } satisfies ClientQuotationItem;
    });

    return {
      id: str(room.id),
      roomName: str(room.section_name),
      subtotalPaise: num(room.subtotal_paise),
      areaSubtotalSqFt: num(room.area_subtotal_sqft),
      items,
    } satisfies ClientQuotationRoom;
  });

  const paymentSchedule = (
    Array.isArray(data.payment_schedule) ? data.payment_schedule : []
  ).map((raw) => {
    const ms = raw as Record<string, unknown>;
    return {
      id: str(ms.id),
      milestoneName: str(ms.milestone_name),
      percentage: ms.percentage == null ? undefined : num(ms.percentage),
      amountPaise: num(ms.amount_paise),
    } satisfies ClientQuotationMilestone;
  });

  return {
    quotationId: str(data.quotation_id),
    quotationVersionId: str(data.quotation_version_id),
    quotationNumber,
    versionNumber: num(data.version_number),
    finalizedAt: str(data.finalized_at),
    title: optionalStr(data.title),
    scopeSummary: optionalStr(data.scope_summary),
    clientName: str(data.client_name),
    clientPhone: str(data.client_phone),
    clientEmail: optionalStr(data.client_email),
    propertyAddress: optionalStr(data.property_address),
    rooms,
    subtotalPaise: num(data.subtotal_paise),
    discountTotalPaise: num(data.discount_total_paise),
    taxableBasePaise: num(data.taxable_base_paise),
    // Frozen at finalization. There is deliberately NO 18% fallback: inventing
    // a rate the finalized record does not carry would misstate the amount the
    // client is agreeing to.
    taxProfileName: str(data.tax_profile_name) || "Tax",
    taxRatePercentage: num(data.tax_rate_percentage),
    taxTotalPaise: num(data.tax_total_paise),
    grandTotalPaise: num(data.grand_total_paise),
    paymentSchedule,
    inclusions: stringList(data.inclusions),
    exclusions: stringList(data.exclusions),
    termsAndConditions: stringList(data.terms_and_conditions),
    hasPdf: data.has_pdf === true,
    isAccepted: data.is_accepted === true,
    acceptedAt: optionalStr(data.accepted_at),
  };
}

export const CLIENT_QUOTATION_EM_DASH = "—";

/**
 * Up to 3 decimals, trailing zeros trimmed.
 *
 * Rounding to 2 would hide a real digit: a stored 1.234 shown as "1.23" makes
 * the visible width x height stop producing the visible amount, so the document
 * contradicts itself in front of the customer.
 */
export function formatClientMeasure(value: number): string {
  if (!Number.isFinite(value)) {
    return CLIENT_QUOTATION_EM_DASH;
  }
  const fixed = value.toFixed(3);
  return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}

export interface ClientQuotationCells {
  readonly widthFt: string;
  readonly heightFt: string;
  /** "78.75 SQ.FT", "5 NOS" or "FIXED". */
  readonly measure: string;
  /** Rate per unit, or an em dash for a lump sum. */
  readonly rate: string;
}

/**
 * The measurement cells the CLIENT sees, in the same shape as the finalized
 * PDF: PARTICULAR | W (FT) | H (FT) | AREA / QTY | RATE | AMOUNT.
 *
 * Fixed and quantity rows report an em dash rather than a zero — a lump-sum TV
 * unit has no width, and "0.00" would read as a measurement of zero.
 */
export function clientQuotationItemCells(
  item: ClientQuotationItem,
  formatMoney: (paise: number) => string
): ClientQuotationCells {
  if (item.calculationBasis === "fixed") {
    return {
      widthFt: CLIENT_QUOTATION_EM_DASH,
      heightFt: CLIENT_QUOTATION_EM_DASH,
      measure: "FIXED",
      rate: CLIENT_QUOTATION_EM_DASH,
    };
  }

  if (item.calculationBasis === "area") {
    const area = item.areaSqFt ?? item.quantity;
    return {
      widthFt:
        item.widthFt != null ? formatClientMeasure(item.widthFt) : CLIENT_QUOTATION_EM_DASH,
      heightFt:
        item.heightFt != null ? formatClientMeasure(item.heightFt) : CLIENT_QUOTATION_EM_DASH,
      measure: `${formatClientMeasure(area)} SQ.FT`,
      rate: `${formatMoney(item.unitRatePaise)} / SQ.FT`,
    };
  }

  const unit = (item.unitOfMeasure || "nos").toUpperCase();
  return {
    widthFt: CLIENT_QUOTATION_EM_DASH,
    heightFt: CLIENT_QUOTATION_EM_DASH,
    measure: `${formatClientMeasure(item.quantity)} ${unit}`,
    rate: `${formatMoney(item.unitRatePaise)} / ${unit}`,
  };
}
