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

/**
 * REQUIRED-FIELD HELPERS.
 *
 * This DTO backs a document a customer legally accepts, so it fails CLOSED.
 * The previous coercions turned every missing or malformed field into a
 * plausible-looking default - `undefined` became 0, an unparseable rate became
 * 0, an unknown basis became `quantity`, an absent tax profile became "Tax" -
 * which meant a read-model regression would have been shown to the client as a
 * complete, confident, and wrong quotation. Refusing to render is the only
 * safe failure here.
 */

function requiredString(value: unknown, field: string): string {
  const s = value == null ? "" : String(value).trim();
  if (!s) {
    throw new ClientQuotationContractError(`${field} is missing`);
  }
  return s;
}

/** Finite, integer, non-negative paise. Money is never a float here. */
function requiredMoney(value: unknown, field: string): number {
  if (value == null || (typeof value === "string" && !value.trim())) {
    throw new ClientQuotationContractError(`${field} is missing`);
  }
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    throw new ClientQuotationContractError(`${field} is not a number`);
  }
  if (!Number.isInteger(parsed)) {
    throw new ClientQuotationContractError(`${field} is not integer paise`);
  }
  if (parsed < 0) {
    throw new ClientQuotationContractError(`${field} is negative`);
  }
  return parsed;
}

function requiredNumber(
  value: unknown,
  field: string,
  opts: { readonly positive?: boolean } = {}
): number {
  if (value == null || (typeof value === "string" && !value.trim())) {
    throw new ClientQuotationContractError(`${field} is missing`);
  }
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    throw new ClientQuotationContractError(`${field} is not a number`);
  }
  if (opts.positive && parsed <= 0) {
    throw new ClientQuotationContractError(`${field} must be greater than zero`);
  }
  if (!opts.positive && parsed < 0) {
    throw new ClientQuotationContractError(`${field} is negative`);
  }
  return parsed;
}

function requiredArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new ClientQuotationContractError(`${field} is missing`);
  }
  return value;
}

function optionalStr(value: unknown): string | undefined {
  const s = value == null ? "" : String(value).trim();
  return s.length > 0 ? s : undefined;
}

function stringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

/**
 * `inclusions` and `exclusions` are text[]; `terms_and_conditions` is a single
 * TEXT column. Running the text one through an array-only helper silently
 * produced an empty list, so the client saw NO terms on the very page where
 * they accept them.
 *
 * Terms stay OPTIONAL: blank or null is a legitimate empty list, not a fault.
 */
function textOrList(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }
  const single = value == null ? "" : String(value).trim();
  return single.length > 0 ? [single] : [];
}

const CLIENT_BASES: readonly ClientQuotationBasis[] = ["area", "quantity", "fixed"];

function requiredBasis(value: unknown, field: string): ClientQuotationBasis {
  const raw = requiredString(value, field);
  const match = CLIENT_BASES.find((basis) => basis === raw);
  if (!match) {
    // Never silently fall back to `quantity`: an AREA row rendered as a
    // quantity row shows the client a measurement that is not what was priced.
    throw new ClientQuotationContractError(`${field} is not a known basis`);
  }
  return match;
}

/**
 * Maps the RPC payload onto the client DTO, refusing anything incomplete.
 *
 * Only genuinely optional commercial fields are tolerated as absent: title,
 * scope summary, client email, property address, item description and
 * specifications, terms, inclusions, exclusions, and the acceptance timestamp.
 */
