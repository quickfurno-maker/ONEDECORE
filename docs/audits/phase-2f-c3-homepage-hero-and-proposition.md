# Phase 2F-C3 — Homepage Hero & Brand Proposition Audit

**Date:** July 27, 2026

**Gate:** Phase 2F-C3 Homepage Hero & Brand Proposition

**Status:** `PHASE_2F_C3_HOMEPAGE_HERO_PROPOSITION_COMPLETE`

**Branch:** `phase-2f-public-website-experience`

**Base HEAD:** `65ac2176759b36ced2eb065057de6d916b92261d`

---

## Hero asset provenance

> **Superseded 27 Jul 2026.** The first C3 asset (procedural WebP, 9,240 bytes) failed the
> rendered visual-quality gate — it read as flat horizontal gradient bands rather than a
> premium architectural editorial surface. It was replaced under the hero-replacement gate.
> See *Hero asset replacement* below for the production record.

| Field | Value |
|---|---|
| Path | `public/marketing/hero/homepage-hero-architectural.webp` |
| Category | **C** — abstract architectural marketing artwork (not presented as completed work) |
| Source method | Generated in-editor from a written art-direction brief, then optimised locally with the existing `sharp` dependency |
| Generation capability | Cursor in-editor image generation (three candidates authored, one selected) |
| Generation date | 27 July 2026 |
| Owner/provider | ONEDECORE / quickfurno-maker |
| Generated artwork | **Yes** |
| Depicts real project work | **No** |
| Website use permission | Yes |
| Public GitHub redistribution | **Yes** (ONEDECORE-owned binary, no third-party licence encumbrance) |
| Attribution requirement | None |
| Source dimensions / format | 1536 × 1024 PNG (native 3:2) |
| Final dimensions / format | 1920 × 1280 WebP |
| Final encoded bytes | 188,526 (120–200 KB budget) |
| Encoder settings | `sharp` lanczos3 resize → unsharp (σ 0.6) → `webp` quality 78, effort 6, smart subsample |
| Colour / metadata | sRGB, no alpha, EXIF and ICC stripped |
| Desktop focal point | `58% 45%` |
| Mobile focal point | `66% 50%` |
| Alt | Abstract architectural composition of layered travertine and limestone planes with slim bronze reveals and deep charcoal shadow |
| Presentation boundary | Marketing artwork only; never captioned or implied as an ONEDECORE client project |

### Hero asset replacement

| Item | Result |
|---|---|
| Candidates authored | 3 (A, B, C) |
| Candidate review | 100% and 200% zoom, plus 1440/1280/1024/390/360/844-landscape crops |
| Rejected A | Bright plaster left plane forced an excessive scrim for white copy |
| Rejected B | Bronze framing read heavy and the palette drifted warm |
| Selected C | Layered travertine/limestone planes, slim bronze reveals, charcoal recesses, mid-tone left negative space, focal detail right of centre |
| 200% zoom | Authentic travertine pitting and veining; no banding, blocking, blur or repeated procedural pattern |
| Remote hotlink / private Storage path | None — local `public/` binary only |

---

## Approved copy (exact)

| Field | Text |
|---|---|
| H1 | One Vision. Complete Interiors. |
| Supporting line | Complete home interiors, modular kitchens, and custom wardrobes in Pune. |
| CTA | Explore Our Work → `/portfolio` |
| Brand proposition H2 | Interior design with clarity and craft |
| Brand proposition body | ONEDECORE brings complete home interiors, modular kitchens, and custom wardrobes to homes across Pune — with a single vision from concept through installation. |

No unsupported claims, statistics, testimonials, or `OWNER CONTENT REQUIRED` placeholders rendered.

---

## CTA deferral

Primary owner-approved CTA **Book a Design Consultation** remains deferred (`cta: null` in shell configs) because `/contact` does not exist. Hero renders exactly one action: **Explore Our Work** → `/portfolio`.

---

## Implementation summary

| Component | Path | Boundary |
|---|---|---|
| HeroSection | `components/home/HeroSection.tsx` | Server |
| HeroMediaMotion | `components/home/HeroMediaMotion.tsx` | Client (media scale only) |
| BrandProposition | `components/home/BrandProposition.tsx` | Server |
| Homepage copy | `content/homepage.ts` | Static |
| Hero asset contract | `config/home-hero.ts` | Static |

### Homepage composition

`Public shell` → `HeroSection` → `BrandProposition` → `FeaturedPortfolioSection` → `PublicFooter`

### Overlay header

- `(public)/(home)/layout.tsx` uses `HOMEPAGE_SHELL_CONFIG` with `headerMode: "overlay"`.
- `(public)/(solid)/layout.tsx` uses `PRODUCTION_SHELL_CONFIG` with `headerMode: "solid"` for `/portfolio/*`.
- Scroll threshold: 80px; returns to overlay at top.

