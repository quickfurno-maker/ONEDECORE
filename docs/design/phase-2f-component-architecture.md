# Phase 2F — Component Architecture

**Document Status:** Frozen  
**Location (future):** `src/features/public-site/`  
**Principle:** Server Components by default; small client islands for interaction and motion.

---

## 1. Directory Structure (Phase 2F-C+)

```text
src/features/public-site/
├── components/
│   ├── shell/
│   ├── header/
│   ├── hero/
│   ├── sections/
│   ├── ui/
│   └── motion/
├── content/           # Static copy contracts (typed)
├── hooks/             # useScrollHeader, useReveal, useReducedMotion
└── __tests__/
```

Portfolio integration remains in `src/features/portfolio/public/` — **wrapper restyle only** in 2F-C4.

---

## 2. Component Registry

### PublicSiteShell

| Field | Value |
|---|---|
| Responsibility | `<html>` body wrapper: skip link slot, header, `<main>`, footer |
| Boundary | **Server** |
| Props | `children`, optional `headerVariant` |
| Data | None |
| Motion | None |
| A11y | `id="main-content"` landmark |
| Tests | Renders landmarks; skip link present |
| Reuse | All public marketing routes |

### PublicHeader

| Field | Value |
|---|---|
| Responsibility | Logo, desktop nav, mobile trigger, consultation CTA |
| Boundary | **Client** (scroll state) |
| Props | `navItems`, `ctaHref`, `ctaLabel` |
| Data | Static nav config |
| Motion | Transparent → solid at 80px scroll |
| A11y | `<header>`, `<nav aria-label="Primary">`, keyboard nav |
| Tests | Scroll class toggle; reduced motion instant |
| Reuse | Shell |

### DesktopNavigation

| Field | Value |
|---|---|
| Responsibility | Horizontal link list |
| Boundary | **Server** (links only) or part of PublicHeader client tree |
| Props | `items: { label, href }[]` |
| Motion | None |
| A11y | Current page `aria-current="page"` |
| Tests | Renders links; active state |

### MobileNavigation

| Field | Value |
|---|---|
| Responsibility | Drawer overlay + link list + CTA |
| Boundary | **Client** |
| Props | `open`, `onClose`, `items`, `cta` |
| Motion | Slide/fade panel 300ms; disabled if reduced motion |
| A11y | Focus trap, Escape, `aria-modal`, restore focus |
| Tests | Open/close keyboard; body scroll lock |
| Reuse | PublicHeader |

### SkipLink

| Field | Value |
|---|---|
| Responsibility | "Skip to main content" |
| Boundary | **Server** |
| Props | `href="#main-content"` |
| A11y | First focusable; visible on focus |
| Tests | Focus visibility |

### HeroSection

| Field | Value |
|---|---|
| Responsibility | Full-bleed image, scrim, H1, optional line, primary CTA, secondary link |
| Boundary | **Server** composition; **Client** `HeroReveal` child for motion |
| Props | `title`, `tagline?`, `subtitle?`, `image`, `primaryCta`, `secondaryCta` |
| Data | Static + marketing image |
| Motion | Image scale + text reveal (client island) |
| A11y | Single H1; CTA as `<a>` or `<button>` |
| Tests | Renders CTAs; reduced motion static |
| Reuse | Homepage; adaptable for service heroes later |

### EditorialSectionHeading

| Field | Value |
|---|---|
| Responsibility | Overline + serif heading + optional description |
| Boundary | **Server** |
| Props | `overline?`, `title`, `description?`, `align?` |
| Tests | Heading level prop `h2` default |

### BrandProposition

| Field | Value |
|---|---|
| Responsibility | Asymmetric text + image editorial block |
| Boundary | **Server** + optional `Reveal` wrapper |
| Props | `heading`, `body`, `image` |
| Data | NEUTRAL PRODUCTION COPY REQUIRED |
| Layout | Text + image split; stack mobile |

### ServiceEditorialRow

| Field | Value |
|---|---|
| Responsibility | One service: image, title, excerpt, text link CTA |
| Boundary | **Server** + `Reveal` |
| Props | `serviceSlug`, `title`, `description`, `image`, `imagePosition: 'left' \| 'right'` |
| Data | Static service config |
| Layout | Alternating image/text — **not a card grid** |
| Tests | Alternating layout prop; link href |

### FeaturedPortfolioSection

| Field | Value |
|---|---|
| Responsibility | **Existing** — CMS featured projects |
| Boundary | **Server** (async data fetch) |
| Contract | **Frozen** — `getFeaturedProjects()`, `PublicPortfolioCard` |
| Change in 2F-C | Wrapper classes, heading typography, grid layout to editorial |
| Tests | Existing `public-portfolio.test.ts` must pass |

### FeaturedPortfolioProject

