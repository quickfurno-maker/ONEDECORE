# L1.1 — Homepage Conversion Refinement

**Phase:** L1.1 (owner-directed, after L1 / PR #155)
**Date:** 2026-09-07
**Base `origin/main`:** `179c96215c8cd7e1453ae1880b9db50ac24025f2` (merge of PR #155)
**Branch:** `feat/public-homepage-conversion-refinement`

Four owner-directed changes to the homepage. No migration, no managed Supabase,
no analytics or provider activation.

---

## 1. The projects counter is back — and only that one

**`500+ Projects Delivered` renders again**, below the hero, animating 0→500 on
first viewport entry, with reduced motion showing the final value immediately.

### 1.1 How, without calling it verified

`publicEvidenceStatus` for every claim is still `pending`. Nothing became
evidenced. Instead `claim-evidence.ts` gained a third state:

```ts
readonly ownerAttestedDisplay?: { attestedOn: string; note: string };
```

**Owner-attested display is not public evidence verified.** The two questions are
now asked by two different functions, and they disagree on purpose:

| Question | Function | `projects-delivered` |
| --- | --- | --- |
| Can anyone point at a source? | `isClaimPubliclyEvidenced` | **`false`** |
| May the figure be rendered? | `isClaimDisplayable` | **`true`** |

The business-truth register reads `isClaimPubliclyEvidenced`, so it still
reports the claim as pending. `structuredDataPermission` stays `false` — no
`aggregateRating`, no `Review`, nothing a search engine could index as fact. The
attestation changes exactly one thing: whether the figure appears as visible
copy.

The grant is per claim and dated. `getOwnerAttestedClaimIds()` returns
`["projects-delivered"]` and nothing else.

### 1.2 What did NOT come back

`4.9/5`, `200+ Client Reviews`, `98% Client Satisfaction`, `10-Year Warranty`
and `100% Custom Designs` remain withheld, exactly as L1 left them. The owner
authorised the project count specifically.

An attested claim that also promises contractual terms still waits for them —
attestation is not a bypass for the warranty, and a test proves it.

### 1.3 Trust strip order

The counter is rendered separately from the marquee, because a number that
scrolls past is a number nobody reads.

1. **500+ Projects Delivered** (static, animated)
2. Own Manufacturing Unit
3. Design → Manufacture → Install
4. Pune-wide consultation
5. Warranty on approved scopes
6. Locality ticker — Kharadi · Baner · Wakad · Hinjewadi · Koregaon Park

---

## 2. Image-only hero

The hero is photography and nothing else. Removed: kicker, rotating headline,
lede, badge, the trust bar and the prev/next arrows. Kept: the sliding images,
their focal-point cropping, autoplay, swipe, and small position dots.

**Autoplay is 5.5s**, and the progress bar animation was changed to match — it
had been claiming 6s.

**Accessibility.** A page needs one H1 and a decorative banner cannot be it, so
the H1 is rendered visually hidden (`od-sr-only`) carrying the page identity.
The images are `alt=""` because they are decoration; a screen reader user gains
nothing from hearing five photograph descriptions. The dots are labelled by
position — "Show image 2 of 3" — rather than by the headlines that are no longer
on screen. `role="tabpanel"`, `aria-controls` and `inert` went with the copy
panels they described; the dots remain a `tablist` with arrow-key navigation.

**Measured heights** (real viewport pass, §5):

| Viewport | Height | Target |
| --- | --- | --- |
| 360 / 390 / 412 | **56vh** | 52–60vh ✓ |
| 768 | 53vh | — |
| 1280 / 1440 | **68vh** | 65–72vh ✓ |

The sizing rule is written as `.od-disc-hero.od-disc-hero--imageOnly` — a
doubled class for specificity, not for style. The responsive blocks near the end
of `discovery.css` set `.od-disc-hero` min-height for the old text hero (40rem,
which is 80vh on a phone), and a single-class rule would have lost to them on
source order however correct it was.

---

## 3. WhatsApp beside the sticky consultation CTA

**The number is configuration, not code.** `PUBLIC_WHATSAPP_HREF` was a
hard-coded `null` with a comment saying not to invent one — the right instinct
and the wrong mechanism, since turning the button on meant editing and
redeploying the application.

`NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164` supplies it now, **validated**:

| Configured | Result |
| --- | --- |
| unset / empty | `null` → button absent |
| `9876543210` (no country code) | `null` |
| `+0123456789` (leading zero) | `null` |
| `+1234567` (too short) | `null` |
| `+91 98765 43210` | `https://wa.me/919876543210?text=…` |
| `+919876543210` | same |

Human spacing and dashes are tolerated; the stored form is digits only.
**Missing or malformed configuration means the button is absent, never
present-and-dead** — a WhatsApp button that does nothing is worse on a
conversion surface than no button.

Prefill: `Hi ONEDECORE, I'd like to discuss my home interiors.` Service enquiry
wording, not marketing.

**Layout.** Mobile: `[ WhatsApp ] [ Free Consultation ]`, both **48px** tall
(above the 44px floor) with `padding-bottom: max(0.55rem,
env(safe-area-inset-bottom))`. Desktop ≥1024px: a floating pill at the
bottom-right, the two actions side by side rather than spanning the viewport.

**Hooks only.** `data-conversion-action="whatsapp-click"` and
`data-conversion-action="consultation-sticky"`. Nothing reads them — no GTM, no
GA4, no Pixel. L2 has to correct the published legal copy before anything does.

**No number is committed.** The variable is unset in this branch; publishing one
is an owner action on the VPS.

---

## 4. Single-step consultation form

The three-step SERVICE → QUALIFIER → CONTACT flow is one compact card.

| Field | State |
| --- | --- |
| **What do you need?** | one `<select>` — Complete Home Interiors / Modular Kitchen / Custom Wardrobe |
| Full name | required |
| Mobile number | required, `national-10` UX preserved |
| Pune area / locality | optional |
| Add a note | optional, collapsed behind a toggle |

Removed: the step counter, the qualifier dropdown, the auto-advance, and the
gating that hid the phone number until a qualifier was chosen. A step counter on
a four-field form advertises work that is not there, and the business does not
need a BHK to start a conversation — the designer asks on the call, which is
what the call is for.

**Submit:** one button, `Get Free Design Consultation`.
**Success:** *"Thank you. We received your consultation request and will follow
up."* — confirms receipt, promises no appointment or quotation.

### 4.1 The qualifier is optional, not unvalidated

Three layers had to agree, and each keeps its strictness:

| Layer | Before | Now |
| --- | --- | --- |
| `lead-form-errors` client validation | required for `consultation` | not required |
| `consultation-to-lead-request` | required | **absent when unasked**; a supplied code must still be real and of the kind the service implies |
| `lead-intake-validation` server | required for `public-consult-v1` | `null` accepted; anything present is checked exactly as before |

So a wardrobe enquiry still cannot carry a BHK, and the unasked-field rejection
for `property`, `timeline`, `rooms`, `budgetComfort` and `estimate` is
untouched. **Nothing is invented to fill the gap** — the request simply carries
no qualifier.

Preserved unchanged: attribution collection, idempotency fingerprinting, the
honeypot, duplicate handling, rate limits, all three consents (service enquiry /
phone / optional WhatsApp service), and the Privacy and Terms links. No
marketing consent is fabricated. `active` submits; `preview` validates locally
and never posts; `copy-only` renders nothing.

---

## 5. Real viewport pass

Same method as L1: each route in a same-origin iframe of exact CSS pixel
dimensions, since Chrome's window resize is clamped by the platform minimum.
That needed `X-Frame-Options: SAMEORIGIN` in a **throwaway local build only**;
`next.config.ts` is reverted and shows zero diff. The local build also set
`NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE=active` and a test WhatsApp number.

| Viewport | Overflow | Hero | Dock buttons | Under 24px |
| --- | --- | --- | --- | --- |
| 360×800 | **0px** | 56vh | 48px, 48px | none |
| 390×844 | **0px** | 56vh | 48px, 48px | none |
| 412×915 | **0px** | 56vh | 48px, 48px | none |
| 768×1024 | **0px** | 53vh | 48px, 48px | none |
| 1280×800 | **0px** | 68vh | 48px, 48px | none |
| 1440×900 | **0px** | 68vh | 48px, 48px | none |

Also verified at every width: **zero visible text nodes inside the hero**, zero
hero CTAs, three dots, one service `<select>`, no step attribute, the counter
rendering `500+ Projects Delivered`, the submit at 48px and never covered by the
dock at the true page bottom, and **no console errors or hydration warnings**.

**One defect found and fixed.** The Privacy and Terms links inside the consent
hint measured **44×16**. They sit inline inside a sentence, so a 44px box would
break the line they live in; they are now **27px**, meeting the WCAG 2.5.8 AA
target size of 24px without disturbing the paragraph. This is stated precisely
rather than claimed as 44px.

---

## 6. Tests

New: `src/features/public-site/__tests__/l11-homepage-conversion-refinement.test.ts`
— **39 tests across 6 suites**. The largest group is the evidence model, because
that is what a restored figure most easily breaks: attestation and verification
must keep answering differently, the register must stay unchanged, and no other
claim may ride along.

Updated, each preserving the requirement it was written for:

| Suite | Was | Now |
| --- | --- | --- |
| `phase-10c-homepage-launch-ux` | hero arrows, headline-labelled dots, tabpanels, hard-coded WhatsApp `null` | image-only hero, position-labelled dots, hidden H1, configured-and-validated WhatsApp |
| `phase-10e-interior-launch-closeout` | `canQuotePublicClaim("projects-delivered") === false` | `true`, **with** `isClaimPubliclyEvidenced` still `false` |
| `public-conversion-ux` | two selects, staged submit, required qualifier, stale-answer clearing | one select, always-present submit, optional-but-validated qualifier, no answer left to go stale |
| `l1-public-launch-acceptance` | projects figure withheld; WhatsApp literal `null` | projects attested; WhatsApp config-driven |

| Gate | Result |
| --- | --- |
| `npm run test:public-launch` | **152/152 pass** |
| lead-intake public conversion tests | **44/44 pass** |
| `npm run test:app` | **3218/3220 pass** — see below |
| `npm run lint` | 0 errors (30 pre-existing warnings) |
| `npm run typecheck` | clean |
| `npm run build` | clean |
| `git diff --check` | clean |

The two failures are **pre-existing on clean `main`** and Windows-only —
source-text assertions written against LF while `core.autocrlf=true` gives the
working tree CRLF (`crm-lead-delete.test.ts`, `sales-manager-dashboard.test.ts`).
Neither is touched here and both pass on Linux CI.

---

## 7. Boundaries

No GTM, GA4, Meta Pixel, CAPI or Google conversion upload. No attribution
persistence — `lead-form-attribution.ts` still reads at submit and writes no
cookie or storage. No WhatsApp provider activation. No phone number published.
No campaign activated. No Manager auth, CRM permission, managed Supabase or
migration. No QuickFurno, no Jarvis. No ratings, reviews or warranty duration
restored. No fabricated evidence and no fabricated portfolio content — the
portfolio remains the owner content blocker recorded in L1 §6.
