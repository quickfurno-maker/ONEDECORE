/**
 * The HTTP security headers this application sends.
 *
 * A pure module: no environment reads, no network, no secrets. `next.config.ts`
 * decides whether the build is a production one and asks for the headers; this
 * file decides what they are. Keeping it pure is what lets the tests assert the
 * exact production policy without a build, a server, or a browser.
 *
 * WHY THIS CSP IS NOT A NONCE POLICY
 *
 * The strict form of CSP gives each response a fresh nonce and drops
 * `'unsafe-inline'`. In Next that nonce has to be generated per request, which
 * forces every page carrying it to render dynamically. OneDecore's public pages
 * — the ones that convert visitors into enquiries — are statically prerendered
 * today, and trading their rendering mode for a stricter script policy is a
 * decision with a real cost, not a free win.
 *
 * So this is an ENFORCED, STATIC-COMPATIBLE policy. It is honest about what it
 * does and does not buy:
 *
 *   IT DOES bound where scripts, styles, images, fonts, connections, frames and
 *   form posts may come from. An injected `<script src="https://evil.example">`
 *   does not load. Data cannot be exfiltrated to an arbitrary origin through
 *   fetch, an image beacon or a form post. The page cannot be framed. No
 *   plugins, no base-tag hijacking, no `eval`.
 *
 *   IT DOES NOT stop an injected INLINE script, because `'unsafe-inline'` is
 *   present for scripts. Reflected/stored XSS that lands inline is still
 *   dangerous, and this policy is not the control that stops it — output
 *   encoding and React's default escaping are.
 *
 * `'unsafe-inline'` is currently load-bearing: the JSON-LD blocks on the
 * portfolio and product pages are `<script type="application/ld+json">`
 * elements, which CSP governs under `script-src`.
 *
 * Upgrading to nonces later is a deliberate project with a rendering-mode
 * decision attached, not a tightening of a string in this file.
 */

import { ONEDECORE_MANAGED_SUPABASE_HOST } from "../lib/supabase/runtime-target.ts";
import {
  META_PIXEL_BEACON_ORIGIN,
  META_PIXEL_SCRIPT_ORIGIN,
} from "../features/marketing/meta/meta-tracking-config.ts";

/** One header, in the shape `next.config.ts` wants. */
export interface HttpSecurityHeader {
  readonly key: string;
  readonly value: string;
}

export interface SecurityHeaderOptions {
  /** Production headers add CSP and HSTS; development gets neither. */
  readonly isProduction: boolean;
  /**
   * The Supabase origin the BROWSER talks to. Defaults to the managed
   * OneDecore project.
   *
   * Deliberately not read from `NEXT_PUBLIC_SUPABASE_URL` here. A production
   * image built with a developer's local env would otherwise ship a policy
   * naming `http://127.0.0.1:54321`, which is both useless and a lie about what
   * the application talks to. The managed origin is a repository constant
   * already used to pin the runtime target, so the production policy is the
   * same whatever machine builds it.
   */
  readonly supabaseOrigin?: string;
}

/** The one external origin the browser is allowed to reach. */
export const MANAGED_SUPABASE_ORIGIN = `https://${ONEDECORE_MANAGED_SUPABASE_HOST}`;

/**
 * One year, the value HSTS needs to be useful.
 *
 * Without `includeSubDomains` and without `preload`, both deliberately:
 * subdomains of onedecore.in are not inventoried here, and preload is a
 * effectively irreversible submission to a browser-vendor list. Neither belongs
 * in a repository change that has not been deployed and observed.
 */
export const HSTS_MAX_AGE_SECONDS = 31_536_000;

/**
 * The four headers that predate this policy. Unchanged.
 *
 * `X-Frame-Options: DENY` is kept alongside `frame-ancestors 'none'` — the
 * modern directive supersedes it, but the old header still matters to clients
 * that do not implement CSP framing rules.
 */
