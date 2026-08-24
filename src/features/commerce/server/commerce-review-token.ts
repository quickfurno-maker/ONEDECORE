import "server-only";

import { commerceHmacSha256Hex, commerceSafeEqualHex } from "./commerce-crypto.ts";
import { getCommerceRuntimeEnv } from "./commerce-runtime-env.ts";

export const COMMERCE_REVIEW_TOKEN_TTL_MS = 5 * 60 * 1000;

export type CommerceReviewTokenPayload = {
  readonly v: 1;
  readonly lines: ReadonlyArray<{ sku: string; quantity: number }>;
  readonly pincode: string;
  readonly totalPaise: number;
  readonly issuedAt: number;
  readonly expiresAt: number;
};

function canonicalLinesKey(
  lines: ReadonlyArray<{ sku: string; quantity: number }>
): string {
  return JSON.stringify(
    [...lines]
      .map((line) => ({ sku: line.sku.toLowerCase(), quantity: line.quantity }))
      .sort((a, b) => a.sku.localeCompare(b.sku))
  );
}

function signPayload(payload: CommerceReviewTokenPayload, secret: string): string {
  const body = JSON.stringify({
    v: payload.v,
    lines: payload.lines,
    pincode: payload.pincode,
    totalPaise: payload.totalPaise,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  });
  return commerceHmacSha256Hex(secret, "commerce-quote-review-v1", body);
}

export function issueCommerceReviewToken(input: {
  lines: ReadonlyArray<{ sku: string; quantity: number }>;
  pincode: string;
  totalPaise: number;
}): { token: string; expiresAt: number } {
  const { publicRuntimeSecret } = getCommerceRuntimeEnv();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + COMMERCE_REVIEW_TOKEN_TTL_MS;
  const payload: CommerceReviewTokenPayload = {
    v: 1,
    lines: input.lines.map((line) => ({
      sku: line.sku.trim().toLowerCase(),
      quantity: line.quantity,
    })),
    pincode: input.pincode.trim(),
    totalPaise: input.totalPaise,
    issuedAt,
    expiresAt,
  };
  const signature = signPayload(payload, publicRuntimeSecret);
  const token = Buffer.from(JSON.stringify({ payload, signature }), "utf8").toString("base64url");
  if (token.length > 4096) {
    throw new Error("COMMERCE_ORDER_VALIDATION");
  }
  return { token, expiresAt };
}

export function verifyCommerceReviewToken(token: string): CommerceReviewTokenPayload | null {
  let parsed: { payload?: CommerceReviewTokenPayload; signature?: string };
  try {
    parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as {
      payload?: CommerceReviewTokenPayload;
      signature?: string;
    };
  } catch {
    return null;
  }
  const payload = parsed.payload;
  const signature = parsed.signature;
  if (!payload || typeof signature !== "string" || payload.v !== 1) return null;
  if (payload.expiresAt <= Date.now()) return null;
  if (!/^[0-9]{6}$/.test(payload.pincode)) return null;
  if (!Number.isInteger(payload.totalPaise) || payload.totalPaise < 0) return null;
  if (!Array.isArray(payload.lines) || payload.lines.length === 0 || payload.lines.length > 20) {
    return null;
  }
  for (const line of payload.lines) {
    if (typeof line.sku !== "string" || !/^[a-z0-9._-]{1,64}$/.test(line.sku)) return null;
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) return null;
  }
  const { publicRuntimeSecret } = getCommerceRuntimeEnv();
  const expected = signPayload(payload, publicRuntimeSecret);
  if (!commerceSafeEqualHex(expected, signature)) return null;
  return payload;
}

export function reviewTokenMatchesRequest(
  payload: CommerceReviewTokenPayload,
  input: {
    lines: ReadonlyArray<{ sku: string; quantity: number }>;
    pincode: string;
  }
): boolean {
  if (payload.pincode !== input.pincode.trim()) return false;
  return canonicalLinesKey(payload.lines) === canonicalLinesKey(input.lines);
}

export function reviewTokenMatchesQuote(
  payload: CommerceReviewTokenPayload,
  quote: { totalPaise: number; lines: ReadonlyArray<{ sku: string; quantity: number }> }
): boolean {
  if (payload.totalPaise !== quote.totalPaise) return false;
  return canonicalLinesKey(payload.lines) === canonicalLinesKey(quote.lines);
}
