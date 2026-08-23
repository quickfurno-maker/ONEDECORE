import "server-only";

import { commerceHmacSha256Hex, commerceSafeEqualHex } from "./commerce-crypto.ts";
import { getCommerceRuntimeEnv } from "./commerce-runtime-env.ts";

export const COMMERCE_TRACK_COOKIE_NAME = "od_commerce_track_v1";
export const COMMERCE_TRACK_COOKIE_MAX_AGE_SECONDS = 30 * 60;
export const COMMERCE_TRACK_COOKIE_PATH = "/shop/order";

export type CommerceTrackProofPayload = {
  readonly v: 1;
  readonly orderReference: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
};

function signTrackPayload(payload: CommerceTrackProofPayload, secret: string): string {
  const body = JSON.stringify({
    v: payload.v,
    orderReference: payload.orderReference,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    nonce: payload.nonce,
  });
  return commerceHmacSha256Hex(secret, "commerce-track-proof-v1", body);
}

export function issueCommerceTrackProof(orderReference: string): {
  value: string;
  maxAge: number;
} {
  const { publicRuntimeSecret } = getCommerceRuntimeEnv();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + COMMERCE_TRACK_COOKIE_MAX_AGE_SECONDS * 1000;
  const payload: CommerceTrackProofPayload = {
    v: 1,
    orderReference: orderReference.trim(),
    issuedAt,
    expiresAt,
    nonce: crypto.randomUUID(),
  };
  const signature = signTrackPayload(payload, publicRuntimeSecret);
  const value = Buffer.from(JSON.stringify({ payload, signature }), "utf8").toString("base64url");
  if (value.length > 2048) {
    throw new Error("COMMERCE_ORDER_VALIDATION");
  }
  return { value, maxAge: COMMERCE_TRACK_COOKIE_MAX_AGE_SECONDS };
}

export function verifyCommerceTrackProof(
  cookieValue: string | undefined,
  orderReference: string
): boolean {
  if (!cookieValue) return false;
  let parsed: { payload?: CommerceTrackProofPayload; signature?: string };
  try {
    parsed = JSON.parse(Buffer.from(cookieValue, "base64url").toString("utf8")) as {
      payload?: CommerceTrackProofPayload;
      signature?: string;
    };
  } catch {
    return false;
  }
  const payload = parsed.payload;
  const signature = parsed.signature;
  if (!payload || typeof signature !== "string" || payload.v !== 1) return false;
  if (payload.expiresAt <= Date.now()) return false;
  if (payload.orderReference !== orderReference.trim()) return false;
  if (!/^OD-O-[0-9]{4}-[0-9]{6}$/.test(payload.orderReference)) return false;
  const { publicRuntimeSecret } = getCommerceRuntimeEnv();
  const expected = signTrackPayload(payload, publicRuntimeSecret);
  return commerceSafeEqualHex(expected, signature);
}