| Field | Value |
|---|---|
| Responsibility | Single editorial portfolio moment (may wrap `PortfolioCard` internally) |
| Boundary | **Server** |
| Props | `card: PublicPortfolioCard` |
| Motion | Optional client hover wrapper |
| Layout | Large image, restrained metadata |

### ProcessSection

| Field | Value |
|---|---|
| Responsibility | 3–4 step calm progression |
| Boundary | **Server** + optional IO highlight client |
| Props | `steps: { number, title, description }[]` |
| Motion | IO active step — no pin |
| CTA | Link to `/process` |

### ProcessStep

| Field | Value |
|---|---|
| Responsibility | Single step display |
| Boundary | **Server** |

### MaterialStorySection

| Field | Value |
|---|---|
| Responsibility | Selective dark band; macro detail images |
| Boundary | **Server** |
| Props | `items: { image, caption }[]` |
| Dark section | `bg --color-dark-section` |

### TrustSection

| Field | Value |
|---|---|
| Responsibility | Why ONEDECORE pillars (max 3) |
| Boundary | **Server** |
| Data | OWNER CONTENT REQUIRED — no fake stats |
| **No testimonials** | Withheld until authentic content |

### ConsultationBand

| Field | Value |
|---|---|
| Responsibility | Conversion band with headline + primary CTA |
| Boundary | **Server** |
| CTA | Book a Design Consultation → `/contact` |
| Motion | IO fade optional |

### PublicFooter

| Field | Value |
|---|---|
| Responsibility | Sitemap links, legal, contact placeholders |
| Boundary | **Server** |
| Data | OWNER CONTENT REQUIRED for address/phone/email |
| A11y | `<footer>`, nav landmarks |

### PrimaryButton

| Field | Value |
|---|---|
| Responsibility | Bronze filled CTA |
| Boundary | **Server** (link-styled) or shared |
| Props | `href`, `children`, `variant?: 'on-dark'` |
| Size | Min height 44px; padding 12px 24px |
| States | default, hover, focus, active, disabled |

### SecondaryLink

| Field | Value |
|---|---|
| Responsibility | Text link with arrow — Explore Our Work |
| Boundary | **Server** |
| Style | Underline on hover; bronze or charcoal |

### ImageFrame

| Field | Value |
|---|---|
| Responsibility | Responsive `next/image` wrapper with ratio + alt |
| Boundary | **Server** |
| Props | `src`, `alt`, `ratio`, `priority?`, `sizes` |

### Reveal

| Field | Value |
|---|---|
| Responsibility | IO-triggered entrance wrapper |
| Boundary | **Client** |
| Props | `children`, `delay?`, `as?` |
| Motion | opacity + translateY; static if reduced motion |
| Cleanup | `disconnect` observer on unmount |

### Container

| Field | Value |
|---|---|
| Responsibility | Max-width + horizontal padding |
| Boundary | **Server** |
| Props | `width?: 'content' \| 'wide' \| 'full'` |

### Section

| Field | Value |
|---|---|
| Responsibility | Semantic `<section>` with spacing token |
| Boundary | **Server** |
| Props | `id?`, `aria-labelledby?`, `variant?: 'default' \| 'dark' \| 'stone'` |

### VisuallyHidden

| Field | Value |
|---|---|
| Responsibility | Screen-reader-only text |
| Boundary | **Server** |

---

## 3. Anti-Patterns (Forbidden)

- Monolithic `HomePage.tsx` with all markup inline
- shadcn/ui for marketing site without concrete requirement
- Three identical `ServiceCard` components in a grid
- Importing admin/CRM modules into public components
- Client-fetching portfolio data
- New portfolio DTO fields without ADR

---

## 4. Portfolio Integration Boundary

| Layer | Action in 2F-C |
|---|---|
| `public-portfolio-repository.ts` | **No change** |
| `public-portfolio-cache.ts` | **No change** |
| `types.ts` (public DTOs) | **No change** |
| `FeaturedPortfolioSection.tsx` | Restyle classes + grid layout only |
| `PortfolioCard.tsx` | Editorial styling; remove marketplace card chrome |

---

## 5. Test Matrix (per component)

| Component | Unit | A11y | Visual |
|---|---|---|---|
| PublicHeader | scroll state mock | focus order | Figma A05, A14 |
| MobileNavigation | open/close | trap, Escape | A14 |
| HeroSection | CTA hrefs | h1, contrast | A05 |
| ServiceEditorialRow | alternating | link names | A07, A15 |
| FeaturedPortfolioSection | existing tests | article semantics | A08, A16 |
| Reveal | reduced motion | no blocking | motion storyboard |
| ConsultationBand | CTA | contrast on band | A12, A17 |

---

## 6. Related Documents

- [Production Spec](phase-2f-direction-a-production-spec.md)
- [Implementation Plan](phase-2f-implementation-plan.md)
- [ADR-0018](../ADR/ADR-0018-public-website-design-system.md)
