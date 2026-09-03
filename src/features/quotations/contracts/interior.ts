/**
 * ONEDECORE interior room-wise quotation contract.
 *
 * ONEDECORE is an interior design and execution business, so its quotation is a
 * ROOM-WISE ESTIMATE, not a generic line-item builder:
 *
 *   Room -> work item -> width(ft) x height(ft) -> area(sq.ft) -> rate -> amount
 *
 * ARITHMETIC
 * ----------
 * Every number here is integer arithmetic. Feet are held as integer MILLI-FEET
 * and money as integer paise, because `10.5 * 2.5` happening to be exact in
 * IEEE-754 is luck, not a guarantee — `0.1 * 0.3` is not. The server is
 * authoritative regardless; this module exists so the browser preview agrees
 * with it exactly rather than approximately.
 *
 * Rounding is half-up on non-negative values, matching Postgres `round()` on
 * numeric, so the preview and `save_quotation_draft_items` cannot disagree.
 */

/** The three bases ONEDECORE quotes on. Deliberately not a formula engine. */
export const QUOTATION_CALCULATION_BASES = ["area", "quantity", "fixed"] as const;

export type QuotationCalculationBasis = (typeof QUOTATION_CALCULATION_BASES)[number];

/** Area is the primary interior mode, so it is what a new work item starts as. */
export const DEFAULT_CALCULATION_BASIS: QuotationCalculationBasis = "area";

export function isQuotationCalculationBasis(
  value: string
): value is QuotationCalculationBasis {
  return (QUOTATION_CALCULATION_BASES as readonly string[]).includes(value);
}

/** Canonical unit for area work items. The server sets it; the UI never asks. */
export const AREA_UNIT_OF_MEASURE = "sqft";

/** Canonical unit for lump-sum work items. */
export const FIXED_UNIT_OF_MEASURE = "fixed";

/**
 * Units for count-based interior items. Deliberately short: this is hardware
 * and accessories, not a universal billing catalogue.
 */
export const INTERIOR_QUANTITY_UNITS = ["nos", "set", "pair", "unit"] as const;

export type InteriorQuantityUnit = (typeof INTERIOR_QUANTITY_UNITS)[number];

/**
 * Fast room presets. NOT unique — a flat routinely has several bedrooms, so
 * "Bedroom 2" and "Bedroom 3" must both be possible, and a custom name is
 * always allowed.
 */
export const ONEDECORE_ROOM_PRESETS = [
  "Kitchen",
  "Living Room / Hall",
  "Master Bedroom",
  "Bedroom",
  "Guest Bedroom",
  "Kids Bedroom",
  "Study Room",
  "Dining",
  "Foyer / Entry",
  "Utility / Dry Balcony",
  "Mandir / Pooja",
  "Passage",
  "Other / Custom Room",
] as const;

/**
 * Work-item suggestions, with the basis each one is normally quoted on.
 *
 * These are typing shortcuts, not a catalogue and NOT a price list — rates are
 * always entered per quotation by authorized staff.
 */
export const ONEDECORE_WORK_ITEM_SUGGESTIONS: readonly {
  readonly label: string;
  readonly basis: QuotationCalculationBasis;
}[] = [
  { label: "Carcass", basis: "area" },
  { label: "Shutter", basis: "area" },
  { label: "Overhead", basis: "area" },
  { label: "Loft", basis: "area" },
  { label: "Wardrobe", basis: "area" },
  { label: "Study Table", basis: "area" },
  { label: "Study Unit", basis: "area" },
  { label: "Dressing", basis: "area" },
  { label: "Shoe Rack", basis: "area" },
  { label: "Mandir", basis: "area" },
  { label: "Partition", basis: "area" },
  { label: "TV Unit", basis: "fixed" },
  { label: "Sofa Back Moulding", basis: "fixed" },
  { label: "Rolling Shutter", basis: "fixed" },
  { label: "Tandem", basis: "quantity" },
  { label: "Hardware / Accessory", basis: "quantity" },
  { label: "Custom Item", basis: "area" },
];

