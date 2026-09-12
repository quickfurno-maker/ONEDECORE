import "server-only";

import { SITE_CONFIG } from "../../../../config/site.ts";
import { isMetaTrackablePath } from "../meta-tracking-config.ts";

/**
 * Everything the Conversions API is allowed to know about a visitor, and the
 * rules that keep the list that short.
 *
 * The approved set is exactly: `client_ip_address`, `client_user_agent`, `fbc`,
 * `fbp`. No name, phone, email, date of birth, gender, address, budget,
 * service, property type, enquiry text, CRM identifier or quotation reference
 * ever leaves this application for Meta. Those are not omissions to be filled
 * in later — sending them is what "advanced matching" means, and it is off.
 */

export interface MetaCapiUserSignals {
  readonly client_ip_address?: string;
  readonly client_user_agent?: string;
  readonly fbc?: string;
  readonly fbp?: string;
}

/*
 * `_fbp` is `fb.<subdomainIndex>.<creationTime>.<random>`.
 * `_fbc` is `fb.<subdomainIndex>.<creationTime>.<fbclid>`.
 *
 * Validated on the way out rather than trusted. Both arrive from a cookie the
 * browser can be made to say anything in, and a malformed value is not a
 * privacy problem but it is a data-quality one: Meta rejects the event and the
 * conversion is lost silently.
 */
const FBP_PATTERN = /^fb\.\d\.\d{10,20}\.[0-9A-Za-z_-]{1,128}$/;
const FBC_PATTERN = /^fb\.\d\.\d{10,20}\.[0-9A-Za-z_.-]{1,512}$/;

/** `fbclid` as it appears in an ad click URL. */
const FBCLID_PATTERN = /^[0-9A-Za-z_.-]{1,512}$/;

/**
 * One cookie out of a `Cookie:` header.
 *
 * Written here rather than reached for from a framework helper because this
 * runs on a raw `Request` in a route handler, and because the parsing needs to
 * be boringly literal: split on `;`, split each on the FIRST `=` so a value
 * containing `=` survives, and never decode into something that could be
 * mistaken for a different cookie.
 */
export function readCookie(
  cookieHeader: string | null | undefined,
  name: string
): string | null {
  if (typeof cookieHeader !== "string" || cookieHeader.length === 0) return null;
  for (const part of cookieHeader.split(";")) {
    const segment = part.trim();
    const eq = segment.indexOf("=");
    if (eq <= 0) continue;
    if (segment.slice(0, eq).trim() !== name) continue;
    const value = segment.slice(eq + 1).trim();
    return value.length > 0 ? value : null;
  }
  return null;
}

/**
 * `fbc` from the cookie, or derived from an `fbclid` that is still in the URL.
 *
 * The derivation is Meta's documented format — `fb.1.<timestamp>.<fbclid>` —
 * and it exists for the first page of an ad click, before the Pixel has had a
 * chance to write `_fbc`. Deriving is allowed; INVENTING is not, so with no
 * cookie and no `fbclid` the field is absent rather than filled with a
 * plausible-looking value that would attribute the lead to nothing.
 */
export function deriveFbc(
  cookieValue: string | null,
  fbclid: string | null,
  now: number
): string | null {
  if (cookieValue && FBC_PATTERN.test(cookieValue)) return cookieValue;
  if (!fbclid || !FBCLID_PATTERN.test(fbclid)) return null;
  const candidate = `fb.1.${now}.${fbclid}`;
  return FBC_PATTERN.test(candidate) ? candidate : null;
}

export function readFbp(cookieValue: string | null): string | null {
  return cookieValue && FBP_PATTERN.test(cookieValue) ? cookieValue : null;
}

