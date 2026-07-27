# Phase 2F-C4 — Service Stories & Editorial Featured Portfolio

**Status:** Complete  
**Date:** 27 July 2026  
**Branch:** `phase-2f-public-website-experience`

---

## Service-link sequencing decision

Frozen component architecture references service CTAs to `/services/*`, while the route table assigns those routes to Phase 2F-D.

**C4 contract:**

- `ServiceEditorialRow` accepts optional `ctaHref` / `ctaLabel`.
- Unit tests prove a supplied valid internal href renders a `SecondaryLink`.
- Production `ServicesSection` does **not** pass `ctaHref`.
- Typed `futureHref` values remain on `SERVICE_STORIES` for Phase 2F-D activation.
- No route stubs, no `href="#"`, no substitute `/portfolio` service CTAs.

---

## Service content

| Field | Value |
|---|---|
| Overline | Our Services |
| Heading | Interiors, considered as one complete vision |
| Intro | Three focused services… |
| Services | Complete Home Interiors · Modular Kitchens · Custom Wardrobes |
| Alternation | left / right / left |
| Ordinals | 01 / 02 / 03 |
| Production CTA | Omitted |

---

## Service asset provenance

All three assets are **Category C** — ONEDECORE-owned generated architectural marketing artwork. Not completed project photography. Public GitHub redistribution permitted. No attribution.

| Service | Path | Dims | Bytes | Quality | Focal |
|---|---|---|---|---|---|
| Complete Home Interiors | `/marketing/services/complete-home-interiors.webp` | 1600×1200 | 99,864 | WebP q78 | 48% 46% |
| Modular Kitchens | `/marketing/services/modular-kitchens.webp` | 1600×1200 | 113,924 | WebP q82 | 52% 48% |
| Custom Wardrobes | `/marketing/services/custom-wardrobes.webp` | 1600×1200 | 115,290 | WebP q70 | 50% 45% |

Generation: Cursor GenerateImage (2 candidates each; A selected). Optimised with existing `sharp` (4:3 center crop → 1600×1200 → WebP). Metadata stripped. sRGB. No alpha.

Evidence (ignored): `onedecore-chatgpt/phase-2f-c4/service-assets/`

---

## Architecture

| Component | Boundary |
|---|---|
| `ServicesSection` | Server |
| `ServiceEditorialRow` | Server + Reveal |
| `FeaturedPortfolioSection` | Server async — single `getFeaturedProjects()` |
| `PortfolioCard` | `variant: "listing" \| "featuredEditorial"` — default listing |

Homepage order: Hero → BrandProposition → ServicesSection → FeaturedPortfolioSection.

### Featured Portfolio data contract (unchanged)

- `getFeaturedProjects()` / `MAX_HOMEPAGE_FEATURED = 6`
- `PublicPortfolioCard` DTO
- Cache tags / repository / queries / RLS / migrations

### Featured editorial presentation

- Approved copy: Selected Work / intention heading / Explore Our Work → `/portfolio`
- Layouts: empty, one, two (60/40), three (primary + two), many (CSS grid)
- No Featured badge, no amber, no rounded-xl marketplace chrome
- Hover scale ≤1.03 desktop; reduced-motion static
- Eager image threshold preserved (`idx < 3`)

---

## Tests

Application/public: **183/183** (was 166). New `public-site-c4.test.ts` + composition updates.

---

## Fixture / visual QA

- Published 16, featured 1; homepage renders Selected Work with Published Featured Villa.
- Cursor browser: services alternation, no `/services` links, featured editorial variant, detail 200 with solid header.
- Local Storage note: SQL seed records paths only; a local cover WebP was uploaded to Storage for featured visual proof (not committed).
- Evidence (ignored): `onedecore-chatgpt/phase-2f-c4/`

---

## Quality gate

DB 107/107 · Image 17/17 · App 183/183 · HTTP 13/13 · Deep 82/82 · build/check clean · migrations 8 · npm audit High 3 Critical 0 unchanged · no package/admin/DTO/cache/repository change.
