export const PUBLIC_COMMERCE_READ_UNAVAILABLE = "PUBLIC_COMMERCE_READ_UNAVAILABLE" as const;
export const PUBLIC_COMMERCE_PARSE_FAILED = "PUBLIC_COMMERCE_PARSE_FAILED" as const;

export class PublicCommerceReadError extends Error {
  readonly code = PUBLIC_COMMERCE_READ_UNAVAILABLE;
  readonly context: string;

  constructor(context: string) {
    super("Public commerce data unavailable");
    this.name = "PublicCommerceReadError";
    this.context = context;
  }
}

export class PublicCommerceParseError extends Error {
  readonly code = PUBLIC_COMMERCE_PARSE_FAILED;
  readonly context: string;

  constructor(context: string) {
    super("Public commerce payload was malformed");
    this.name = "PublicCommerceParseError";
    this.context = context;
  }
}

export function isPublicCommerceReadFailure(error: unknown): boolean {
  return (
    error instanceof PublicCommerceReadError || error instanceof PublicCommerceParseError
  );
}
