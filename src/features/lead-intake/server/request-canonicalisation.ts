import "server-only";

import type { LeadIntakeMode } from "../../../config/server-env.ts";

export interface NetworkIdentityResult {
  readonly identifier: string;
  readonly trusted: boolean;
}

/**
 * Derive a network identifier for HMAC fingerprinting.
 * Never trust X-Forwarded-For unless ONEDECORE_TRUST_PROXY=true and mode allows it.
 * Never persist or log the raw identifier.
 */
export function deriveNetworkIdentifier(input: {
  readonly mode: LeadIntakeMode;
  readonly trustProxy: boolean;
  readonly remoteAddress: string | null;
  readonly forwardedFor: string | null;
}): NetworkIdentityResult {
  if (input.mode === "local-test") {
    const addr = (input.remoteAddress ?? "").replace(/^::ffff:/, "");
    if (addr === "127.0.0.1" || addr === "::1" || addr === "localhost") {
      return { identifier: "loopback", trusted: true };
    }
    // local-test still fingerprints whatever socket address is present
    return {
      identifier: addr || "local-unknown",
      trusted: true,
    };
  }

  if (input.mode === "enabled" && input.trustProxy) {
    const forwarded = (input.forwardedFor ?? "").split(",")[0]?.trim() ?? "";
    if (forwarded) {
      return { identifier: forwarded, trusted: true };
    }
  }

  const direct = (input.remoteAddress ?? "").replace(/^::ffff:/, "") || "unknown";
  return { identifier: direct, trusted: !input.trustProxy };
}