// tsconfig targets ES2017, where the `0n` literal syntax is unavailable even
// though `lib: esnext` provides BigInt itself. These constants keep the exact
// integer arithmetic without changing the project-wide compilation target.
const ZERO = BigInt(0);
const TWO = BigInt(2);
const THOUSAND = BigInt(1000);
const MAX_QUANTITY_MILLI = BigInt(1000000000);

export const MAX_FEET_DECIMALS = 3;
export const MAX_FEET_VALUE = 10_000;

/** Up to 3 decimals, matching numeric(10,3) and the server-side regex. */
const FEET_PATTERN = /^\d+(\.\d{1,3})?$/;

/**
 * Parses a dimension into integer MILLI-FEET.
 *
 * Rejects rather than repairs: a blank, a negative, "10.5.5" or four decimals
 * is a typo, and quietly reinterpreting one would change what the client is
 * billed for.
 */
export function parseFeetToMilli(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!FEET_PATTERN.test(trimmed)) {
    return null;
  }

  const [whole, fraction = ""] = trimmed.split(".");
  const padded = (fraction + "000").slice(0, MAX_FEET_DECIMALS);
  const milli = BigInt(whole) * THOUSAND + BigInt(padded);

  if (milli <= ZERO || milli > BigInt(MAX_FEET_VALUE) * THOUSAND) {
    return null;
  }
  return milli;
}

/** Same shape for a count-based quantity: up to 3 decimals, integer milli-units. */
export function parseQuantityToMilli(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!FEET_PATTERN.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const padded = (fraction + "000").slice(0, 3);
  const milli = BigInt(whole) * THOUSAND + BigInt(padded);
  if (milli <= ZERO || milli > MAX_QUANTITY_MILLI) {
    return null;
  }
  return milli;
}

/** Half-up division for non-negative integers, matching Postgres round(). */
function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * TWO + denominator) / (denominator * TWO);
}

/**
 * area(sq.ft) = width(ft) x height(ft), to 3 decimals, in integer milli-sq.ft.
 *
 * Mirrors `private.quotation_derive_area_sqft` exactly. Both inputs are
 * milli-feet, so their product is in micro-sq.ft and is divided back down.
 */
export function deriveAreaMilliSqFt(widthMilli: bigint, heightMilli: bigint): bigint {
  return divideRoundHalfUp(widthMilli * heightMilli, THOUSAND);
}

/** amount = round(quantity x rate). Quantity is milli-units, rate is paise. */
export function computeLineTotalPaiseFromMilli(
  quantityMilli: bigint,
  unitRatePaise: bigint
): bigint {
  return divideRoundHalfUp(quantityMilli * unitRatePaise, THOUSAND);
}

/** Renders integer milli-units as a decimal string with `decimals` places. */
export function formatMilli(value: bigint, decimals: number): string {
  const whole = value / THOUSAND;
  const fraction = (value % THOUSAND).toString().padStart(3, "0");
  if (decimals <= 0) {
    return whole.toString();
  }
  return `${whole}.${fraction.slice(0, decimals)}`;
}

/**
 * Trims trailing zeros without hiding a real digit.
 *
 * Truncating to 2 decimals was wrong: an area stored as 1.234 displayed as
 * "1.23", so the visible width x height no longer produced the visible amount
 * and the document appeared to contradict itself. Up to 3 decimals are shown,
 * and only zeros are dropped.
 *
 *   10.500 -> 10.5    2.500 -> 2.5    78.750 -> 78.75    1.234 -> 1.234
 */
export function trimTrailingZeros(decimalString: string): string {
  if (!decimalString.includes(".")) {
    return decimalString;
  }
  return decimalString.replace(/0+$/, "").replace(/\.$/, "");
}

/** Formats a number that may carry up to 3 meaningful decimals. */
export function formatMeasureDisplay(value: number, maxDecimals = 3): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  return trimTrailingZeros(value.toFixed(maxDecimals));
}

/** Area for display: every stored decimal stays visible. */
export function formatAreaSqFt(areaMilli: bigint): string {
  return trimTrailingZeros(formatMilli(areaMilli, 3));
}

/** The canonical 3-decimal string the server stores as `quantity`. */
export function formatMilliCanonical(value: bigint): string {
  return formatMilli(value, 3);
}

