/**
 * Advertising-cookie consent — the third gate, and the one that actually
 * protects a visitor.
 *
 * WHY THIS EXISTS SEPARATELY FROM EVERY OTHER CONSENT IN THE SYSTEM
 *
 * The lead form already collects a service-enquiry consent and a WhatsApp
 * channel consent. Neither is permission to load a Meta advertising script.
 * Those consents say "you may contact me about my enquiry"; this one says
 * "you may let an advertising network observe my visit". Reusing one for the
 * other is the exact bundling `CONSENT_SEPARATION_RULES` in the legal registry
 * forbids, and it would be the kind of reuse a visitor would be surprised by.
 *
 * It is also not inferable. `_fbp`, `_fbc`, `fbclid` and UTM parameters all
 * indicate that someone ARRIVED from an ad — not that they agreed to be
 * measured. Treating an ad click as consent would mean the people most likely
 * to be tracked are the ones who never got asked.
 *
 * FAILS CLOSED, ALWAYS
 *
 * Anything that is not an exact, current, granted value reads as `unknown`:
 * absent, malformed, truncated, a stale version, someone else's cookie, a
 * hand-edited value. There is no path through this module that turns doubt
 * into permission.
 */

/** First-party, ONEDECORE's own. No third-party CMP, no vendor cookie. */
export const AD_CONSENT_COOKIE_NAME = "onedecore_ad_tracking_consent";

/**
 * The value carries a version so the question can be re-asked.
 *
 * If the data Meta receives ever changes, this string changes, every stored
 * decision becomes `unknown`, and every visitor is asked again against the new
 * description. A bare "true" could not express that, and silently keeping an
 * old yes for a new purpose is how consent records stop meaning anything.
 */
export const AD_CONSENT_VERSION = "v1" as const;

export const AD_CONSENT_GRANTED_VALUE = `${AD_CONSENT_VERSION}:granted` as const;
export const AD_CONSENT_DENIED_VALUE = `${AD_CONSENT_VERSION}:denied` as const;

/** 180 days, then the visitor is asked again rather than assumed. */
export const AD_CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export type AdConsentState = "unknown" | "granted" | "denied";

/**
 * Fired on the window when a decision is recorded, so the Pixel can react
 * within the same page view rather than at the next navigation.
 *
 * Withdrawal has to take effect immediately — a visitor who clicks "Necessary
 * only" and then watches a PageView fire has been ignored.
 */
export const AD_CONSENT_CHANGE_EVENT = "onedecore:ad-consent-change";

/**
 * Parse a stored value into a state.
 *
 * Exact match on the current version, and nothing else. A `v0:granted` from an
 * earlier description, a `granted` without a version, extra whitespace, a
 * prefix like `v1:grantedX` — all `unknown`, which means the banner asks again.
 */
export function parseAdConsent(raw: string | null | undefined): AdConsentState {
  if (typeof raw !== "string") return "unknown";
  const value = raw.trim();
  if (value === AD_CONSENT_GRANTED_VALUE) return "granted";
  if (value === AD_CONSENT_DENIED_VALUE) return "denied";
  return "unknown";
}

/** True only for an explicit, current grant. */
export function isAdConsentGranted(raw: string | null | undefined): boolean {
  return parseAdConsent(raw) === "granted";
}

/**
 * One cookie out of a `Cookie:` header or `document.cookie`.
 *
 * Deliberately literal: split on `;`, split each on the FIRST `=` so a value
 * containing `=` survives, and match the name exactly rather than by prefix so
 * a decoy like `not_onedecore_ad_tracking_consent` cannot answer for the real
 * one.
 */
export function readConsentCookie(
  cookieHeader: string | null | undefined,
  name: string = AD_CONSENT_COOKIE_NAME
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

/** The state a request carries, from its raw `Cookie:` header. */
export function readAdConsentFromHeader(
  cookieHeader: string | null | undefined
): AdConsentState {
  return parseAdConsent(readConsentCookie(cookieHeader));
}

/* -------------------------------------------------------------------------- */
/* Browser                                                                     */
/* -------------------------------------------------------------------------- */

/** The state this browser currently holds. `unknown` off the browser. */
export function readAdConsent(): AdConsentState {
  if (typeof document === "undefined") return "unknown";
  return parseAdConsent(readConsentCookie(document.cookie));
}

/**
 * Record a decision.
 *
 * `SameSite=Lax` because this cookie is only ever read on a top-level visit to
 * this site; it has no cross-site job and should not be sent as though it did.
 * Not `HttpOnly`, because the gate that decides whether to load a script runs
 * in the browser and has to be able to read it — the value is a three-state
 * enum with no personal data in it, so there is nothing here for script access
 * to leak.
 */
export function writeAdConsent(state: "granted" | "denied"): void {
  if (typeof document === "undefined") return;
  const value =
    state === "granted" ? AD_CONSENT_GRANTED_VALUE : AD_CONSENT_DENIED_VALUE;
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  document.cookie =
    `${AD_CONSENT_COOKIE_NAME}=${value}; Path=/; Max-Age=${AD_CONSENT_MAX_AGE_SECONDS};` +
    ` SameSite=Lax${secure ? "; Secure" : ""}`;

  if (state === "denied") clearMetaBrowserCookies();

  try {
    window.dispatchEvent(
      new CustomEvent(AD_CONSENT_CHANGE_EVENT, { detail: { state } })
    );
  } catch {
    // A missing CustomEvent constructor must not lose the decision itself.
  }
}

/**
 * Expire the Meta cookies this site can reach.
 *
 * `_fbp` and `_fbc` are FIRST-PARTY cookies — set by `fbevents.js` on the
 * onedecore.in domain — so a withdrawal can genuinely remove them, and should.
 * They are cleared on the exact host and on the dot-prefixed registrable
 * domain because the script may have written either, and a cookie deleted at
 * the wrong scope silently survives.
 *
 * WHAT THIS CANNOT DO, AND MUST NOT CLAIM
 *
 * Events already transmitted to Meta are gone from this application's reach.
 * Deleting a cookie does not recall them, and the notice says so rather than
 * implying an undo that does not exist.
 */
export function clearMetaBrowserCookies(): void {
  if (typeof document === "undefined") return;
  const host = typeof location !== "undefined" ? location.hostname : "";
  const parts = host.split(".");
  const registrable = parts.length > 2 ? parts.slice(-2).join(".") : host;
  const domains = [undefined, host, `.${host}`, `.${registrable}`];
  for (const name of ["_fbp", "_fbc"]) {
    for (const domain of domains) {
      document.cookie =
        `${name}=; Path=/; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT` +
        (domain ? `; Domain=${domain}` : "");
    }
  }
}