### Motion

| Element | Behaviour |
|---|---|
| Hero media | Scale `1.05 → 1.0` over `--duration-slow` (`800ms`), `--ease-out` |
| Mobile | Scale animation disabled (`max-width: 767px`) |
| Reduced motion | Static final state immediately |
| Copy | `Reveal` progressive enhancement (opacity/translate) |
| Header | Existing C2 CSS transition (`300ms`) |

---

## Portfolio preservation

- No changes to featured query, DTO, cache tags, repository, RLS, or card styling.
- `FeaturedPortfolioSection` moved below `BrandProposition` only.

---

## Sitemap runtime fix

Added `export const dynamic = "force-dynamic"` to `src/app/sitemap.ts` so CMS-driven project URLs resolve at request time during production HTTP verification (build-time static generation returned an empty project list when the database was unavailable at compile time). No portfolio query/DTO contract changes.

---

## Tests

- Added `public-site-c3.test.ts` (+22 tests).
- Updated C2 layout assertions for route-group shells.
- **Application tests:** 162/162 pass (> 140 gate).

---

## Quality gate results

| Gate | Result |
|---|---|
| DB tests | 107/107 |
| App tests | 162/162 |
| Image tests | 17/17 |
| TypeScript | Clean |
| Lint | Exit 0 (3 pre-existing warnings in gitignored tooling) |
| Build / check | Pass |
| npm audit (omit dev) | High 3, Critical 0 (unchanged) |
| Migrations | 8 synchronized, 0 new |
| HTTP regression | 13/13 |
| Deep assertions | 82/82 |

---

## Browser / fidelity QA (Direction A)

Viewports exercised: 1440×1024, 1280×800, 1024×768, 768×1024, 390×844, 360×800, 200% zoom, landscape mobile.

| # | Finding | Resolution |
|---|---|---|
| 1 | Overlay header needed route-group shell split | Implemented `(home)` / `(solid)` layouts |
| 2 | Hero lacked approved asset | Category C abstract WebP committed |
| 3 | Scaffold hero used amber/unsupported copy | Replaced with frozen copy |
| 4 | H1 was brand name not tagline | Tagline is sole H1 |
| 5 | CTA label was “Explore Portfolio” | Locked to “Explore Our Work” |
| 6 | No bronze scrim on hero | `rgba(139, 111, 71, 0.25)` scrim layer |
| 7 | No full-bleed hero | `ps-hero` full-bleed with `next/image` priority |
| 8 | Solid header on homepage | Overlay activated on `/` only |
| 9 | Mobile hero scale too heavy | Disabled scale ≤ 767px |
| 10 | Reduced motion must show content immediately | CSS + `useReducedMotion` static path |
| 11 | Brand proposition missing | `BrandProposition` section added |
| 12 | Proposition needed H2 not H1 | `EditorialSectionHeading as="h2"` |
| 13 | Featured portfolio order | Preserved below proposition |
| 14 | Empty C2 preview directory blocked guards | Removed `phase2f-c2-preview/` |
| 15 | Sitemap missing projects at production start | `force-dynamic` on `sitemap.ts` |
| 16 | Deep verify URI decode on `%` in CSS | Local handoff script try/catch (not committed) |

---

## Performance evidence (measured)

| Metric | Value |
|---|---|
| Hero asset bytes | 188,526 |
| Hero dimensions | 1920 × 1280 |
| Request URL | `/_next/image?url=%2Fmarketing%2Fhero%2Fhomepage-hero-architectural.webp&w=1920&q=75` |
| Selected responsive candidate | `w=1920` from the `next/image` srcset (640…3840) |
| Encoded / decoded body size | 188,526 / 188,526 bytes (optimiser passthrough — source already WebP at target width) |
| Preload behaviour | `priority` emits a `<link rel="preload" as="image">`; resource initiator recorded as `link` |
| LCP candidate | Hero `next/image` (`priority`, no lazy attribute) |
| CLS | No layout shift observed — `fill` + `object-cover` inside fixed hero min-heights |
| Client JS delta | 0 — no new client component, hook, or dependency |
| Long tasks | None observed during load or scroll |
| Remote hotlink / private path | None |
| New motion dependencies | None |

> Lighthouse and Core Web Vitals field scores were not collected; only directly observed
> browser network and timing values are recorded above.

---

## Contrast and scrim decision (hero replacement)

The previous review found supporting text too weak over pale stone. The flat bronze wash
(`--color-scrim`, 25 %) was replaced with a **restrained directional scrim** — no full-frame
dark wash, no blur, no glassmorphism, no amber drift:

