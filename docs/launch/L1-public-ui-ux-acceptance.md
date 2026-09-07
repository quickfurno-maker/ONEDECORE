# L1 — Public UI/UX Acceptance and Launch-Scope Hardening

**Phase:** L1 (Final Public UI/UX Acceptance + Launch-Scope Hardening)
**Date:** 2026-09-07
**Base `origin/main`:** `4b15ca3404cf9e34f7ea52438df900de891ee734` (merge of PR #154, the L0 audit)
**Branch:** `feat/public-launch-l1-ui-ux-acceptance`
**Production URL:** https://onedecore.in

**The website is NOT launch-certified by this document.** Certification is L8.
L1 accepts the public UI/UX and closes the cache blocker; the measurement,
consent and WhatsApp lanes remain open.

> **Final correction applied.** Three further blockers were found in review and
> are closed here: the warranty page was being made canonical and submitted to
> the sitemap while its own readiness gate says draft; the launch surfaces were
> still rendering numeric and review claims the repository itself records as
> unevidenced; and the viewport pass had not been run. See §4A, §4B and §7.

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
| `/warranty` | 200 | ✓ | ✓ | ✓ | **none — deliberate** | ✓ — `noindex`, not in sitemap, see §4A |
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

**What the header actually means.** Precisely, and without overclaiming:

- the representation is **fresh for 300 seconds**;
- after that a shared cache **may serve the stale copy** while it revalidates in
  the background — that is what `stale-while-revalidate` licenses, and the tail
  is long;
- a **successful revalidation replaces** the representation, so the next request
  after that gets the new one.

What this does **not** guarantee is that every intermediary purges exactly at
five minutes. Behaviour depends on the cache: some revalidate on the first
request after the fresh window, some prefetch, some ignore `stale-while-revalidate`
entirely and simply refetch. The guarantee that matters is the one this replaces
— a cache is no longer told the page is good for a year.

Hashed assets under `/_next/static` are content-addressed and keep their own
immutable caching; this change is about HTML only. `no-store` was deliberately
not used: `/` and `/interiors` are the paid landing pages and making them
dynamic would trade their speed for a problem that does not exist.

**How to verify after deploy.** Probe the header *and* the content, because the
header alone does not prove propagation:

```
# 1. the policy is in force
curl -sI https://onedecore.in/ | grep -i cache-control
# expect: s-maxage=300, stale-while-revalidate=...

# 2. the deployed content is actually being served — pick a string that
#    changed in the release and confirm it appears, then re-probe after the
#    300s window from a cold client to confirm it persists
curl -s https://onedecore.in/ | grep -c "<marker from this release>"
```

---

## 4A. Warranty indexability — corrected

An earlier revision of this branch added all five legal paths to the sitemap and
gave them canonicals whenever `getLegalRobots().index` was true. That gate is the
GLOBAL legal publication mode, and it is `published`. Warranty does not belong to
it.

| Fact | Value |
| --- | --- |
| `LEGAL_PUBLICATION_MODE` | `published` |
| `getLegalRobots()` | `{ index: true, follow: true }` |
| `WARRANTY_POLICY_STATUS` | `scope-pending-owner-approval` |
| `WARRANTY_MATRIX_STATUS` | `scope-pending-owner-approval` |
| every category period | `null` |
| `warrantyClaimsEmail` | `null` |
| `canPublishWarrantyPolicy()` | **`false`** |

So the branch was about to make a page that says *"detailed category coverage is
not yet effective"* the canonical, indexed, sitemap-submitted statement of
ONEDECORE's warranty. That is worse than not publishing it at all.

**Correction.** `buildLegalPageMetadata()` gained an optional `published`
override. Passing `published: false` forces `noindex, nofollow` and withholds the
canonical, whatever the global mode says; omitting it keeps the global gate, so
Privacy, Terms, Data Rights and Communication Consent are untouched. The warranty
page passes `canPublishWarrantyPolicy()`. The sitemap's generic legal loop no
longer contains `warranty`; it is pushed from its own `if
(canPublishWarrantyPolicy())` block.

Nothing about warranty readiness was faked. The page stays reachable to a human
following the footer link and keeps its draft notice — what changed is only what
is offered to a search engine.

| Route | robots | canonical | sitemap |
| --- | --- | --- | --- |
| `/privacy`, `/terms`, `/data-rights`, `/communication-consent` | index, follow | yes | listed |
| `/warranty` | **noindex, nofollow** | **none** | **absent** |

## 4B. Unsupported public claims — suppressed

The repository already recorded the truth and the site was ignoring it.
`BUSINESS_TRUTH_REGISTRY` carries `publicEvidenceStatus: "pending"` for every
public claim; `HOME_VERIFIED_REVIEWS` is empty; `HOME_REVIEW_SOURCE_URL` is
`null`; `WARRANTY_POLICY_STATUS` is pending with every period `null`. The
homepage and `/interiors` were nonetheless rendering *500+ Projects Delivered*,
*4.9/5 Average Rating*, *200+ Client Reviews*, *98% Client Satisfaction*, *100%
Custom Designs*, *10-Year Warranty* and a decorative five-star field.

The confusion was structural: `ownerApprovalDisplayCopy` (the owner approved the
wording) was being treated as though it were `publicEvidenceStatus` (somebody can
point at the source). They are different things, and only the second licenses a
number.

**Correction.** `src/features/legal/claim-evidence.ts` records the status once.
`business-truth-registry` now derives its per-claim statuses from it, so the
register and the page cannot disagree. `claims.ts` exposes
`canQuotePublicClaim()` and `publicClaimLabel()`, and every surface asks before
quoting.

| Claim | Before | Now |
| --- | --- | --- |
| Projects delivered | "500+ Projects Delivered" | "Complete Homes, Delivered End To End" |
| Average rating | "4.9/5 Average Rating" | **withheld entirely** |
| Client reviews | "200+ Client Reviews" | **withheld entirely** |
| Client satisfaction | "98% Client Satisfaction" | **withheld entirely** |
| Warranty | "10-Year Warranty" / "10-Year Warranty Support" | "Warranty On Approved Scopes" / "After-Sales Support On Approved Scopes" |
| Custom designs | "100% Custom Designs" | "Made To Measure, Never Off The Shelf" |
| Own manufacturing unit | "Own Manufacturing Unit" | **retained** — a factual statement about how the business operates, not a measured figure. No factory address or certificate is asserted. |
| Free design consultation | "Free Design Consultation" | **retained** — an offer, not a metric. |

A rating, a review count and a satisfaction percentage have **no qualitative
substitute**: "highly rated" is the same unsourced claim in vaguer words. Those
disappear rather than being softened. The aggregate review block —
score, decorative stars and both stat cells — is gated on
`canShowAggregateReviewSummary()`, which additionally requires a source URL a
reader could check. The section itself remains, carrying process copy and both
conversion CTAs, and its heading changes with it.

The FAQ answer "ONEDECORE offers 10-year warranty support…" now states the
support without the term.

**Nothing was fabricated.** No evidence URL was invented, no testimonial written,
no status flipped to `verified`, no warranty policy approved in code. Verified
against a local production build: zero occurrences of `500+`, `4.9`, `200+`,
`98%`, `100% Custom` or `10-Year` on `/` or `/interiors`.

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
| **BLOCK-L1-01** | **The portfolio is empty.** LIVE `/portfolio` renders "No projects found"; the sitemap contains zero project URLs. The only proof surface on a high-consideration purchase has nothing on it. **OWNER CONTENT LAUNCH BLOCKER — must be resolved before paid spend / L8.** Closeout evidence: real owner-approved published projects, real imagery with truthful metadata, portfolio-media consent/evidence under existing governance, and real project detail URLs in the sitemap. **No project data was seeded and none was fabricated.** | OWNER | Content, not code. Publishing projects is an owner action in the portfolio admin. The empty-state UX fix from this PR is retained. |
| RISK-01 | No `Strict-Transport-Security` header. | OWNER/ENG | nginx configuration, outside the application. |
| RISK-06 | `warrantyClaimsEmail` is unrecorded and every warranty period is `null`. | OWNER | Owner input. The *indexing* consequence is closed in §4A: the page is `noindex` and absent from the sitemap. The claim itself no longer states a duration (§4B). What remains open is recording the terms. |
| RISK-07 | Public identity is `onedecore@gmail.com`, a consumer mailbox on a verified domain. | OWNER | Owner decision. |

**BLOCK-L1-02 (unsupported public claims) is CLOSED by this correction** — see
§4B. The figures are suppressed behind an evidence gate rather than deleted, so
recording real evidence restores them without another code change. What remains
owner work is the evidence itself.

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

## 7. Mobile and accessibility — real viewport pass, COMPLETED

The earlier revision stated that no viewport pass had been run. It has now.

**Method.** Chrome could not be driven to the target widths directly — the
extension's window resize is clamped by the platform minimum (a request for 412
produced a 958 CSS-px viewport). Each route was therefore loaded in a
**same-origin iframe of exact CSS pixel dimensions**, which gives genuine
viewport widths: media queries, `100vw`, sticky/fixed positioning, overflow and
element geometry all evaluate against the iframe viewport. Framing required
relaxing `X-Frame-Options` to `SAMEORIGIN` in a **throwaway local build only**;
`next.config.ts` was reverted immediately afterwards and is unchanged in this
branch. The local build also set `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE=active`
so the consultation form rendered, since the local `.env.local` is `copy-only`.