const BASELINE_HEADERS: readonly HttpSecurityHeader[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/**
 * Build the policy, one directive per entry.
 *
 * Every source below is here because something in the application needs it; the
 * inventory is in `docs/audits/lane-5-dependency-http-security.md`.
 */
export function buildContentSecurityPolicy(
  supabaseOrigin: string = MANAGED_SUPABASE_ORIGIN
): string {
  const directives: readonly (readonly string[])[] = [
    // Everything not named below falls back to same-origin.
    ["default-src", "'self'"],

    /*
     * Inline is load-bearing for JSON-LD (see the file header). No `eval`.
     *
     * ONE external script origin: `connect.facebook.net`, which serves
     * `fbevents.js` and nothing else. Named exactly rather than as
     * `*.facebook.net` — a wildcard would also admit every other host Meta
     * operates on that domain, present and future, which is a larger promise
     * than "this site loads the Pixel".
     *
     * The origin is allowed whether or not a pixel id is configured. A CSP is a
     * static response header and cannot depend on a build-time gate without
     * two policies to keep in step; the gate that decides whether anything is
     * actually loaded is `isMetaTrackablePath` plus the pixel id, in
     * `MetaPixel.tsx`.
     */
    ["script-src", "'self'", "'unsafe-inline'", META_PIXEL_SCRIPT_ORIGIN],

    // Event-handler attributes (`onclick="..."`) are never legitimate here.
    // This is the part of inline scripting that CAN be forbidden without
    // changing how pages render.
    ["script-src-attr", "'none'"],

    // Next injects critical CSS inline, and the quotation preview document
    // carries its own inline styles.
    ["style-src", "'self'", "'unsafe-inline'"],

    /*
     * `data:` for the inlined placeholders Next emits, `blob:` for the local
     * preview of a file the user has just selected in the media manager
     * (`URL.createObjectURL`), and the managed Supabase origin for public
     * portfolio and product media served straight from storage.
     */
    ["img-src", "'self'", "data:", "blob:", supabaseOrigin, META_PIXEL_BEACON_ORIGIN],

    // `next/font` self-hosts the Google faces at build time; nothing is
    // fetched from a font CDN at runtime.
    ["font-src", "'self'", "data:"],

    /*
     * The Supabase REST/auth endpoints. No websocket scheme: the application
     * subscribes to no realtime channel.
     *
     * `www.facebook.com` is where the Pixel posts its beacons — as an image
     * when it can and via `fetch` when it cannot, which is why the origin
     * appears under both `img-src` and here. The Conversions API is a
     * server-to-server call to `graph.facebook.com` and needs no CSP entry at
     * all: a browser never makes it.
     */
    ["connect-src", "'self'", supabaseOrigin, META_PIXEL_BEACON_ORIGIN],

    ["object-src", "'none'"],
    ["base-uri", "'self'"],

    // Forms post back to this origin only. There is no third-party form target.
    ["form-action", "'self'"],

    // Nobody may frame OneDecore.
    ["frame-ancestors", "'none'"],

    /*
     * OneDecore frames one thing: the quotation preview, an `<iframe sandbox=""
     * srcDoc={...}>` built from a snapshot the server rendered.
     *
     * `'none'` was measured rather than assumed. A sandboxed srcdoc frame under
     * `frame-src 'none'` loads in Chrome and raises no violation — the srcdoc
     * document inherits the parent policy instead of being matched against this
     * directive — so the strictest value is also the working one. If a browser
     * is ever found that checks srcdoc against `frame-src`, the preview renders
     * empty and the fix is `'self'`; nothing else in the application frames
     * anything.
     */
    ["frame-src", "'none'"],

    ["manifest-src", "'self'"],
    ["worker-src", "'self'", "blob:"],
  ];

  return directives.map((directive) => directive.join(" ")).join("; ");
}

/**
 * The complete header set for one environment.
 *
 * Development gets the four baseline headers and nothing else. An enforced CSP
 * in `next dev` breaks HMR, and the usual fix — allowing `'unsafe-eval'` in
 * development — creates exactly the situation where a development allowance can
 * be shipped by accident. There is no development CSP to leak.
 */
export function buildSecurityHeaders(
  options: SecurityHeaderOptions
): HttpSecurityHeader[] {
  const headers: HttpSecurityHeader[] = [...BASELINE_HEADERS];

  if (!options.isProduction) {
    return headers;
  }

  headers.push({
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy(options.supabaseOrigin),
  });

  /*
   * HSTS is a promise to the browser that this host is HTTPS-only for a year.
   * It is configured here; whether it is LIVE depends on a deployment this
   * repository change does not perform.
   */
  headers.push({
    key: "Strict-Transport-Security",
    value: `max-age=${HSTS_MAX_AGE_SECONDS}`,
  });

  return headers;
}
