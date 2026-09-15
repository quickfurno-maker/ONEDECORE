/**
 * WM-5 — opaque click redirect contract.
 *
 * The public route `/w/c/<token>` exchanges a random 43-character base64url
 * token for an allowlisted destination through a service-role RPC. The URL
 * carries no phone number, name, contact id or campaign id; the database
 * stores only the token's SHA-256. Unknown, expired and inactive tokens all
 * redirect to the same fallback, so the route is not an existence oracle.
 * Pure: no server imports.
 */

export const WHATSAPP_CLICK_ROUTE_PREFIX = "/w/c/";

export const WHATSAPP_CLICK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isWhatsappClickToken(value: unknown): value is string {
  return typeof value === "string" && WHATSAPP_CLICK_TOKEN_PATTERN.test(value);
}

export type WhatsappClickClientClass = "browser" | "bot" | "unknown";

/**
 * Link-preview and crawler fetches are recorded as `bot` and excluded from
 * the funnel. The user-agent itself is never stored.
 */
export function classifyWhatsappClickClient(userAgent: string | null | undefined): WhatsappClickClientClass {
  const ua = (userAgent ?? "").slice(0, 512);
  if (ua.trim() === "") return "unknown";
  if (/bot|crawler|spider|preview|facebookexternalhit|whatsapp\/|slackbot|telegrambot|discordbot|curl|wget|python-requests|headless/i.test(ua)) {
    return "bot";
  }
  return /mozilla|safari|chrome|firefox|edg|opera|mobile/i.test(ua) ? "browser" : "unknown";
}

/** Hosts a destination may point at: the configured allowlist, never an IP or credentials. */
export function parseWhatsappClickAllowedHosts(raw: string | null | undefined, siteUrl: string | null | undefined): readonly string[] {
  const hosts = new Set<string>();
  for (const part of (raw ?? "").split(",")) {
    const host = part.trim().toLowerCase();
    if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host) && !/^[0-9.]+$/.test(host)) hosts.add(host);
  }
  if (siteUrl) {
    try {
      const url = new URL(siteUrl);
      if (url.protocol === "https:") hosts.add(url.hostname.toLowerCase());
    } catch {
      // An unparsable site URL adds nothing.
    }
  }
  return [...hosts];
}

/**
 * Re-validates the database's destination at click time. Exact host or a
 * subdomain of an allowlisted host; https only; no userinfo; no IP literal.
 */
export function resolveSafeWhatsappClickDestination(destination: unknown, allowedHosts: readonly string[]): string | null {
  if (typeof destination !== "string" || destination.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (/^[0-9.]+$/.test(host) || host.includes(":") || host === "localhost") return null;
  const allowed = allowedHosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
  return allowed ? url.toString() : null;
}
