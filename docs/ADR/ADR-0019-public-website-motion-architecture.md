# ADR-0019: Public Website Motion Architecture

## Status
Accepted — Frozen in Phase 2F-B (July 27, 2026)

## Context
Owner selected **balanced** motion intensity for Direction A with explicit rejection of Lenis, WebGL, Three.js, and scroll hijacking. Phase 2F-A3 GSAP feasibility review concluded Direction A signature motions are achievable without GSAP. Portfolio and homepage must remain usable under `prefers-reduced-motion`.

## Decision Drivers
- Performance budget (zero motion library preferred)
- Accessibility (immediate content visibility under reduced motion)
- Mobile simplification (no pin, no heavy parallax)
- Owner motion stack policy: CSS + Intersection Observer + WAAPI first

## Decision

### 1. Default Motion Stack (V1)
| Layer | Technology |
|---|---|
| Micro-interactions | CSS `transition` |
| Entrances | CSS `@keyframes` |
| Scroll-triggered reveal | `IntersectionObserver` + CSS classes |
| Imperative sequences (if needed) | Web Animations API (WAAPI) |
| Route transitions | View Transitions API — progressive enhancement only |
| **Not installed** | GSAP, Motion, Lenis, Framer Motion |

### 2. Signature Motions (Direction A)

| Motion | Trigger | Implementation | Duration | Reduced motion |
|---|---|---|---|---|
| Hero reveal | Page load | CSS keyframes or WAAPI | 800ms | Static, no scale |
| Hero image scale | Page load | CSS transform | 800ms | Disabled |
| Header solid | `scrollY > 80` | Client listener + CSS transition | 300ms | Instant |
| Service reveal | IO 20% | IO + CSS transition | 600ms stagger 120ms | Visible immediately |
| Portfolio hover | hover/tap | CSS transform scale 1.03 | 400ms | No scale |
| Consultation reveal | IO 30% | CSS transition | 500ms | Visible immediately |

### 3. Client Component Boundaries
Motion logic lives only in:
- `PublicHeader` (scroll state)
- `MobileNavigation` (drawer)
- `Reveal` / `HeroReveal` (IO + animation)
- Optional `useReducedMotion` hook

All other sections remain Server Components.

### 4. Mobile Simplification
- No pinned storytelling
- No parallax
- Reduced or eliminated stagger
- Hero: opacity-only or static

### 5. GSAP Exception Gate (future)
GSAP may be proposed only when ALL conditions are met:
1. A locked interaction cannot be implemented cleanly with CSS/IO/WAAPI
2. Interaction demonstrated in isolation
3. Bundle impact measured (lazy-loaded ScrollTrigger ~18–25KB gzip)
4. Mobile and reduced-motion fallbacks defined
5. Owner explicitly authorises via ADR amendment

Direction B pinned-process patterns are **not** in scope for Direction A V1.

### 6. Cleanup Contract
- `IntersectionObserver.disconnect()` on unmount
- WAAPI: `animation.cancel()` on unmount
- No global scroll listeners without passive flag and cleanup

### 7. Testing
- Component tests with `matchMedia` mock for `prefers-reduced-motion`
- Manual keyboard navigation during animations
- Performance: no long tasks > 50ms during scroll

## Consequences

### Positive
- Zero motion library bundle cost
- Predictable accessibility behaviour
- Aligns with RSC-first architecture

### Negative
- Complex scroll-linked narratives deferred (acceptable for Direction A)
- View Transitions API browser support varies — must degrade gracefully

## References
- [Implementation Plan](../design/phase-2f-implementation-plan.md)
- [Responsive & Accessibility](../design/phase-2f-responsive-accessibility.md)
- Phase 2F-A3 motion feasibility review (local)
