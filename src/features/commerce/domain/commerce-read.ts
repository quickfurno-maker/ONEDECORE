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
