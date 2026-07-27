# Phase 2F-C5B — Process, Material Story & Trust

**Status:** Complete  
**Date:** 27 July 2026  
**Branch:** `phase-2f-public-website-experience`  
**C5A gate:** Owner content approved (`PHASE_2F_C5A_OWNER_CONTENT_APPROVED_READY_FOR_C5B` — local ignored decision records only; not committed)

---

## Service scope (owner-verified)

ONEDECORE provides interior design, interior execution, installation, final detailing, and project handover. Not design-only. Public copy remains factual without guaranteed dates, pricing, warranties, awards, or unverified statistics.

---

## ProcessSection

| Field | Value |
|---|---|
| Overline | Our Process |
| Heading | A considered path from first conversation to final handover |
| Intro | Four clear stages bring the wider interior vision and its details into one coordinated journey. |
| Steps | 01 Discover · 02 Define · 03 Detail · 04 Deliver |
| CTA | **Omitted** — deferred until Phase 2F-E `/process` |
| Boundary | Calm design journey; not contractual milestones |

Exact step descriptions match the C5A owner approval sheet.

Architecture: Server Components (`ProcessSection`, `ProcessStepItem`), typed `content/process.ts`, `<ol>` progression with fine top rules, no cards, no pin, no scroll hijack, no client island beyond existing `Reveal`.

---

## MaterialStorySection

| Field | Value |
|---|---|
| Overline | Material Story |
| Heading | Materials considered as part of the wider composition |
| Surface | Selective dark (`--color-dark-section`) |
| Layout | Primary (travertine) + two supporting moments — not equal marketplace cards |

### Captions (owner-approved)

1. Stone, light, and shadow brought together with restraint.  
2. Joinery considered through proportion, alignment, and material detail.  
3. Layers of texture held within a calm and coherent palette.

### Asset provenance

All three assets are **Category C** — ONEDECORE-owned generated architectural marketing artwork. Not completed project photography. Public GitHub redistribution permitted. No attribution.

| Theme | Path | Dims | Bytes | Quality | Focal |
|---|---|---|---|---|---|
| Travertine + bronze | `/marketing/materials/travertine-bronze-detail.webp` | 1800×1200 | 117,146 | WebP q64 | 48% 46% |
| Timber joinery | `/marketing/materials/timber-joinery-detail.webp` | 1800×1200 | 71,478 | WebP q76 | 38% 58% |
| Textured panel | `/marketing/materials/textured-panel-charcoal-detail.webp` | 1200×800 | 117,564 | WebP q44 | 45% 50% |

Generation: Cursor GenerateImage (2 candidates per theme). Selected: mat01-A, mat02-A, mat03-B. Optimised with existing `sharp` (3:2 crop → WebP, sRGB, metadata stripped). Evidence (ignored): `onedecore-chatgpt/phase-2f-c5b/material-assets/`.

No material-performance claims (origin, imported/Italian/German, durability, warranty, brand specs).

---

## TrustSection

| Field | Value |
|---|---|
| Overline | Why ONEDECORE |
| Heading | One vision carried through every detail |
| Pillars | One coherent design direction · Clarity in every decision · Details considered as part of the whole |

Philosophy statements only — no statistics, testimonials, awards, ratings, or CTA.

---

## Deferrals (intentional)

| Item | Deferred to |
|---|---|
| Process CTA → `/process` | Phase 2F-E |
| ConsultationBand → Book a Design Consultation → `/contact` | Phase 2F-E |
| `/process`, `/contact` routes | Phase 2F-E |

---

## Homepage order after C5B

1. HeroSection  
2. BrandProposition  
3. ServicesSection  
4. FeaturedPortfolioSection  
5. ProcessSection  
6. MaterialStorySection  
7. TrustSection  
8. PublicFooter (shell)

ConsultationBand remains absent.

---

## Motion / a11y / responsive

- Existing `Reveal` only; reduced motion static; no GSAP/Motion/Lenis/pin/parallax/carousel  
- Process: 4-column desktop → stacked mobile DOM order  
- Material: asymmetric primary/supporting → stacked mobile  
- Trust: 3-column from tablet → stacked mobile  
- Dark-section heading/body contrast overrides for MaterialStory  
- Semantic `aria-labelledby`, H2 section / H3 step & pillar titles; single homepage H1 unchanged  

---

## Tests

Application/public: **202/202** (was 183). New `public-site-c5b.test.ts` + composition updates in C3/C4 + architecture preview guard.

---

## Fixture / visual QA

- Published 16, featured 1, ready media 18; homepage Featured Portfolio remains between Services and Process.  
- Cursor browser production screenshots under ignored `onedecore-chatgpt/phase-2f-c5b/final-visual-proof/`.  
- Native 100%/200% material crops reviewed under ignored material-assets/native-qa.

---

## Quality gate

DB 107/107 · Image 17/17 · App 202/202 · HTTP 13/13 · Deep 82/82 · build/check clean · migrations 8 · npm audit High 3 Critical 0 unchanged · no package/admin/DTO/cache/repository/migration change.

---

## Next

Ready for **Phase 2F-C6** homepage visual QA and correction. ConsultationBand intentionally deferred to Phase 2F-E.
