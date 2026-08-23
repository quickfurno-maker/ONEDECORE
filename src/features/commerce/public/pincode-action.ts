"use server";

import { queryPublicPincode } from "./public-queries.ts";
import type { PublicCommercePincodeResult } from "./public-types.ts";

export type PincodeCheckState =
  | { readonly status: "idle" }
  | { readonly status: "invalid" }
  | { readonly status: "error" }
  | { readonly status: "ok"; readonly result: PublicCommercePincodeResult };

export async function checkShopPincode(
  _prev: PincodeCheckState,
  formData: FormData
): Promise<PincodeCheckState> {
  const pincode = String(formData.get("pincode") ?? "").trim();
  if (!/^[0-9]{6}$/.test(pincode)) {
    return { status: "invalid" };
  }
  try {
    const result = await queryPublicPincode(pincode);
    return { status: "ok", result };
  } catch {
    return { status: "error" };
  }
}
