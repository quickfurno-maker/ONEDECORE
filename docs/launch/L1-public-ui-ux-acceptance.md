# L1 — Public UI/UX Acceptance and Launch-Scope Hardening

**Phase:** L1 (Final Public UI/UX Acceptance + Launch-Scope Hardening)
**Date:** 2026-09-07
**Base `origin/main`:** `4b15ca3404cf9e34f7ea52438df900de891ee734` (merge of PR #154, the L0 audit)
**Branch:** `feat/public-launch-l1-ui-ux-acceptance`
**Production URL:** https://onedecore.in

**The website is NOT launch-certified by this document.** Certification is L8.
L1 accepts the public UI/UX and closes the cache blocker; the measurement,
consent and WhatsApp lanes remain open.

Evidence is marked:

- **CODE** — read from the repository.
- **LIVE** — read-only HTTP GET against production. No form was submitted and
  **no production lead was created.**
- **BUILD** — observed from a local production build (`next build` + `next start`).

---

## 1. Launch scope

**ONEDECORE launches as an interiors lead-generation website.**

Funnel: `Homepage / Interiors / Portfolio → Consultation → CRM → human follow-up`.

### 1.1 `/shop` decision — OUT of the first paid-acquisition funnel

The L0 register said `/shop` returning HTTP 200 meant the storefront gate was
ON. **That was wrong, and this phase corrects it.** The gate is OFF:

| Check | Result |
| --- | --- |
| `/shop` LIVE | 200, but renders "Coming soon" with `<meta name="robots" content="noindex, nofollow">` |
| Homepage LIVE | zero `/shop` links, no "Shop" nav entry |
| `sitemap.xml` LIVE | 3 URLs, no `/shop` |

So `ONEDECORE_SHOP_PUBLIC_ENABLED` is not `true` in production, and the
containment already in the codebase is doing its job. Commerce code and data are
untouched.

Containment verified in CODE, and now pinned by tests:

- `getPublicNavDestinations(shopEnabled)` appends Shop only when the gate is on.
- `PublicSiteHeader` and `PublicSiteFooter` both default `shopEnabled = false`.
- Header search and cart are gated separately, so they cannot survive the nav
  entry being removed.
- `DiscoveryHomePage` derives `shopLive` from the same gate.
- `sitemap.ts` lists `/shop` only inside `if (shopPublic)`.
- Neither `/interiors` nor the portfolio grid links to `/shop`.

**One real defect found and fixed.** `/` is statically prerendered but reads
`isShopPublicEnabled()`, a *runtime* environment gate — so the gate was frozen
at build time, while `sitemap.ts` (`force-dynamic`) read it live. Flipping the
env would have produced a sitemap without `/shop` and a homepage still
advertising one: exactly the contradictory-indexable-URL state §11 warns about.
The revalidate window added in §4 makes both read the same value.

**Owner action, not taken here:** nothing needs to change in production for the
shop to stay contained. It already is.

---

## 2. Public route acceptance matrix

LIVE probes, 2026-09-07.

| Route | Status | Title | Description | OG | Canonical | Accepted |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 200 | ✓ | ✓ | ✓ | `https://onedecore.in` | ✓ |
| `/interiors` | 200 | ✓ | ✓ | ✓ | `/interiors` | ✓ |
| `/portfolio` | 200 | ✓ | ✓ | ✓ | `/portfolio` | ✓ with §6 finding |
| `/portfolio/[slug]` | — | ✓ | ✓ | ✓ | per-slug | Not exercisable — no published projects |
| `/privacy` | 200 | ✓ | ✓ | ✓ | **added in L1** | ✓ |
| `/terms` | 200 | ✓ | ✓ | ✓ | **added in L1** | ✓ |
| `/communication-consent` | 200 | ✓ | ✓ | ✓ | **added in L1** | ✓ |
| `/data-rights` | 200 | ✓ | ✓ | ✓ | **added in L1** | ✓ |
| `/warranty` | 200 | ✓ | ✓ | ✓ | **added in L1** | ✓ with RISK-06 |
| `/shop` | 200 | ✓ | — | — | — | Contained, `noindex` |
| `/lp/[slug]` | — | ✓ | — | — | — | `noindex, nofollow`, campaign-bound |
| `/q/[token]` | — | — | — | — | — | Token-gated; now `Disallow` in robots |

No dead public route was found. No accidental admin or internal link appears in
public navigation — asserted by test.

---

## 3. UI/UX acceptance

### 3.1 Homepage

Accepted. First screen answers who, what, where and what next: the hero states
complete home interiors, modular kitchens and wardrobes for Pune; the primary
CTA is "Get Free Design Consultation" (`/#consultation`); the secondary path is
Portfolio. Section order is hero → services → portfolio proof → about → process
→ consultation capture → footer.

### 3.2 `/interiors`

Accepted as the primary paid-search landing page. The consultation form is live
and `active` on it, so campaign traffic can convert without a second page view.

### 3.3 Portfolio

Accepted **with a finding** — see §6, BLOCK-L1-01.

One defect fixed: the empty state offered only "View All Projects", which points
at `/portfolio`. With a genuinely empty portfolio — the current live state —
that link returns the visitor to the page they are already on. A filtered-empty
state still gets the reset link; an unfiltered-empty state now gets the
consultation CTA instead.

### 3.4 CTA matrix

| Intent | Label | Destination | State |
| --- | --- | --- | --- |
| Primary | Get Free Design Consultation | `/#consultation` | Live |
| Primary (mobile) | Get Free Design | `/#consultation` | Live |
| Secondary | View Portfolio / View Full Portfolio | `/portfolio` | Live |
| Service-specific | per-service consultation deep links | `/?service=…#consultation` | Live |
| Communication | WhatsApp | — | **Absent by design until L5** |
| Phone | — | — | **Absent — no business phone recorded** |

`PUBLIC_WHATSAPP_HREF` remains hard-coded `null`. No `wa.me` destination was
invented and no personal number was hard-coded. After L5 the CTA belongs in
`DiscoveryStickyCta` (which already reads `getPublicWhatsAppHref()` and hides
itself when it is `null`) and in the header actions.

### 3.5 Trust and contact — one deliberate non-change

The public marketing UI carries **no e-mail link and no sales address**. That is
a locked prior decision and this phase deliberately did not relax it: the
consultation form is the single conversion path, and an e-mail link produces
enquiries that never reach CRM and carry no attribution — precisely what L7
exists to prevent. The published business address stays on the legal pages as a
governance contact.

An initial L1 draft added a footer e-mail before the existing suite caught the
conflict. The suite was right. What remains is the studio address and service
area, read from `BUSINESS_IDENTITY` so the site and the Privacy Notice cannot
drift, plus a consultation link — a trust and NAP signal, not a second funnel.

---

## 4. Cache and performance — the L1 launch blocker, CLOSED

**Previous header** (LIVE, all prerendered public pages):

```
Cache-Control: s-maxage=31536000
```

**Root cause.** Not nginx, not a CDN. `/`, `/interiors` and the five legal pages
are statically prerendered (`○` in the build table). A Next.js page that is
prerendered and declares no `revalidate` is treated as immutable and served with
a one-year shared-cache lifetime. `/portfolio` and `/shop` were already dynamic
and unaffected.

**Correction.** One decision — `PUBLIC_HTML_REVALIDATE_SECONDS = 300` in
`src/config/public-cache.ts` — and `export const revalidate = 300` on each of
the seven pages.

The literal is required: Next reads a route segment config by static analysis,
so `export const revalidate = PUBLIC_HTML_REVALIDATE_SECONDS` fails the build
with *"Invalid segment configuration export detected"*. That was tried first.
A test therefore asserts every page's literal equals the constant, which is a
stronger guarantee than the import would have been.

`export const expire` was also tried, to shorten the stale-while-revalidate
tail. Next 16.3.3 accepts it and ignores it — the Expire column stayed at `1y` —
so it was removed rather than left in as an export that does nothing.

**Final header** (BUILD, verified against `next start`):

| Route | Cache-Control |
| --- | --- |
| `/` | `s-maxage=300, stale-while-revalidate=31535700` |
| `/interiors` | `s-maxage=300, stale-while-revalidate=31535700` |
| `/privacy`, `/terms` | `s-maxage=300, stale-while-revalidate=31535700` |
| `/portfolio` | `private, no-cache, no-store, max-age=0, must-revalidate` (unchanged) |

**Why this is safe.** `s-maxage=300` means a shared cache revalidates within
five minutes. The stale-while-revalidate tail lets it serve the stale copy
*once* while it refreshes in the background, so under ad traffic a deploy, a tag
change or a gate flip is visible on the next request after the window. Hashed
assets under `/_next/static` are content-addressed and keep their own immutable
caching; this change is about HTML only. `no-store` was deliberately not used —
`/` and `/interiors` are the paid landing pages and making them dynamic would
trade their speed for a problem that does not exist.

**How to verify after deploy:**

```
curl -sI https://onedecore.in/ | grep -i cache-control
# expect: s-maxage=300, stale-while-revalidate=...
```

---

## 5. SEO and indexability

| Item | Before | After |
| --- | --- | --- |
| `robots.txt` disallow | `/admin/`, `/api/admin/`, `/auth/` | **+ `/manager/`, `/q/`** |
| Sitemap | `/`, `/interiors`, `/portfolio` | **+ the five legal pages**, gated on `getLegalRobots().index` |
| Legal canonicals | none (`canonical: undefined`) | **emitted when indexable** |
| Launch page canonical/OG | present | unchanged |

`/manager` redirects rather than renders and `/q/` is a customer's own quotation
behind a capability token; neither is worth a crawler's time.

The legal canonical was previously suppressed unconditionally. That was right
for a draft — a `noindex` draft is not the canonical address of anything — but
the documents are published now, and a URL submitted in a sitemap with no
canonical is a gap. It is emitted only when `getLegalRobots().index` is true, so
a future return to draft mode withdraws it automatically.

**One prior assertion was updated, deliberately.** `phase-3a1-2-activation-gates`
asserted that `sitemap.ts` never mentions a legal path. That was correct while
the documents were drafts. They are published now, so the original hazard is
gone; the test now asserts the *reason* instead — that legal paths are pushed
only from inside the publication gate.

---

## 6. Findings that L1 does not close

| ID | Finding | Owner | Why not closed here |
| --- | --- | --- | --- |
| **BLOCK-L1-01** | **The portfolio is empty.** LIVE `/portfolio` renders "No projects found"; the sitemap contains zero project URLs. The only proof surface on a high-consideration purchase has nothing on it, and the homepage simultaneously advertises "500+ Projects Delivered" and "4.9/5 Average Rating". Paid traffic landing on that combination is a conversion problem and a credibility problem at once. | OWNER | Content, not code. Publishing projects is an owner action in the portfolio admin. |
| **BLOCK-L1-02** | **Homepage trust claims have no recorded substantiation.** `HOME_CLAIMS` renders 500+ projects, 4.9/5 rating, 200+ reviews, 98% client satisfaction, 10-year warranty and "Own Manufacturing Unit". The file calls them owner-approved and already withholds JSON-LD `aggregateRating` "until evidence URLs exist" — the evidence gap is acknowledged in the code. Google Ads and Meta both restrict unsubstantiated performance and review claims; a disapproval during launch is a real cost. | OWNER | Changing live marketing claims is a business decision. Nothing was altered. Before spend, either record the substantiation or soften the review-type claims. |
| RISK-01 | No `Strict-Transport-Security` header. | OWNER/ENG | nginx configuration, outside the application. |
| RISK-06 | `/warranty` is published while `warrantyClaimsEmail` is unrecorded, and the homepage advertises a 10-year warranty. | OWNER | Owner input. |
| RISK-07 | Public identity is `onedecore@gmail.com`, a consumer mailbox on a verified domain. | OWNER | Owner decision. |

### 6.1 Explicit L2 blockers (unchanged, must precede L3)

- **BLOCK-03** — published legal copy states that no analytics, Meta Pixel or
  advertising cookie is approved. Installing a tag before correcting it makes
  the Privacy Notice false.
- **BLOCK-04** — no consent mechanism exists for non-essential cookies.

L1 adds a test that fails if a tag manager, GA4 or Pixel reference appears on
any public surface, so the ordering is enforced rather than remembered.

### 6.2 Explicit L3A attribution blockers (unchanged)

- **BLOCK-05** — attribution does not survive navigation.
- **BLOCK-06** — `fbc`/`fbp` are read from the query string, not the Pixel cookies.
- **BLOCK-07** — external referrers are discarded.

L1 changed none of the attribution code and adds a test asserting it did not
start writing cookies or storage.

### 6.3 Explicit L5 WhatsApp blockers (unchanged)

- **BLOCK-08** — no public WhatsApp CTA. **BLOCK-09** — WhatsApp legal
  activation neither recorded nor wired. **BLOCK-10** — production
  configuration absent. **BLOCK-15** — no public business phone.

---

## 7. Mobile and accessibility

Method: source and live-HTML inspection. **A device or emulated-viewport pass at
360 / 390 / 412 / tablet / desktop was not performed** — it needs a browser, and
that remains the outstanding L1 evidence item.

What was verified:

| Check | Result |
| --- | --- |
| Tap targets | `min-height: 44px` declared across the three public stylesheets, and applied to every footer and header anchor |
| Phone input | `type="tel"`, `inputMode="numeric"`, `autoComplete="tel-national"` |
| Name input | `autoComplete="name"` |
| Page-level horizontal overflow | `overflow-x: clip` on the discovery container; wide rails scroll inside their own `overflow-x: auto` |
| Semantic structure | `<address>` used for the studio block; footer nav labelled; skip link present |
| Reduced motion | Hero counters honour `prefers-reduced-motion` and seed with the final value for SSR/no-JS |
| Mobile drawer | `aria-expanded`, `aria-controls`, `aria-modal`, focus trap, scrim |

The new footer column adds no fixed or sticky element and stacks to one column
below 560px.

---

## 8. Consultation form acceptance

Preserved, not rebuilt. **No production lead was submitted.**

| Check | Result | Evidence |
| --- | --- | --- |
| Mode | `active` | LIVE `data-lead-form-mode="active"` on `/` and `/interiors` |
| Steps | 3, with a live step indicator | LIVE `data-od-consult-step="1"` |
| Indian phone UX | preserved | LIVE `data-od-lead-phone-ux="national-10"` |
| Consent separation | preserved — service enquiry / phone / WhatsApp service | CODE + test |
| Marketing consent fabrication | **none** | CODE + test |
| Attribution collection | unchanged | CODE + test |
| Double-submit protection | session-scoped idempotency key, in memory | CODE |
| Honeypot | present | CODE |

Whether a submission actually reaches CRM in production remains **L0 BLOCK-12**,
open. It needs one real submission, which requires explicit owner approval.

---

## 9. Tests

New: `src/features/public-site/__tests__/l1-public-launch-acceptance.test.ts` —
36 tests across 7 suites, covering the cache policy, the tag refusal, storefront
containment, the contact/no-funnel-leak rule, dead ends, indexability, and that
the lead funnel was not disturbed.

Updated: `phase-3a1-2-activation-gates` — the expired legal-sitemap assertion.

| Gate | Result |
| --- | --- |
| `npm run test:public-launch` | 85/85 pass |
| lead-intake public tests | 52/52 pass |
| `npm run test:app` | 3150/3152 pass — see below |
| `npm run lint` | 0 errors (30 pre-existing warnings) |
| `npm run typecheck` | clean |
| `npm run build` | clean; all seven public pages show `5m` revalidate |
| `git diff --check` | clean |

The two failures are **pre-existing on clean `main`** and Windows-only. Both are
source-text assertions written against LF while `core.autocrlf=true` gives the
working tree CRLF: `crm-lead-delete.test.ts` → "the first quotation is
serialized against the delete", and `sales-manager-dashboard.test.ts` → "the
panel renders status, both phases and both roles". Verified by stashing this
branch and running both against a clean tree. Neither file is touched by L1 and
both pass in CI on Linux.

---

## 10. L1 exit gate

| Criterion | State |
| --- | --- |
| Desktop acceptance | **MET** (source + live HTML) |
| Mobile acceptance | **PARTIAL** — static checks pass; viewport pass outstanding (§7) |
| Form reaches CRM | **NOT MET** — L0 BLOCK-12, needs an approved production submission |
| WhatsApp CTA destination final | **DEFERRED to L5** by design |
| No dead linked route | **MET** — and the portfolio dead end is fixed |
| Cache blocker closed | **MET** (§4) |
| Launch scope frozen, `/shop` decided | **MET** (§1) |
| UI frozen for campaign learning | **MET** for structure; §6 content items remain |

**The website is not launch-certified.** That is L8.
