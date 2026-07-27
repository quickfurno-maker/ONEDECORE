# Phase 2F — Responsive Layout & Accessibility Architecture

**Document Status:** Frozen  
**Target:** WCAG 2.2 AA

---

## 1. Breakpoints

| Name | Min width | Primary test viewport | Figma frame |
|---|---|---|---|
| `sm` | 360px | 360 × 800 | Small mobile |
| `sm+` | 390px | 390 × 844 | A04, A14–A17 |
| `md` | 768px | 768 × 1024 | A03 |
| `lg` | 1024px | 1024 × 768 landscape | Tablet landscape |
| `xl` | 1280px | 1280 × 800 | A02 |
| `2xl` | 1440px | 1440 × 1024 | A01, A05–A13 |

---

## 2. Layout Behaviour by Viewport

### Header

| Viewport | Behaviour |
|---|---|
| ≥ 1024px | Full horizontal nav + CTA |
| 768–1023px | Compressed nav or hamburger at 1024 breakpoint |
| < 768px | Hamburger only; logo + CTA visible |
| Landscape mobile | Same as mobile; ensure 44px targets |

### Hero

| Viewport | Height | Copy | CTA |
|---|---|---|---|
| 1440 | min(85vh, 900px) | H1 48–64px serif | Visible in first viewport |
| 1280 | min(80vh, 820px) | H1 48px | Visible |
| 768 | min(75vh, 720px) | H1 36px | Visible |
| 390 | min(70vh, 640px) | H1 32–36px | Primary CTA without scroll |

### Services (alternating rows)

| Viewport | Layout |
|---|---|
| Desktop | 50/50 image-text; alternate sides |
| Tablet | 50/50 or stacked if narrow |
| Mobile | Image top, text below; full width |

### Portfolio (homepage)

| Viewport | Layout |
|---|---|
| Desktop | 1 large + 2 secondary editorial grid OR 2-column asymmetric |
| Tablet | 2-column |
| Mobile | Single column; large image moments |

### Process

| Viewport | Layout |
|---|---|
| Desktop | Horizontal step row or vertical with connectors |
| Mobile | Vertical stack; no horizontal scroll |

### Consultation band

| Viewport | Layout |
|---|---|
| All | Centered text + single CTA; full-width band |

### Footer

| Viewport | Columns |
|---|---|
| Desktop | 4-column link groups |
| Tablet | 2-column |
| Mobile | Stacked |

---

## 3. Overflow & Zoom

| Check | Requirement |
|---|---|
| Horizontal overflow | None at all breakpoints |
| 200% zoom | No loss of function; no horizontal scroll |
| Text reflow | Content reflows; no fixed viewport lock |
| Landscape mobile | Header + hero CTA remain reachable |

---

## 4. Accessibility Gates

### Landmarks

- `<header>`, `<nav aria-label="Primary">`, `<main id="main-content">`, `<footer>`
- One `<h1>` per route
- Logical heading hierarchy

### Skip link

- First focusable element: "Skip to main content" → `#main-content`

### Keyboard

- All interactive elements reachable in logical order
- Mobile drawer: focus trap, Tab cycles, Escape closes, focus restored to trigger
- Route change: focus moves to `<h1>` (client helper in shell)

### Focus

- Visible `:focus-visible` — 2px bronze outline, 3px offset
- Minimum 44×44px touch targets

### Contrast

- Body text ≥ 4.5:1 on canvas
- Large text ≥ 3:1
- UI components ≥ 3:1
- Bronze on ivory verified in design tokens

### Motion

| Animation | Reduced-motion behaviour |
|---|---|
| Hero reveal | Static; no transform |
| Header transition | Instant background swap |
| Service reveal | All visible immediately |
| Portfolio hover scale | No scale; underline/focus only |
| IO fades | `opacity: 1`; no observer delay |

`prefers-reduced-motion: reduce` → disable non-essential animation globally via CSS media query and `useReducedMotion` hook.

### Forms (contact — 2F-E)

- Visible `<label>` for every field
- Errors linked via `aria-describedby`
- Required fields indicated accessibly

### Images

- Meaningful alt from CMS or content contract
- Decorative: `alt=""`
- No text in images for critical information

### Screen reader

- Portfolio items: `<article>` with heading link
- No autoplay video V1

---

## 5. Mobile Motion Simplification

| Effect | Desktop | Mobile |
|---|---|---|
| Hero image scale | Subtle 1.05→1 | Static or opacity only |
| Parallax | None | None |
| Pinned storytelling | None | None |
| Service stagger | 120ms | 0–60ms or none |
| Portfolio hover | scale 1.03 | tap feedback via opacity |

---

## 6. Performance-Linked Accessibility

- No autoplay video
- No layout-shifting motion (reserve image dimensions)
- Font loading: `display: swap` — fallbacks match metrics
- LCP element: hero image or H1 — not blocked by animation JS

---

## 7. Testing Viewports (mandatory)

| Viewport | Use |
|---|---|
| 1440 × 1024 | Desktop QA |
| 1280 × 800 | Laptop QA |
| 768 × 1024 | Tablet portrait |
| 390 × 844 | Mobile QA |
| 360 × 800 | Small mobile |
| 200% zoom @ 390 | Reflow |

---

## 8. Related Documents

- [Design Tokens](phase-2f-design-tokens.md)
- [Component Architecture](phase-2f-component-architecture.md)
- [Implementation Plan](phase-2f-implementation-plan.md)