Not covered by this method: touch emulation, device pixel ratio, and mobile
browser chrome affecting `100vh`.

### 7.1 Matrix — `/`, `/interiors`, `/portfolio` at six widths

| Width | Horizontal overflow | Hero clipped | Controls under 44px |
| --- | --- | --- | --- |
| 360 x 800 | **0px** | no | none |
| 390 x 844 | **0px** | no | none |
| 412 x 915 | **0px** | no | none |
| 768 x 1024 | **0px** | no | none |
| 1280 x 800 | **0px** | no | none |
| 1440 x 900 | **0px** | no | none |

All 18 route x width combinations. "Controls under 44px" excludes inputs wrapped
by a `<label>`, where the label is the real tap target.

### 7.2 Defects found and fixed

| Measured | Where | Fix |
| --- | --- | --- |
| `.pm-service__trigger` at **299x28** | `/interiors` service accordion — the primary interaction on the paid-search landing page. The button had no padding and no minimum, so it was exactly its text height. | `min-height: 44px`, `padding: 8px 0`, flex centring |
| `.pm-summary__edit` at **103x34** | plan summary "Edit My Plan" | `min-height: 44px` |
| `.od-site-header__mark` at **118x35** | header brand link — the way back to the homepage | new rule, `min-height: 44px` |

