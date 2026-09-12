/**
 * What the Meta measurement layer is allowed to touch.
 *
 * This module is imported by BOTH the browser component and the server adapter,
 * so it holds no secret and reads no server-only value. The pixel id is public
 * by nature — it ships in the page for anyone to read — and the Conversions API
 * token lives in `server/meta-capi-env.ts`, which is `server-only`.
 *
 * WHY THE ROUTE POLICY IS ALLOW-LIST AND DENY-LIST AT ONCE
 *
 * A deny-list alone ("not /admin, not /manager") is one forgotten prefix away
 * from putting a third-party script on an internal console. An allow-list alone
 * silently drops measurement from a new marketing page, which is a smaller
 * failure but still a surprise. So a path must BE in the public list and NOT in
 * the private one, and both lists are asserted by test.
 *
 * The asymmetry is deliberate: an unknown path gets no pixel. A new public page
 * therefore has to be added here on purpose, which is a one-line change and a
 * conscious decision about whether that page should be measured at all.
 */

/**
 * Public, customer-facing surfaces.
 *
 * `/` is matched exactly; every other entry matches itself and anything under
 * it, so `/portfolio` covers `/portfolio/some-project`.
 */
export const META_PUBLIC_PATH_PREFIXES = [
  "/",
  "/portfolio",
  "/shop",
  "/lp",
  "/privacy",
  "/terms",
  "/data-rights",
  "/communication-consent",
  "/warranty",
] as const;

/**
 * Never measured, whatever else matches.
 *
 * `/q` is the odd one and the reason this list is not just "the app routes":
 * it is customer-facing — a client opening their own quotation — but the URL
 * carries a capability token and the page carries priced commercial terms. A
 * third-party script has no business on it, and `event_source_url` would leak
 * the token to Meta.
 */
export const META_PRIVATE_PATH_PREFIXES = [
  "/admin",
  "/manager",
  "/auth",
  "/api",
  "/q",
] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Whether the Pixel may load and report on this path. */
export function isMetaTrackablePath(pathname: string | null | undefined): boolean {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  // Query and hash are not part of the decision, and must not be.
  const path = pathname.split(/[?#]/, 1)[0] ?? "/";
  if (META_PRIVATE_PATH_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) {
    return false;
  }
  return META_PUBLIC_PATH_PREFIXES.some((prefix) => matchesPrefix(path, prefix));
}

/**
 * The configured pixel id, or null.
 *
 * Read as a literal member expression because `NEXT_PUBLIC_*` inlining is a
 * textual substitution — `process.env[name]` would never be replaced and the
 * pixel would never load however the build is configured.
 *
 * Validated rather than trusted: Meta dataset ids are numeric strings, and a
 * placeholder like "your-pixel-id" left in an env file would otherwise produce
 * a script tag that 404s on every page load.
 */
export function getMetaPixelId(
  configured: string | null | undefined = process.env.NEXT_PUBLIC_META_PIXEL_ID
): string | null {
  if (typeof configured !== "string") return null;
  const trimmed = configured.trim();
  if (!/^\d{8,20}$/.test(trimmed)) return null;
  return trimmed;
}

/** True when a valid pixel id is configured. */
export function isMetaPixelConfigured(configured?: string | null): boolean {
  return getMetaPixelId(configured) !== null;
}

/**
 * The only events this site sends. Named here so the browser and the server
 * cannot drift on spelling — Meta matches event names exactly, and a `lead`
 * would silently become a custom event that optimises nothing.
 */
export const META_EVENT = {
  pageView: "PageView",
  lead: "Lead",
  contact: "Contact",
} as const;

export type MetaEventName = (typeof META_EVENT)[keyof typeof META_EVENT];

/** The script the Pixel loads. Pinned so CSP can name one exact origin. */
export const META_PIXEL_SCRIPT_SRC =
  "https://connect.facebook.net/en_US/fbevents.js";

export const META_PIXEL_SCRIPT_ORIGIN = "https://connect.facebook.net";

/** Where the browser pixel posts its beacons. */
export const META_PIXEL_BEACON_ORIGIN = "https://www.facebook.com";