export type InteriorLineResult =
  | {
      readonly ok: true;
      /** Canonical 3-decimal quantity string the server will persist. */
      readonly quantity: string;
      readonly unitOfMeasure: string;
      readonly lineTotalPaise: number;
      /** Present only for the area basis. */
      readonly areaMilliSqFt?: bigint;
    }
  | { readonly ok: false; readonly message: string };

/**
 * Computes one work item exactly as the server will.
 *
 * This is a PREVIEW. `save_quotation_draft_items` recomputes from the same
 * inputs and its answer is the one that is stored — which is why area and
 * amount are never accepted from the client at all.
 */
export function computeInteriorLine(input: {
  readonly basis: QuotationCalculationBasis;
  readonly rawWidthFt?: string;
  readonly rawHeightFt?: string;
  readonly rawQuantity?: string;
  readonly unitOfMeasure?: string;
  readonly unitRatePaise: number;
}): InteriorLineResult {
  const rate = BigInt(Math.trunc(input.unitRatePaise));
  if (rate < ZERO) {
    return { ok: false, message: "Rate cannot be negative." };
  }

  if (input.basis === "area") {
    const width = parseFeetToMilli(input.rawWidthFt ?? "");
    if (width === null) {
      return { ok: false, message: "Enter a width in feet greater than zero (up to 3 decimals)." };
    }
    const height = parseFeetToMilli(input.rawHeightFt ?? "");
    if (height === null) {
      return { ok: false, message: "Enter a height in feet greater than zero (up to 3 decimals)." };
    }

    const areaMilli = deriveAreaMilliSqFt(width, height);
    if (areaMilli <= ZERO) {
      return { ok: false, message: "Derived area must be greater than zero." };
    }

    return {
      ok: true,
      quantity: formatMilliCanonical(areaMilli),
      unitOfMeasure: AREA_UNIT_OF_MEASURE,
      lineTotalPaise: Number(computeLineTotalPaiseFromMilli(areaMilli, rate)),
      areaMilliSqFt: areaMilli,
    };
  }

  if (input.basis === "fixed") {
    // Canonicalized to one unit at the fixed amount, so the database's
    // line_total = round(quantity * rate) invariant still holds.
    return {
      ok: true,
      quantity: "1.000",
      unitOfMeasure: FIXED_UNIT_OF_MEASURE,
      lineTotalPaise: Number(rate),
    };
  }

  const unit = (input.unitOfMeasure ?? "").trim();
  if (unit.length === 0) {
    return { ok: false, message: "Choose a unit." };
  }
  if (unit.toLowerCase() === AREA_UNIT_OF_MEASURE || unit.toLowerCase() === FIXED_UNIT_OF_MEASURE) {
    return { ok: false, message: "Use the area or fixed basis for that unit." };
  }

  const quantity = parseQuantityToMilli(input.rawQuantity ?? "");
  if (quantity === null) {
    return { ok: false, message: "Enter a quantity greater than zero (up to 3 decimals)." };
  }

  return {
    ok: true,
    quantity: formatMilliCanonical(quantity),
    unitOfMeasure: unit,
    lineTotalPaise: Number(computeLineTotalPaiseFromMilli(quantity, rate)),
  };
}

/**
 * Fields that stop being meaningful when the basis changes.
 *
 * Switching a work item from area to quantity must not leave a stale width
 * behind — the database refuses it, and leaving it in the form would let an
 * operator believe a measurement is still being billed when it is not.
 */
export function clearIrrelevantBasisFields(basis: QuotationCalculationBasis): {
  readonly rawWidthFt: string;
  readonly rawHeightFt: string;
  readonly rawQuantity: string;
  readonly unitOfMeasure: string;
} {
  if (basis === "area") {
    return { rawWidthFt: "", rawHeightFt: "", rawQuantity: "", unitOfMeasure: AREA_UNIT_OF_MEASURE };
  }
  if (basis === "fixed") {
    return { rawWidthFt: "", rawHeightFt: "", rawQuantity: "", unitOfMeasure: FIXED_UNIT_OF_MEASURE };
  }
  return { rawWidthFt: "", rawHeightFt: "", rawQuantity: "", unitOfMeasure: "nos" };
}
