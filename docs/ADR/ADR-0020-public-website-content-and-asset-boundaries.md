# ADR-0020: Public Website Content & Asset Boundaries

## Status
Accepted — Frozen in Phase 2F-B (July 27, 2026)

## Context
The public marketing site requires content and imagery before full launch. Owner decision explicitly marks contact details, real project imagery, founder/team imagery, and testimonials as unavailable or blocked. Phase 2E3 portfolio CMS delivers real project data for featured/listing/detail routes — marketing imagery is separate.

## Decision Drivers
- Brand truthfulness (no invented claims, stats, awards, addresses)
- Legal accuracy (no `ONEDECORE Interiors` as legal name)
- Separation of CMS portfolio assets from marketing photography
- Testimonial policy until authentic approved content exists

## Decision

### 1. Content Classification
All public copy and assets MUST be classified per `docs/design/phase-2f-content-and-asset-contracts.md`:
- APPROVED BRAND FACT
- NEUTRAL PRODUCTION COPY REQUIRED
- OWNER CONTENT REQUIRED
- CMS DATA
- LEGAL REVIEW REQUIRED

### 2. Rendering Rules
| Class | Public render rule |
|---|---|
| APPROVED BRAND FACT | Render |
| NEUTRAL PRODUCTION COPY REQUIRED | Render professional neutral copy — no false claims |
| OWNER CONTENT REQUIRED | **Omit** or neutral non-specific placeholder — never invent |
| CMS DATA | Render via existing public DTOs only |
| LEGAL REVIEW REQUIRED | Block publish until reviewed |

### 3. Testimonials
**Do not display** testimonials, star ratings, or client counts until authentic owner-approved content exists. Trust section uses pillars only — no social proof fabrication.

### 4. Marketing vs Portfolio Imagery
| Source | Use |
|---|---|
| CMS WebP derivatives | Portfolio featured, listing, detail only |
| Licensed/owner marketing photos | Hero, services, materials, about |
| Phase 2F-A concept PNGs | **Prohibited** as completed ONEDECORE projects |

### 5. Contact & Structured Data
- Public footer/contact blocks require OWNER CONTENT REQUIRED fields
- **No `LocalBusiness` JSON-LD** until approved legal/contact details exist
- Preserve existing Portfolio `CreativeWork` / metadata patterns

### 6. Asset Optimisation
- Hero ≤ 200KB AVIF/WebP
- Section images ≤ 120KB
- Portfolio: existing Sharp WebP pipeline unchanged
- No unoptimised PNG/JPEG to visitors

### 7. Placeholder Strategy
Missing owner content → omit section or use honest "coming soon" without fake specifics. Missing hero image → typography on stone canvas — no misleading stock interiors presented as ONEDECORE work.

## Consequences

### Positive
- Prevents reputational and legal risk from fabricated content
- Clear gate for owner to supply assets incrementally

### Negative
- Homepage may ship with abbreviated trust/contact sections until owner delivers content

## References
- [Content & Asset Contracts](../design/phase-2f-content-and-asset-contracts.md)
- [Project Truth](../00-project-truth.md)
- [Portfolio Architecture](../04-portfolio-architecture.md)
