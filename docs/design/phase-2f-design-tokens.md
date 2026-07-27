# Phase 2F — Design Tokens (Direction A)

**Document Status:** Frozen  
**Stack:** Tailwind CSS v4 + CSS custom properties  
**Implementation path:** `src/styles/tokens.css` (or equivalent) in Phase 2F-C1 — **not created in this phase**

---

## 1. Colour Tokens

All values meet WCAG 2.2 AA for intended pairings. Bronze accent is restrained — not amber/yellow template.

| Token | CSS Variable | Hex | Usage |
|---|---|---|---|
| Canvas / ivory | `--color-canvas` | `#F7F5F2` | Page background (Figma A05) |
| Surface elevated | `--color-surface` | `#FDFCFA` | Solid header, cards on canvas |
| Stone surface | `--color-stone` | `#EDE9E3` | Alternate section bands |
| Charcoal text | `--color-text-primary` | `#1A1816` | Headings, body (Figma A05) |
| Muted text | `--color-text-muted` | `#5C574F` | Captions, metadata (Figma A05) |
| Bronze accent | `--color-accent` | `#8B6F47` | Primary CTA, links, focus accent |
| Bronze hover | `--color-accent-hover` | `#7A6240` | Button hover |
| Bronze pressed | `--color-accent-pressed` | `#6B5538` | Button active |
| Border / divider | `--color-border` | `#E8E4DE` | Rules, header border |
| Border strong | `--color-border-strong` | `#D4CEC4` | Form fields |
| Dark editorial | `--color-dark-section` | `#1A1816` | Selective portfolio/material bands |
| Dark section text | `--color-dark-section-text` | `#F7F5F2` | Text on dark bands |
| Dark section muted | `--color-dark-section-muted` | `#B8B2A8` | Secondary on dark |
| Image scrim | `--color-scrim` | `rgba(139, 111, 71, 0.25)` | Hero overlay (Figma A05) |
| Scrim strong | `--color-scrim-strong` | `rgba(26, 24, 22, 0.45)` | Text legibility on busy images |
| Focus ring | `--color-focus` | `#8B6F47` | 2px outline + offset |
| Selection | `--color-selection` | `rgba(139, 111, 71, 0.2)` | `::selection` background |
| Error | `--color-error` | `#B42318` | Form validation |
| Success | `--color-success` | `#2D6A4F` | Form success |
| Transparent header | `--color-header-transparent` | `transparent` | Over hero |
| Solid header | `--color-header-solid` | `#FDFCFA` | Post-scroll |

**Prohibited:** `#F59E0B`, `#D97706`, amber Tailwind defaults, decorative gradients, glassmorphism.

### Contrast verification (primary pairings)

| Foreground | Background | Ratio | Pass |
|---|---|---|---|
| `#1A1816` | `#F7F5F2` | ~14.5:1 | AA / AAA body |
| `#5C574F` | `#F7F5F2` | ~5.8:1 | AA body |
| `#F7F5F2` | `#1A1816` | ~14.5:1 | AA on dark sections |
| `#FFFFFF` | `#8B6F47` | ~4.6:1 | AA button label |
| `#8B6F47` | `#F7F5F2` | ~4.5:1 | AA large UI accent |

---

## 2. Typography

### Font pairing (frozen)

| Role | Family | License | Loading |
|---|---|---|---|
| Display / headings | **Cormorant Garamond** | SIL OFL (Google Fonts) | `next/font/google` |
| Body / UI / nav | **Inter** | SIL OFL (Google Fonts) | `next/font/google` |

**Justification:** Matches Direction A research and owner decision; both open-source; no runtime third-party font CDN request when using `next/font`; excellent mobile legibility for Inter; editorial authority for Cormorant.

### Fallback stacks

```text
--font-display: var(--font-cormorant), "Cormorant Garamond", "Times New Roman", serif;
--font-body: var(--font-inter), Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
```

### Weights (minimal)

| Font | Weights |
|---|---|
| Cormorant Garamond | 400, 500, 600 |
| Inter | 400, 500, 600 |

### Loading policy

| Setting | Value |
|---|---|
| Strategy | `next/font/google` in `src/app/layout.tsx` |
| `display` | `swap` |
| `subsets` | `['latin']` |
| Preload | Cormorant 600 for hero H1; Inter 400/500 for body |
| Self-hosted | Not required V1; `next/font` self-hosts at build |
| No install | Fonts are not npm packages; loaded at build via Next |

### Type scale