export function mapClientQuotation(payload: unknown): ClientQuotation {
  if (!payload || typeof payload !== "object") {
    throw new ClientQuotationContractError("empty payload");
  }

  const data = payload as Record<string, unknown>;

  const rooms = requiredArray(data.sections, "sections").map((raw, roomIdx) => {
    const room = (raw ?? {}) as Record<string, unknown>;
    const roomLabel = `sections[${roomIdx}]`;

    const items = requiredArray(room.items, `${roomLabel}.items`).map((rawItem, itemIdx) => {
      const item = (rawItem ?? {}) as Record<string, unknown>;
      const label = `${roomLabel}.items[${itemIdx}]`;
      const basis = requiredBasis(item.calculation_basis, `${label}.calculation_basis`);

      let widthFt: number | null = null;
      let heightFt: number | null = null;
      let areaSqFt: number | null = null;

      if (basis === "area") {
        // An area row without its measurements cannot be shown at all: the
        // width x height that justifies the amount is the whole point.
        widthFt = requiredNumber(item.width_ft, `${label}.width_ft`, { positive: true });
        heightFt = requiredNumber(item.height_ft, `${label}.height_ft`, { positive: true });
        areaSqFt = requiredNumber(item.area_sqft, `${label}.area_sqft`, { positive: true });
      }

      return {
        id: requiredString(item.id, `${label}.id`),
        itemName: requiredString(item.item_name, `${label}.item_name`),
        description: optionalStr(item.description),
        specifications: optionalStr(item.specifications),
        calculationBasis: basis,
        widthFt,
        heightFt,
        areaSqFt,
        quantity: requiredNumber(item.quantity, `${label}.quantity`, { positive: true }),
        unitOfMeasure: requiredString(item.unit_of_measure, `${label}.unit_of_measure`),
        unitRatePaise: requiredMoney(item.unit_rate_paise, `${label}.unit_rate_paise`),
        lineTotalPaise: requiredMoney(item.line_total_paise, `${label}.line_total_paise`),
      } satisfies ClientQuotationItem;
    });

    return {
      id: requiredString(room.id, `${roomLabel}.id`),
      roomName: requiredString(room.section_name, `${roomLabel}.section_name`),
      subtotalPaise: requiredMoney(room.subtotal_paise, `${roomLabel}.subtotal_paise`),
      // Derived and summed server-side; a room of non-area work is legitimately 0.
      areaSubtotalSqFt: requiredNumber(
        room.area_subtotal_sqft ?? 0,
        `${roomLabel}.area_subtotal_sqft`
      ),
      items,
    } satisfies ClientQuotationRoom;
  });

  const paymentSchedule = (
    Array.isArray(data.payment_schedule) ? data.payment_schedule : []
  ).map((raw, idx) => {
    const ms = (raw ?? {}) as Record<string, unknown>;
    const label = `payment_schedule[${idx}]`;
    return {
      id: requiredString(ms.id, `${label}.id`),
      milestoneName: requiredString(ms.milestone_name, `${label}.milestone_name`),
      percentage:
        ms.percentage == null
          ? undefined
          : requiredNumber(ms.percentage, `${label}.percentage`),
      amountPaise: requiredMoney(ms.amount_paise, `${label}.amount_paise`),
    } satisfies ClientQuotationMilestone;
  });

  return {
    quotationId: requiredString(data.quotation_id, "quotation_id"),
    quotationVersionId: requiredString(data.quotation_version_id, "quotation_version_id"),
    quotationNumber: requiredString(data.quotation_number, "quotation_number"),
    versionNumber: requiredNumber(data.version_number, "version_number", { positive: true }),
    finalizedAt: requiredString(data.finalized_at, "finalized_at"),
    title: optionalStr(data.title),
    scopeSummary: optionalStr(data.scope_summary),
    clientName: requiredString(data.client_name, "client_name"),
    clientPhone: requiredString(data.client_phone, "client_phone"),
    clientEmail: optionalStr(data.client_email),
    propertyAddress: optionalStr(data.property_address),
    rooms,
    subtotalPaise: requiredMoney(data.subtotal_paise, "subtotal_paise"),
    discountTotalPaise: requiredMoney(data.discount_total_paise, "discount_total_paise"),
    taxableBasePaise: requiredMoney(data.taxable_base_paise, "taxable_base_paise"),
    // Frozen at finalization. There is deliberately NO "Tax" placeholder and no
    // 18% fallback: inventing a name or a rate the finalized record does not
    // carry would misstate what the client is agreeing to.
    taxProfileName: requiredString(data.tax_profile_name, "tax_profile_name"),
    taxRatePercentage: requiredNumber(data.tax_rate_percentage, "tax_rate_percentage"),
    taxTotalPaise: requiredMoney(data.tax_total_paise, "tax_total_paise"),
    grandTotalPaise: requiredMoney(data.grand_total_paise, "grand_total_paise"),
    paymentSchedule,
    inclusions: stringList(data.inclusions),
    exclusions: stringList(data.exclusions),
    termsAndConditions: textOrList(data.terms_and_conditions),
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
