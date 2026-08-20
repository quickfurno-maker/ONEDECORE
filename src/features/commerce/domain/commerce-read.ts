export const COMMERCE_READ_UNAVAILABLE = "COMMERCE_READ_UNAVAILABLE" as const;

export class CommerceReadError extends Error {
  readonly code = COMMERCE_READ_UNAVAILABLE;
  readonly context: string;

  constructor(context: string) {
    super("Commerce data unavailable");
    this.name = "CommerceReadError";
    this.context = context;
  }
}

export interface CommerceQueryResult<T> {
  readonly data: T | null;
  readonly error: unknown;
}

export function isCommerceReadError(error: unknown): error is CommerceReadError {
  return error instanceof CommerceReadError;
}

export function assertCommerceReadList<T>(
  result: CommerceQueryResult<readonly T[] | T[] | null>,
  context: string
): T[] {
  if (result.error) {
    throw new CommerceReadError(context);
  }
  if (result.data == null) {
    return [];
  }
  return [...result.data];
}

export function readCommerceInventoryList<T>(
  result: CommerceQueryResult<readonly T[] | T[] | null>
): { readonly status: "ok"; readonly rows: T[] } | { readonly status: "unavailable" } {
  if (result.error) {
    return { status: "unavailable" };
  }
  return { status: "ok", rows: result.data == null ? [] : [...result.data] };
}

export function assertCommerceMaybeRow<T>(
  result: CommerceQueryResult<T | null>,
  context: string
): T | null {
  if (result.error) {
    throw new CommerceReadError(context);
  }
  return result.data;
}

export function readCommerceProductRow<T>(
  result: CommerceQueryResult<T | null>,
  context: string
): { readonly status: "found"; readonly row: T } | { readonly status: "not_found" } {
  const row = assertCommerceMaybeRow(result, context);
  if (row == null) {
    return { status: "not_found" };
  }
  return { status: "found", row };
}

export function assembleCommerceSettings<TRate, TTax, TShip, TPin>(results: {
  readonly taxRates: CommerceQueryResult<readonly TRate[] | TRate[] | null>;
  readonly taxSettings: CommerceQueryResult<TTax | null>;
  readonly shipping: CommerceQueryResult<TShip | null>;
  readonly pincodes: CommerceQueryResult<readonly TPin[] | TPin[] | null>;
}): {
  readonly taxRates: TRate[];
  readonly taxSettings: TTax | null;
  readonly shipping: TShip | null;
  readonly pincodes: TPin[];
} {
  return {
    taxRates: assertCommerceReadList(results.taxRates, "commerce_tax_rates"),
    taxSettings: assertCommerceMaybeRow(results.taxSettings, "commerce_tax_settings"),
    shipping: assertCommerceMaybeRow(results.shipping, "commerce_shipping_settings"),
    pincodes: assertCommerceReadList(results.pincodes, "commerce_pincodes"),
  };
}

export function countProductsByCategory(
  products: readonly { readonly category_id: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const product of products) {
    counts[product.category_id] = (counts[product.category_id] ?? 0) + 1;
  }
  return counts;
}