| Token | Font | Size (desktop) | Size (mobile) | Weight | Line height | Letter spacing | Max width |
|---|---|---|---|---|---|---|---|
| `display-xl` | Cormorant | 64px | 40px | 600 | 1.05 | -0.02em | — |
| `display-lg` | Cormorant | 48px | 36px | 600 | 1.1 | -0.02em | — |
| `heading-1` | Cormorant | 40px | 32px | 600 | 1.15 | -0.01em | 12ch hero |
| `heading-2` | Cormorant | 32px | 28px | 600 | 1.2 | 0 | 20ch |
| `heading-3` | Cormorant | 24px | 22px | 500 | 1.25 | 0 | — |
| `body-lg` | Inter | 18px | 17px | 400 | 1.6 | 0 | 65ch |
| `body` | Inter | 16px | 16px | 400 | 1.65 | 0 | 65ch |
| `body-sm` | Inter | 14px | 14px | 400 | 1.5 | 0 | — |
| `nav` | Inter | 14px | 14px | 500 | 1.4 | 0.02em | — |
| `button` | Inter | 14px | 14px | 600 | 1 | 0.04em | — |
| `caption` | Inter | 12px | 12px | 400 | 1.4 | 0.02em | — |
| `overline` | Inter | 11px | 11px | 600 | 1.3 | 0.12em | — |

### Widow / orphan guidance

- Hero H1: max 2 lines mobile, 3 desktop; `text-wrap: balance` on headings ≥ `heading-2`
- Proposition paragraphs: `max-width: 65ch`
- Avoid single-word last lines in CTAs — use non-breaking space for "Design Consultation" where needed

---

## 3. Spacing

Base unit: `4px`. Section rhythm alternates full-bleed and contained.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Tight inline |
| `--space-2` | 8px | Icon gaps |
| `--space-3` | 12px | Compact stacks |
| `--space-4` | 16px | Default stack |
| `--space-6` | 24px | Component padding |
| `--space-8` | 32px | Row gaps |
| `--space-12` | 48px | Header padding, section inner (Figma) |
| `--space-16` | 64px | Section padding mobile |
| `--space-24` | 96px | Section padding tablet |
| `--space-32` | 128px | Section padding desktop |

| Section spacing | Desktop | Tablet | Mobile |
|---|---|---|---|
| Between major sections | 128px | 96px | 64px |
| Between service rows | 80px | 64px | 48px |
| Hero to next section | 0 (flush) | 0 | 0 |

---

## 4. Layout & Grid

| Token | Value |
|---|---|
| Breakpoint `sm` | 390px |
| Breakpoint `md` | 768px |
| Breakpoint `lg` | 1024px |
| Breakpoint `xl` | 1280px |
| Breakpoint `2xl` | 1440px |
| Max content width | `1280px` |
| Wide media width | `1440px` (full-bleed breakout) |
| Editorial text width | `720px` / `65ch` |
| Page gutter | 48px ≥ lg; 32px md; 20px sm |
| Grid columns | 12 desktop; 8 tablet; 4 mobile |
| Column gap | 24px desktop; 16px mobile |

---

## 5. Radii, Borders, Shadows

| Token | Value | Usage |
|---|---|---|
| `--radius-none` | 0 | Editorial images, portfolio |
| `--radius-sm` | 2px | Buttons, inputs only |
| `--radius-md` | 4px | Maximum for UI chrome — avoid card rounding |
| Border width | 1px | Dividers, header |
| Shadow none | — | Default editorial |
| Shadow subtle | `0 1px 2px rgba(26,24,22,0.06)` | Solid header only |

**No** excessive rounded containers or marketplace card shadows.

---

## 6. Image Ratios

| Context | Ratio | Crop |
|---|---|---|
| Hero | 16:9 – 3:2 | Art-directed focal point; `object-cover` |
| Service row image | 4:3 | Center-weighted |
| Portfolio featured large | 3:2 or 4:5 editorial | CMS cover aspect preserved |
| Portfolio secondary | 1:1 or 4:3 | CMS derivative |
| Material macro | 16:9 or 3:2 | Detail focal point |
| OG image | 1200 × 630 | Brand template |

Portfolio CMS images: preserve existing WebP derivative dimensions (`ADR-0013`).

---

## 7. Motion Tokens

| Token | Value |
|---|---|
| `--duration-fast` | 300ms |
| `--duration-base` | 600ms |
| `--duration-slow` | 800ms |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` |
| `--reveal-distance` | 24px |
| `--hover-scale` | 1.03 |
| Scroll threshold (header) | 80px |
| IO threshold (reveal) | 0.2 |
| Stagger (services) | 120ms |

---

## 8. Z-Index Layers

| Layer | Value |
|---|---|
| base | 0 |
| header | 50 |
| mobile nav overlay | 60 |
| mobile nav drawer | 70 |
| skip link focus | 100 |

---

## 9. Focus Treatment

```css
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}
```

Non-colour cue: 2px outline + offset on all interactive elements. Buttons also change background on hover/focus.

---

## 10. Shared Base (Figma variable collection alignment)

Figma `ONEDECORE / Shared Base` collection aligns with breakpoints and motion durations above. Direction A tokens in this document supersede interim HTML concept variables for production.
