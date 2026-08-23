import "server-only";

const UNKNOWN = "unknown";
const MAX_HEADER_LEN = 120;

function trimBounded(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().slice(0, MAX_HEADER_LEN);
  return trimmed === "" ? null : trimmed;
}

function isValidIp(value: string): boolean {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return true;
  if (value.includes(":")) return true;
  return false;
}

/**
 * Extract a stable network identifier for HMAC fingerprinting.
 * Precedence: x-real-ip → first x-forwarded-for → unknown.
 * Never persist or log the raw value.
 */
export function extractCommerceNetworkIdentifier(headers: Headers): string {
  const realIp = trimBounded(headers.get("x-real-ip"));
  if (realIp && isValidIp(realIp)) return realIp;

  const forwarded = trimBounded(headers.get("x-forwarded-for"));
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first && isValidIp(first)) return first;
  }

  return UNKNOWN;
}
