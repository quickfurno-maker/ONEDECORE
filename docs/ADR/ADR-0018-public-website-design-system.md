# ADR-0018: Public Website Design System (Direction A)

## Status
Accepted — Frozen in Phase 2F-B (July 27, 2026)

## Context
Phase 2F-A research, interim visuals, Figma specification (frames A01–A21), and owner decision (`24-owner-decision-recorded.md`) locked **Direction A — Quiet Architectural Editorial** as the production baseline. Phase 2E3 delivered public Portfolio routes with interim placeholder homepage styling (neutral/amber Tailwind defaults) that must be replaced without altering portfolio data contracts.

## Decision Drivers
- Owner-approved warm architectural palette — no yellow/amber template colours
- Editorial serif + clean sans typography
- Highest accessibility and performance safety among evaluated directions
- Preservation of existing Portfolio CMS DTOs, cache, and RLS architecture

## Decision

### 1. Design Direction
Adopt **Direction A** exclusively for the public marketing site shell and homepage.

### 2. Typography
- **Display:** Cormorant Garamond via `next/font/google` (weights 400, 500, 600)
- **Body/UI:** Inter via `next/font/google` (weights 400, 500, 600)
- `display: swap`; preload display weight for LCP headings
- Supersedes DEC-0011 recommendation (*Playfair Display* + *Plus Jakarta Sans*)

### 3. Colour System
CSS custom properties defined in `docs/design/phase-2f-design-tokens.md`:
- Canvas `#F7F5F2`, charcoal `#1A1816`, bronze accent `#8B6F47`
- Selective dark sections `#1A1816` for portfolio/material storytelling only
- No glassmorphism; no decorative gradients

### 4. Layout Principles
- Alternating editorial service rows — not three identical cards
- Editorial image-led portfolio on homepage — restyle wrapper only
- Full-bleed hero with restrained bronze scrim
- Header transparent over hero → solid `#FDFCFA` after 80px scroll

### 5. CTAs (locked copy)
- Primary: **Book a Design Consultation**
- Secondary: **Explore Our Work**

### 6. Implementation Location
New feature module `src/features/public-site/` with shared primitives; portfolio remains in `src/features/portfolio/public/`.

### 7. Explicit Rejections
- shadcn/ui for marketing site without future ADR
- Marketplace-style portfolio cards
- Amber Tailwind accent classes on public site

## Consequences

### Positive
- Single coherent visual language aligned with owner decision
- Token-driven theming enables consistent 2F-C implementation slices
- Portfolio contracts remain stable

### Negative
- Requires restyling existing `FeaturedPortfolioSection` and homepage
- Font loading adds ~60–80KB woff2 (budgeted)

## References
- [Phase 2F Production Spec](../design/phase-2f-direction-a-production-spec.md)
- [Design Tokens](../design/phase-2f-design-tokens.md)
- [Figma Direction A](https://www.figma.com/design/zjiDYchKCAzsVrFYnrrrGG)
- [ADR-0016: Public Portfolio Data Delivery](ADR-0016-public-portfolio-data-delivery.md)
