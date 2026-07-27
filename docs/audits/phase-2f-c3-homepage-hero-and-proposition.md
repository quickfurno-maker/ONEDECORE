# Phase 2F-C3 — Homepage Hero & Brand Proposition Audit

**Date:** July 27, 2026

**Gate:** Phase 2F-C3 Homepage Hero & Brand Proposition

**Status:** `PHASE_2F_C3_HOMEPAGE_HERO_PROPOSITION_COMPLETE`

**Branch:** `phase-2f-public-website-experience`

**Base HEAD:** `65ac2176759b36ced2eb065057de6d916b92261d`

---

## Hero asset provenance

| Field | Value |
|---|---|
| Path | `public/marketing/hero/homepage-hero-architectural.webp` |
| Category | **C** — owner-approved abstract architectural surface (not presented as completed work) |
| Source | Procedurally authored warm stone/bronze marketing surface (ONEDECORE-owned) |
| Owner/provider | ONEDECORE / quickfurno-maker |
| Public GitHub redistribution | **Yes** (ONEDECORE-owned binary) |
| Website use | Yes |
| Real ONEDECORE project photo | **No** |
| Stock / generated finished interior | **No** |
| Dimensions | 1920 × 1280 |
| Measured bytes | 9,240 (≤ 200 KB target) |
| Format | WebP |
| Focal point | `50% 42%` |
| Alt | Abstract warm stone architectural surface with bronze accents |

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
| Hero asset bytes | 9,240 |
| Hero dimensions | 1920 × 1280 |
| LCP candidate | Hero `next/image` with `priority` |
| CLS | Stable `fill` + `object-cover` + fixed min-heights |
| New motion dependencies | None |

---

## Scope exclusions (confirmed)

- No package/migration/admin changes
- No consultation route or broken CTA
- No C4/C5 sections
- No preview routes committed
- No secrets or private asset paths in repository
