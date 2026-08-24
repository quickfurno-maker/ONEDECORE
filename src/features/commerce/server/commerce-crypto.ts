import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type CommerceHmacDomain =
  | "commerce-network-v1"
  | "commerce-phone-v1"
  | "commerce-track-proof-v1"
  | "commerce-quote-review-v1";

export function commerceHmacSha256Hex(
  secret: string,
  domain: CommerceHmacDomain,
  payload: string
): string {
  return createHmac("sha256", secret).update(`${domain}|${payload}`, "utf8").digest("hex");
}

export function commerceSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