/**
 * The client IP, taken from the same forwarded header the lead pipeline
 * already trusts, and only when the deployment says that header is trustworthy.
 *
 * `trustProxy` is passed in rather than read here: lead intake already owns
 * that decision (`deriveNetworkIdentifier`), and a second module deciding it
 * independently is how two parts of one request end up disagreeing about who
 * the visitor is. Untrusted means absent — Meta simply gets a slightly weaker
 * match, which is the correct trade against reporting a spoofed address.
 *
 * The value is used and discarded. Nothing here logs it and nothing persists
 * it; lead intake stores only a salted fingerprint, and that is unchanged.
 */
export function resolveClientIp(input: {
  readonly forwardedFor: string | null;
  readonly trustProxy: boolean;
}): string | null {
  if (!input.trustProxy) return null;
  if (typeof input.forwardedFor !== "string") return null;
  const first = input.forwardedFor.split(",")[0]?.trim();
  if (!first) return null;
  // IPv4 dotted quad, or something with a colon that looks like IPv6.
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^[0-9A-Fa-f:]{3,45}$/;
  if (ipv4.test(first) || ipv6.test(first)) return first;
  return null;
}

export function resolveUserAgent(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 1024) return null;
  return trimmed;
}

/**
 * The URL the conversion happened on — rebuilt, never forwarded.
 *
 * THE FAILURE THIS PREVENTS
 *
 * A submitted `landingPath` is attacker-controlled text. Passing it through
 * would let a crafted request put any string into `event_source_url`, which is
 * both a data-quality problem and a small exfiltration channel into someone
 * else's Meta dataset. So the origin is this site's own canonical origin from
 * `SITE_CONFIG`, and only the PATH is taken from the request — after the same
 * public/private gate the Pixel uses, so a path that should never be measured
 * cannot arrive here by another door.
 *
 * The query string is dropped entirely. It carries `utm_*`, `fbclid` and
 * whatever else a campaign appended, none of which Meta needs to attribute a
 * conversion it already has an `fbc` for, and any of which could carry
 * something a visitor typed.
 */
export function buildEventSourceUrl(pathname: string | null | undefined): string {
  const base = SITE_CONFIG.url.replace(/\/+$/, "");
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return base + "/";
  const path = pathname.split(/[?#]/, 1)[0] ?? "/";
  if (!isMetaTrackablePath(path)) return base + "/";
  if (path.length > 512 || /[\s"'<>\\]/.test(path)) return base + "/";
  return `${base}${path}`;
}

/**
 * Assemble the approved signals, omitting anything absent.
 *
 * Absent rather than empty-string: Meta treats `""` as a supplied value and it
 * degrades match quality, where a missing key is simply unknown.
 */
export function buildUserSignals(input: {
  readonly clientIp: string | null;
  readonly userAgent: string | null;
  readonly fbc: string | null;
  readonly fbp: string | null;
}): MetaCapiUserSignals {
  const out: Record<string, string> = {};
  if (input.clientIp) out.client_ip_address = input.clientIp;
  if (input.userAgent) out.client_user_agent = input.userAgent;
  if (input.fbc) out.fbc = input.fbc;
  if (input.fbp) out.fbp = input.fbp;
  return out as MetaCapiUserSignals;
}

/**
 * The exact keys allowed in `user_data`.
 *
 * Exported so a test can assert the built payload against this list rather
 * than against a copy of it — the point being that adding a field to the
 * builder without adding it here fails, and adding it to both is a visible,
 * reviewable act rather than an oversight.
 */
export const META_CAPI_ALLOWED_USER_DATA_KEYS = [
  "client_ip_address",
  "client_user_agent",
  "fbc",
  "fbp",
] as const;

/** Keys that must never appear, whatever else changes. */
export const META_CAPI_FORBIDDEN_KEYS = [
  "em",
  "ph",
  "fn",
  "ln",
  "db",
  "ge",
  "ct",
  "st",
  "zp",
  "country",
  "external_id",
  "subscription_id",
  "lead_id",
] as const;

export { FBP_PATTERN, FBC_PATTERN };
