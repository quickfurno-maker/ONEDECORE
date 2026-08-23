import "server-only";

import { cookies } from "next/headers";
import {
  COMMERCE_TRACK_COOKIE_NAME,
  COMMERCE_TRACK_COOKIE_PATH,
  issueCommerceTrackProof,
  verifyCommerceTrackProof,
} from "./commerce-track-proof.ts";

export {
  COMMERCE_TRACK_COOKIE_MAX_AGE_SECONDS,
  COMMERCE_TRACK_COOKIE_NAME,
  COMMERCE_TRACK_COOKIE_PATH,
  issueCommerceTrackProof,
  verifyCommerceTrackProof,
} from "./commerce-track-proof.ts";

export async function setCommerceTrackProofCookie(orderReference: string): Promise<void> {
  const { value, maxAge } = issueCommerceTrackProof(orderReference);
  const store = await cookies();
  store.set({
    name: COMMERCE_TRACK_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COMMERCE_TRACK_COOKIE_PATH,
    maxAge,
  });
}

export async function readCommerceTrackProofForReference(
  orderReference: string
): Promise<boolean> {
  const store = await cookies();
  const value = store.get(COMMERCE_TRACK_COOKIE_NAME)?.value;
  return verifyCommerceTrackProof(value, orderReference);
}