- Desktop: neutral-charcoal left-to-right gradient (0.66 → 0.63 @ 40 % → 0.60 @ 53 % → 0.22 @ 66 % → 0.04 @ 76 % → 0), plus a top band (0.55 → 0 by 24 %) for the overlay header. The right 34 % of the artwork carries no scrim.
- Mobile: bottom-weighted gradient (0.66 held to 55 % → 0.22 → 0.04 → 0) plus the same header band; hero `min-height` raised to `min(80vh, 700px)` so clean artwork remains above the copy.
- Supporting copy moved off `--color-dark-section-muted` to a hero-scoped `--color-hero-supporting: #f0ece6`.

Worst-case measured contrast (source pixels composited with the exact CSS gradient stops):

| Element | Desktop 1440 | Mobile 390 | Required |
|---|---|---|---|
| Header wordmark | 15.4:1 | 8.9:1 | 4.5:1 |
| Header navigation / menu trigger | 8.1:1 | 5.0:1 | 4.5:1 / 3:1 |
| Brand overline | 11.9:1 | 5.5:1 | 4.5:1 |
| H1 | 7.2:1 | 5.4:1 | 3:1 |
| Supporting copy | 5.7:1 | 5.0:1 | 4.5:1 |
| CTA | 7.6:1 | 5.4:1 | 4.5:1 |

---

## Rendered visual closeout (hero replacement)

**Environment.** Docker Desktop running; `supabase start` + `db reset` + `scripts/seed-local-fixtures.sql`
piped through `psql`. Fixture verified: published 16, draft 1, archived 1, featured 1,
portfolio page 1 renders 12 cards. Single production build served on `http://localhost:3100`
with no rebuild during capture.

**Browser.** Cursor browser (Chromium webview) with CDP viewport emulation.

| Check | Result |
|---|---|
| Overlay header at top | `ps-header--overlay ps-header--on-dark`, `background: rgba(0,0,0,0)`, `data-scrolled="false"` |
| Header after 400 px scroll | `ps-header--solid ps-header--scrolled`, `background: #fdfcfa`, wordmark `#1a1816` |
| Overlay restored at top | Yes |
| Header transition | `background-color/border-color/color 300 ms cubic-bezier(0.4, 0, 0.2, 1)` |
| Hero motion (motion allowed) | `ps-hero-scale-in`, 800 ms, `cubic-bezier(0, 0, 0.2, 1)`, `forwards`, ends at `scale(1)` |
| Hero motion (reduced motion) | `data-hero-motion="static"`, `animation-name: none`, `transform: none` |
| Mobile navigation | Opens to `role="dialog" aria-modal="true"`, initial focus on close control, Escape/backdrop/link close paths present |
| Hero CTA | Activates to `/portfolio`; destination header renders solid; 12 seeded cards |
| Horizontal overflow | None — `scrollWidth === clientWidth` at 1440, 768, 390, 360 |
| Image errors / broken requests | None; hero served locally, no remote hotlink, no Storage path |
| Visible CLS | None observed |

**Rendered evidence (ignored path)** — `onedecore-chatgpt/phase-2f-c3/hero-replacement/`:
`final-visual-proof/` (1440, 1280, 1024, 768, 390, 360, 844×390 landscape, mobile nav open),
`candidates/` (candidate zoom and crop review), `composites/` (exact object-fit + scrim math),
`visual-closeout-ledger.md`.

**Known environment limitation.** The embedded Cursor browser rasterises the page into a
~593 px surface, so wide-viewport captures are produced by scaled CDP clips and lose
per-pixel sharpness. Asset detail was therefore verified separately at native resolution
(raw asset in-browser at 100 %, plus 200 % source crops), and the desktop scrim was validated
by replicating the exact `object-fit: cover` and CSS gradient maths against the shipped binary.

### Direction A mismatch ledger

Full 32-entry ledger: `onedecore-chatgpt/phase-2f-c3/hero-replacement/visual-closeout-ledger.md`.
Summary — 0 material mismatches remaining; 4 previously material items corrected in this pass:

| Previously material | Correction |
|---|---|
| Hero artwork read as flat gradient bands | Replaced with generated layered travertine/limestone composition |
| Supporting-text contrast below AA over pale stone | Directional scrim + hero-scoped `#f0ece6` supporting tone (5.7:1 desktop, 5.0:1 mobile) |
| Header navigation contrast over bright hero region | Added 0.55 top scrim band (8.1:1 desktop) |
| Mobile crop lost the focal composition | Mobile focal point `66% 50%` + `min(80vh, 700px)` min-height |

---

## Scope exclusions (confirmed)

- No package/migration/admin changes
- No consultation route or broken CTA
- No C4/C5 sections
- No preview routes committed
- No secrets or private asset paths in repository
