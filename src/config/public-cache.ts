/**
 * How long a shared cache may hold public marketing HTML.
 *
 * THE PROBLEM THIS EXISTS TO FIX
 *
 * `/`, `/interiors` and the legal pages are statically prerendered. A Next.js
 * page that is prerendered and declares no `revalidate` is, as far as the
 * framework is concerned, immutable — so it is served with
 * `Cache-Control: s-maxage=31536000`. One year.
 *
 * Nothing in front of the origin honours that today, so the live site is not
 * currently broken by it. But the launch plan puts a CDN and a tag manager in
 * front of these exact pages. A shared cache that took the header at its word
 * would pin the homepage — the GTM snippet included — for a year, and no
 * redeploy would dislodge it. That is not a risk worth carrying into paid
 * traffic for the sake of a cache lifetime nobody chose.
 *
 * WHY A REVALIDATE RATHER THAN `no-store`
 *
 * `/` and `/interiors` are the paid-search landing pages. Making them dynamic
 * would trade the thing that makes them fast for a problem we do not have:
 * their content genuinely is near-static. Declaring a revalidate window keeps
 * the prerender and replaces the year with a number somebody decided.
 *
 * It also fixes a second defect. `/` reads `isShopPublicEnabled()`, a runtime
 * environment gate. Fully static, that gate was frozen at BUILD time, so
 * turning the storefront off in production would change the sitemap — which is
 * `force-dynamic` — while leaving the homepage advertising a shop. Under ISR
 * the gate is re-read when the page regenerates, so the two agree within one
 * window instead of disagreeing until the next deploy.
 *
 * Hashed static assets under `/_next/static` are content-addressed and keep
 * their own long-lived immutable caching. This constant is about HTML.
 */

/**
 * Five minutes.
 *
 * Long enough that the landing pages are still served from cache under ad
 * traffic; short enough that a deploy, a tag change or a storefront gate flip
 * is visible without anyone clearing a cache by hand.
 */
export const PUBLIC_HTML_REVALIDATE_SECONDS = 300;
