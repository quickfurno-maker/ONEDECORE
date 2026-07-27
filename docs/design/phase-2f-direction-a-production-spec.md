# Phase 2F — Direction A Production Specification

**Document Status:** Frozen (Phase 2F-B Architecture Gate)  
**Owner Direction:** A — Quiet Architectural Editorial  
**Figma Source:** [ONEDECORE — Phase 2F Public Website Concepts](https://www.figma.com/design/zjiDYchKCAzsVrFYnrrrGG) — frames `A01`–`A21` (section `03 Direction A Frames`, node `1:222`)  
**Owner Decision Record:** `onedecore-chatgpt/phase-2f-a/24-owner-decision-recorded.md` (local, not in Git)

---

## 1. Purpose

This document freezes the production visual and structural specification for the ONEDECORE public marketing site. It converts owner-approved Direction A and Figma frame inventory into implementation contracts without prescribing production code in this phase.

---

## 2. Figma Direction A Frame Inventory

| Frame | Node ID | Dimensions | Role |
|---|---|---|---|
| A01 Desktop Home 1440 | `1:12` | 1440 × 1024 | Full homepage overview — desktop |
| A02 Laptop Home 1280 | `1:22` | 1280 × 800 | Full homepage overview — laptop |
| A03 Tablet Home 768 | `1:32` | 768 × 1024 | Full homepage overview — tablet portrait |
| A04 Mobile Home 390 | `1:42` | 390 × 844 | Full homepage overview — mobile |
| A05 Header + Hero | `1:52` | 1440 × 900 | Header states + hero composition |
| A06 Proposition | `1:62` | 1440 × 720 | Brand proposition section |
| A07 Services | `1:72` | 1440 × 960 | Alternating editorial service rows |
| A08 Portfolio | `1:82` | 1440 × 820 | Featured CMS portfolio — editorial grid |
| A09 Process | `1:92` | 1440 × 720 | Calm scroll-led process |
| A10 Material | `1:102` | 1440 × 620 | Material/detail storytelling (selective dark) |
| A11 Why ONEDECORE | `1:112` | 1440 × 620 | Trust pillars |
| A12 Consultation | `1:122` | 1440 × 520 | Consultation conversion band |
| A13 Footer | `1:132` | 1440 × 420 | Global footer |
| A14 Mobile Nav | `1:142` | 390 × 844 | Mobile navigation open state |
| A15 Mobile Services | `1:152` | 390 × 920 | Service rows — mobile |
| A16 Mobile Portfolio | `1:162` | 390 × 920 | Portfolio — mobile |
| A17 Mobile CTA Footer | `1:172` | 390 × 920 | Consultation + footer — mobile |
| A18 Typography | `1:182` | 1440 × 900 | Type scale sheet |
| A19 Colour Board | `1:192` | 1440 × 800 | Colour/material tokens |
| A20 Components | `1:202` | 1440 × 1000 | Component families |
| A21 Motion Storyboard | `1:212` | 1440 × 900 | Motion specification reference |

**Figma inspection note:** Frames `A01`–`A21` are editable structural shells. Extracted production values from `A05 Header + Hero` (`get_design_context`) are authoritative where present; typography/colour boards (`A18`–`A19`) align with Direction A research tokens where Figma layer detail is skeletal.

---

## 3. Extracted Figma Values (A05 Header + Hero)

| Token / Element | Value | Notes |
|---|---|---|
| Canvas / page background | `#F7F5F2` | Warm stone ivory |
| Header height | `72px` | Fixed; compact on scroll optional in 2F-C |
| Header horizontal padding | `48px` desktop | Scales per responsive doc |
| Logo wordmark | Inter Bold `18px`, `#1A1816` | Production: sans for logotype acceptable; display serif for page H1 |
| Primary CTA (header) | `#8B6F47` fill, `40px` height, Inter Bold `12px` white | Label: **Book a Design Consultation** (owner); Figma shell shows shortened "Book Consultation" |
| Hero scrim overlay | `rgba(139, 111, 71, 0.25)` | Restrained bronze — not amber template |
| Display headline (shell) | `48px` bold `#1A1816` | Production: Cormorant Garamond per typography freeze |
| Muted / placeholder copy | `12px` `#5C574F` | OWNER CONTENT REQUIRED treatment |
| Concept image placeholder | `#8C7A66` | Marketing placeholder only — not CMS portfolio |

**IMPLEMENTATION DECISION REQUIRED (resolved):** Figma shell uses Inter for H1; owner locked **editorial serif headings**. Production H1 uses Cormorant Garamond at scaled sizes in `phase-2f-design-tokens.md`.

---

## 4. Homepage Section Order (Canonical)

1. Global header (`PublicHeader`)
2. Full-bleed hero (`HeroSection`)
3. Brand proposition (`BrandProposition`)
4. Three alternating editorial service rows (`ServiceEditorialRow` × 3)
5. Existing CMS featured Portfolio (`FeaturedPortfolioSection` — restyled wrapper only)
6. Calm process progression (`ProcessSection`)
7. Material/detail storytelling (`MaterialStorySection` — selective dark)
8. Why ONEDECORE (`TrustSection`)
9. Consultation band (`ConsultationBand`)
10. Global footer (`PublicFooter`)

**Rhythm:** full-bleed image → contained editorial text → split layout → editorial portfolio → calm process → selective dark material band → trust → conversion → footer. **No three identical service cards.**

---

## 5. Hero Architecture

| Field | Specification |
|---|---|
| Layout | Full-bleed architectural image; minimal copy; strong negative space |
| Copy | H1 (brand or editorial line), tagline optional, one value line — OWNER CONTENT REQUIRED beyond locked tagline |
| Primary CTA | **Book a Design Consultation** — single primary action |
| Secondary CTA | **Explore Our Work** → `/portfolio` |
| Desktop height | `min(85vh, 900px)` — aligns with A05 `900px` frame |
| Mobile height | `min(70vh, 640px)` — CTA visible without scroll |
| Image | Marketing hero asset — OWNER CONTENT REQUIRED; never CMS portfolio cover |
| Motion | Subtle image reveal + controlled scale `1.05 → 1.0`; text fade-up; see motion ADR |
| Reduced motion | Static image; all text immediately visible; no scale |

---

## 6. Header Architecture

| State | Specification |
|---|---|
| Transparent (hero) | No solid fill; logo/nav/CTA on hero with scrim contrast |
| Solid (scrolled) | `#F7F5F2` or `#FDFCFA` surface + `1px` border `#E8E4DE`; no glassmorphism |
| Scroll threshold | `80px` (`scrollY > 80`) |
| Transition | `300ms` ease background/border |
| Navigation | Minimal: Services, Portfolio, Process, About |
| CTA | One consultation CTA in header |
| Mobile | Hamburger → full-height drawer; focus trap; Escape closes |
| Dark sections | Header inverts to light text on dark when overlapping material/portfolio bands |

---

## 7. Portfolio (Homepage)

| Field | Specification |
|---|---|
| Data | Existing `FeaturedPortfolioSection` / `getFeaturedProjects()` — **no contract change** |
| Layout | Editorial image-led; large featured moments; asymmetric grid on desktop |
| Cards | **No marketplace-style cards**; minimal radius (`0` or `2px` max); no heavy shadows |
| Metadata | Restrained: title, location or service — no badge overload |
| Empty state | Neutral copy; link to `/portfolio`; no invented projects |
| Motion | Optional stagger reveal; hover scale `1.03` desktop only |
| Dark band | Portfolio section may use selective dark editorial background |

**Preserve:** `PublicPortfolioCard` DTO, cache tags, WebP derivative URLs, RLS publication rules (`ADR-0016`, `ADR-0017`).

---

## 8. Services

Three rows — **alternating image/text**, not identical cards:

| # | Service | Route |
|---|---|---|
| 1 | Complete Home Interiors | `/services/complete-home-interiors` |
| 2 | Modular Kitchens | `/services/modular-kitchens` |
| 3 | Custom Wardrobes | `/services/custom-wardrobes` |

Copy: NEUTRAL PRODUCTION COPY REQUIRED or OWNER CONTENT REQUIRED. Imagery: licensed marketing — not CMS portfolio unless owner approves specific project.

---

## 9. Process

| Field | Specification |
|---|---|
| Treatment | Calm scroll-led progression; numbered steps |
| Desktop | Vertical or light horizontal timeline — **no pin** |
| Mobile | Stacked steps; **no pinned storytelling** |
| Motion | IO highlight active step; no scroll hijacking |
| CTA | Link to `/process` |

---

## 10. Material / Detail Storytelling

| Field | Specification |
|---|---|
| Purpose | Craft credibility without unverified claims |
| Layout | Full-bleed or wide editorial strip; 2–3 macro detail images |
| Dark section | **Allowed** — selective dark background for this section |
| Imagery | Licensed or owner-provided; label concept assets clearly in CMS/marketing pipeline |
| Motion | Crossfade or simple reveal; no parallax on mobile |

---

## 11. Rejected for V1

- Lenis, WebGL, Three.js
- GSAP by default (CSS + IO + WAAPI first)
- Scroll hijacking / long mobile pin
- Marketplace portfolio cards
- Yellow/amber template palette
- Glassmorphism header
- Fake testimonials, stats, awards
- Invented contact details
- `ONEDECORE Interiors` as legal name

---

## 12. Related Documents

- [Design Tokens](phase-2f-design-tokens.md)
- [Component Architecture](phase-2f-component-architecture.md)
- [Content & Asset Contracts](phase-2f-content-and-asset-contracts.md)
- [Responsive & Accessibility](phase-2f-responsive-accessibility.md)
- [Implementation Plan](phase-2f-implementation-plan.md)
- [ADR-0018](../ADR/ADR-0018-public-website-design-system.md)
- [ADR-0019](../ADR/ADR-0019-public-website-motion-architecture.md)
- [ADR-0020](../ADR/ADR-0020-public-website-content-and-asset-boundaries.md)
