"use server";

import { redirect } from "next/navigation";
import { normalizeCommerceOrderError } from "../orders/order-errors.ts";
import {
  consumeCommercePublicRateLimit,
  verifyPublicCommerceOrderTrackingIdentity,
} from "../orders/order-queries.ts";
import {
  deriveCommerceRequestFingerprints,
  normalizeCommerceMobileE164,
} from "./commerce-fingerprints.ts";
import { TRACKING_MISMATCH_MESSAGE, toCommercePublicMessage } from "./commerce-public-errors.ts";
import { setCommerceTrackProofCookie } from "./commerce-track-cookie.ts";

export type TrackOrderState =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "error"; message: string }
  | { status: "mismatch"; message: string }
  | { status: "ok"; orderReference: string };

function normalizeOrderReference(value: string): string | null {
  const trimmed = value.trim().toUpperCase();
  if (!/^OD-O-[0-9]{4}-[0-9]{6}$/.test(trimmed)) return null;
  return trimmed;
}

export async function verifyOrderTracking(
  _prev: TrackOrderState,
  formData: FormData
): Promise<TrackOrderState> {
  const orderReference = normalizeOrderReference(String(formData.get("orderReference") ?? ""));
  const mobileE164 = normalizeCommerceMobileE164(String(formData.get("mobile") ?? ""));
  if (!orderReference || !mobileE164) {
    return { status: "invalid" };
  }
  try {
    const { networkFingerprintHash, phoneFingerprintHash } = await deriveCommerceRequestFingerprints({
      mobileE164,
    });
    const rate = await consumeCommercePublicRateLimit({
      operation: "track",
      networkFingerprintHash,
      phoneFingerprintHash,
    });
    if (!rate.allowed) {
      return { status: "error", message: toCommercePublicMessage("COMMERCE_RATE_LIMITED") };
    }
    const identity = await verifyPublicCommerceOrderTrackingIdentity({
      orderReference,
      mobileE164,
    });
    if (!identity.matched) {
      return { status: "mismatch", message: TRACKING_MISMATCH_MESSAGE };
    }
    await setCommerceTrackProofCookie(orderReference);
    redirect(`/shop/order/${encodeURIComponent(orderReference)}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    const normalized = normalizeCommerceOrderError(error);
    return { status: "error", message: toCommercePublicMessage(normalized.code) };
  }
}