Re-measured after the fix: **zero** controls under 44px on any route at any width.

### 7.3 Two things that looked like defects and were not

Both were verified rather than "fixed", because fixing them would have been
churn:

- **Consent checkboxes measure 20x20.** The `<input>` is 20px, but the `<label>`
  **wraps** it and measures 279x61 at 360px and 309x61 at 390px. Clicking
  anywhere in that 61px-tall label toggles the box, so the practical tap target
  is comfortably above 44px.
- **The sticky dock appeared to cover form controls.** At one scroll position it
  intersects them — which is true of any fixed bottom bar. Scrolled to the true
  page bottom, `submitUnderDock` is `false` at both 360 and 390: the submit
  button clears the dock and is reachable.

### 7.4 Consultation form, all three steps

Driven programmatically at all six widths: select service (auto-advances to step
2), select the qualifier (advances to step 3), then measure step 3 with its
contact fields and three consent checkboxes.

| Check | Result |
| --- | --- |
| Reaches step 3 at every width | yes |
| Horizontal overflow on any step | **0px** |
| Controls under 44px (excluding label-wrapped) | none |
| Submit reachable clear of the sticky dock | yes |
| Step transitions jumping under fixed UI | none observed |
| JavaScript errors during the walk | **none** |

### 7.5 Navigation, empty state, console

| Check | Result |
| --- | --- |
| Mobile drawer toggle | 44x44; `aria-expanded` toggles true/false; `aria-modal="true"`; fully within the viewport; 5-6 links, none under 44px |
| Desktop 1440 | toggle correctly hidden, inline nav shown |
| Portfolio empty-state CTA | present, **226x44**, `href="/#consultation"`, within the viewport |
| Console errors / warnings | **none** on `/`, `/interiors`, `/portfolio` — listeners attached at load and observed for ~2.6s past hydration |
| Hydration mismatches | none observed |
| Reduced motion | hero counters honour `prefers-reduced-motion` and seed with the final value for SSR/no-JS |

### 7.6 Static checks retained

`min-height: 44px` across the public stylesheets; `type="tel"` +
`inputMode="numeric"` + `autoComplete="tel-national"`; `autoComplete="name"`;
`overflow-x: clip` on the discovery container with wide rails scrolling inside
their own `overflow-x: auto`; `<address>` for the studio block; labelled footer
nav; skip link.

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
**57 tests across 11 suites**, covering the cache policy, the tag refusal,
storefront containment, the no-funnel-leak contact rule, dead ends,
indexability, the warranty publication gate, the claim-evidence gate, the
rendered surfaces, the measured tap targets, and that the lead funnel was not
disturbed.

Updated:

- `phase-3a1-2-activation-gates` — the expired legal-sitemap assertion.
- `phase-10c-homepage-launch-ux` and `phase-10e-interior-launch-closeout` — both
  treated owner-approved wording as though it were public evidence. They now
  assert the evidence gate alongside the claim source, which is the distinction
  §4B exists to draw.

| Gate | Result |
| --- | --- |
| `npm run test:public-launch` | **106/106 pass** |
| focused legal + warranty readiness tests | pass (within the above) |
| lead-intake public tests | 52/52 pass |
| `npm run test:app` | **3171/3173 pass** — see below |
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
| Mobile acceptance | **MET** — real viewport pass at six widths across three routes, three tap-target defects fixed (§7) |
| Form reaches CRM | **NOT MET** — L0 BLOCK-12, needs an approved production submission |
| WhatsApp CTA destination final | **DEFERRED to L5** by design |
| No dead linked route | **MET** — and the portfolio dead end is fixed |
| Cache blocker closed | **MET** (§4) |
| Launch scope frozen, `/shop` decided | **MET** (§1) |
| Unsupported public claims suppressed | **MET** (§4B) |
| Warranty indexability correct | **MET** (§4A) |
| UI frozen for campaign learning | **MET** for structure; the empty portfolio (BLOCK-L1-01) remains owner content work |

**The website is not launch-certified.** That is L8.
