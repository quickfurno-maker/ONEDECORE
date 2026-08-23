import "server-only";

import { headers } from "next/headers";
import { commerceHmacSha256Hex } from "./commerce-crypto.ts";
import { getCommerceRuntimeEnv } from "./commerce-runtime-env.ts";
import { extractCommerceNetworkIdentifier } from "./commerce-network.ts";

export function normalizeCommerceMobileE164(input: string): string | null {
  const trimmed = input.trim();
  if (/^[6-9][0-9]{9}$/.test(trimmed)) return `+91${trimmed}`;
  if (/^\+91[6-9][0-9]{9}$/.test(trimmed)) return trimmed;
  return null;
}

export function fingerprintCommerceNetwork(networkIdentifier: string, secret: string): string {
  return commerceHmacSha256Hex(secret, "commerce-network-v1", networkIdentifier);
}

export function fingerprintCommercePhone(mobileE164: string, secret: string): string {
  return commerceHmacSha256Hex(secret, "commerce-phone-v1", mobileE164);
}

export async function deriveCommerceRequestFingerprints(input?: {
  mobileE164?: string | null;
}): Promise<{ networkFingerprintHash: string; phoneFingerprintHash?: string }> {
  const { publicRuntimeSecret } = getCommerceRuntimeEnv();
  const headerStore = await headers();
  const networkId = extractCommerceNetworkIdentifier(headerStore);
  const networkFingerprintHash = fingerprintCommerceNetwork(networkId, publicRuntimeSecret);
  if (input?.mobileE164) {
    return {
      networkFingerprintHash,
      phoneFingerprintHash: fingerprintCommercePhone(input.mobileE164, publicRuntimeSecret),
    };
  }
  return { networkFingerprintHash };
}
